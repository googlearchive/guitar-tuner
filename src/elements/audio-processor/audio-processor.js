/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import ToasterInstance from '../../scripts/libs/Toaster';

/**
 * Takes the audio from getUserMedia and processes it to figure out how well
 * it maps to the strings of a guitar.
 *
 * Big thanks to Chris Wilson (@cwilso) for code and assistance.
 */
class AudioProcessor {

  constructor () {
    // Defer normal constructor behavior to created because we're only
    // allowed to take the prototype with us from the class.
    Polymer(AudioProcessor.prototype);
  }

  get is () {
    return 'audio-processor';
  }

  created () {

    this.FFTSIZE = 2048;
    this.stream = null;
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.gainNode = this.audioContext.createGain();
    this.microphone = null;

    this.gainNode.gain.value = 0;
    this.analyser.fftSize = this.FFTSIZE;
    this.analyser.smoothingTimeConstant = 0;

    this.frequencyBufferLength = this.FFTSIZE;
    this.frequencyBuffer = new Float32Array(this.frequencyBufferLength);

    this.strings = {
      e2: {
        offset: Math.round(this.audioContext.sampleRate / 82.4069),
        difference: 0
      },

      a2: {
        offset: Math.round(this.audioContext.sampleRate / 110),
        difference: 0
      },

      d3: {
        offset: Math.round(this.audioContext.sampleRate / 146.832),
        difference: 0
      },

      g3: {
        offset: Math.round(this.audioContext.sampleRate / 195.998),
        difference: 0
      },

      b3: {
        offset: Math.round(this.audioContext.sampleRate / 246.932),
        difference: 0
      },

      e4: {
        offset: Math.round(this.audioContext.sampleRate / 329.628),
        difference: 0
      }
    };

    this.stringsKeys = Object.keys(this.strings);

    this.lastRms = 0;
    this.rmsThreshold = 0.006;
    this.assessedStringsInLastFrame = false;
    this.assessStringsUntilTime = 0;

    // Bind as we would have done for anything in the constructor so we can use
    // them without confusing what 'this' means. Yay window scoped.
    this.dispatchAudioData = this.dispatchAudioData.bind(this);
    this.sortStringKeysByDifference = this.sortStringKeysByDifference.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  requestUserMedia () {

    navigator.getUserMedia({audio:true}, (stream) => {

      this.sendingAudioData = true;
      this.stream = stream;
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      requestAnimationFrame(this.dispatchAudioData);

    }, (err) => {
      ToasterInstance().then((toaster) => {
        toaster.toast('Unable to access the microphone')
      });
    });
  }

  attached () {

    // Set up the stream kill / setup code for visibility changes.
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Then call it.
    this.onVisibilityChange();

  }

  detached () {
    this.sendingAudioData = false;
  }

  onVisibilityChange () {

    if (document.hidden) {
      this.sendingAudioData = false;

      if (this.stream) {
        // Chrome 47+
        this.stream.getAudioTracks().forEach((track) => {
          if ('stop' in track) {
            track.stop();
          }
        });

        // Chrome 46-
        if ('stop' in this.stream) {
          this.stream.stop();
        }
      }

      this.stream = null;
    } else {
      this.requestUserMedia();
    }

  }

  sortStringKeysByDifference (a, b) {
    return this.strings[a].difference - this.strings[b].difference;
  }

  /**
   * Autocorrelate the audio data, which is basically where you
   * compare the audio buffer to itself, offsetting by one each
   * time, up to the half way point. You sum the differences and
   * you see how small the difference comes out.
   */
  autocorrelateAudioData (time) {

    let searchSize = this.frequencyBufferLength * 0.5;
    let sampleRate = this.audioContext.sampleRate;
    let offsetKey = null;
    let offset = 0;
    let difference = 0;
    let tolerance = 0.001;
    let rms = 0;
    let rmsMin = 0.008;
    let assessedStringsInLastFrame = this.assessedStringsInLastFrame;

    // Fill up the data.
    this.analyser.getFloatTimeDomainData(this.frequencyBuffer);

    // Figure out the root-mean-square, or rms, of the audio. Basically
    // this seems to be the amount of signal in the buffer.
    for (let d = 0; d < this.frequencyBuffer.length; d++) {
      rms += this.frequencyBuffer[d] * this.frequencyBuffer[d];
    }

    rms = Math.sqrt(rms / this.frequencyBuffer.length);

    // If there's little signal in the buffer quit out.
    if (rms < rmsMin)
      return 0;

    // Only check for a new string if the volume goes up. Otherwise assume
    // that the string is the same as the last frame.
    if (rms > this.lastRms + this.rmsThreshold)
      this.assessStringsUntilTime = time + 250;

    if (time < this.assessStringsUntilTime) {

      this.assessedStringsInLastFrame = true;

      // Go through each string and figure out which is the most
      // likely candidate for the string being tuned based on the
      // difference to the "perfect" tuning.
      for (let o = 0; o < this.stringsKeys.length; o++) {

        offsetKey = this.stringsKeys[o];
        offset = this.strings[offsetKey].offset;
        difference = 0;

        // Reset how often this string came out as the closest.
        if (assessedStringsInLastFrame === false)
          this.strings[offsetKey].difference = 0;

        // Now we know where the peak is, we can start
        // assessing this sample based on that. We will
        // step through for this string comparing it to a
        // "perfect wave" for this string.
        for (let i = 0; i < searchSize; i++) {
          difference += Math.abs(this.frequencyBuffer[i] -
              this.frequencyBuffer[i + offset]);
        }

        difference /= searchSize;

        // Weight the difference by frequency. So lower strings get
        // less preferential treatment (higher offset values). This
        // is because harmonics can mess things up nicely, so we
        // course correct a little bit here.
        this.strings[offsetKey].difference += (difference * offset);
      }

    } else {
      this.assessedStringsInLastFrame = false;
    }

    // If this is the first frame where we've not had to reassess strings
    // then we will order by the string with the largest number of matches.
    if (assessedStringsInLastFrame === true &&
        this.assessedStringsInLastFrame === false) {
      this.stringsKeys.sort(this.sortStringKeysByDifference);
    }

    // Next for the top candidate in the set, figure out what
    // the actual offset is from the intended target.
    // We'll do it by making a full sweep from offset - 10 -> offset + 10
    // and seeing exactly how long it takes for this wave to repeat itself.
    // And that will be our *actual* frequency.
    let searchRange = 10;
    let assumedString = this.strings[this.stringsKeys[0]];
    let searchStart = assumedString.offset - searchRange;
    let searchEnd = assumedString.offset + searchRange;
    let actualFrequency = assumedString.offset;
    let smallestDifference = Number.POSITIVE_INFINITY;

    for (let s = searchStart; s < searchEnd; s++) {

      difference = 0;

      // For each iteration calculate the difference of every element of the
      // array. The data in the buffer should be PCM, so values ranging
      // from -1 to 1. If they match perfectly then they'd essentially
      // cancel out. But this is real data so we'll be looking for small
      // amounts. If it's below tolerance assume a perfect match, otherwise
      // go with the smallest.
      //
      // A better version of this would be to curve match on the data.
      for (let i = 0; i < searchSize; i++) {
        difference += Math.abs(this.frequencyBuffer[i] -
            this.frequencyBuffer[i + s]);
      }

      difference /= searchSize;

      if (difference < smallestDifference) {
        smallestDifference = difference;
        actualFrequency = s;
      }

      if (difference < tolerance) {
        actualFrequency = s;
        break;
      }
    }

    this.lastRms = rms;

    return this.audioContext.sampleRate / actualFrequency;

  }

  dispatchAudioData (time) {

    // Always set up the next pass here, because we could
    // early return from this pass if there's not a lot
    // of exciting data to deal with.
    if (this.sendingAudioData)
      requestAnimationFrame(this.dispatchAudioData);

    let frequency = this.autocorrelateAudioData(time);

    if (frequency === 0)
      return;

    // Convert the most active frequency to linear, based on A440.
    let dominantFrequency = Math.log2(frequency / 440);

    // Figure out how many semitones that equates to.
    let semitonesFromA4 = 12 * dominantFrequency;

    // The octave is A440 for 4, so start there, then adjust by the
    // number of semitones. Since we're at A, we need only 3 more to
    // push us up to octave 5, and 9 to drop us to 3. So there's the magic
    // 9 in that line below accounted for.
    let octave = 4 + ((9 + semitonesFromA4) / 12);
    octave = Math.floor(octave);

    // The note is 0 for A, all the way to 11 for G#.
    let note = (12 + (Math.round(semitonesFromA4) % 12)) % 12;

    // Now tell anyone who's interested.
    this.fire('audio-data', { frequency, octave, note });
  }
}

new AudioProcessor();
