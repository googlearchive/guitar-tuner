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

class TuningInstructions {

  constructor () {
    // Defer normal constructor behavior to created because we're only
    // allowed to take the prototype with us from the class.
    Polymer(TuningInstructions.prototype);
  }

  get is () {
    return 'tuning-instructions';
  }

  created () {
    this.audioProcessor = document.querySelector('audio-processor');
    this.requestedAnimationFrame = false;
    this.tolerance = 0.006;
    this.frequencyToRender = -1;

    this.frequencies = {
      e2: 82.4069,
      a2: 110.000,
      d3: 146.832,
      g3: 195.998,
      b3: 246.942,
      e4: 329.628
    };

    this.linearizedFrequencies = {
      e2: Math.log2(this.frequencies.e2 / 440),
      a2: Math.log2(this.frequencies.a2 / 440),
      d3: Math.log2(this.frequencies.d3 / 440),
      g3: Math.log2(this.frequencies.g3 / 440),
      b3: Math.log2(this.frequencies.b3 / 440),
      e4: Math.log2(this.frequencies.e4 / 440)
    };

    this.onAudioData = this.onAudioData.bind(this);

  }

  attached () {

    this.frequencyMessage = this.$.frequency;
    this.stringFrequencyMessage = this.$.stringfrequency;
    this.indicator = this.$.indicator;

    this.audioProcessor.addEventListener('audio-data', this.onAudioData);

    this.async( () => {
      this.classList.add('resolved');
    }, 100);
  }

  detached () {
    this.audioProcessor.removeEventListener('audio-data', this.onAudioData);
  }

  onAudioData (e) {

    let frequency = e.detail.frequency;
    let linearizedFrequency = Math.log2(frequency / 440);

    // Figure out which is the nearest string.
    let distances = {
      e2: linearizedFrequency - this.linearizedFrequencies.e2,
      a2: linearizedFrequency - this.linearizedFrequencies.a2,
      d3: linearizedFrequency - this.linearizedFrequencies.d3,
      g3: linearizedFrequency - this.linearizedFrequencies.g3,
      b3: linearizedFrequency - this.linearizedFrequencies.b3,
      e4: linearizedFrequency - this.linearizedFrequencies.e4
    };

    let distanceKeys = Object.keys(distances);
    let smallestDistance = Number.MAX_VALUE;
    let smallestDistanceKey = '';

    for (let d = 0; d < distanceKeys.length; d++) {

      let key = distanceKeys[d];

      if (Math.abs(distances[key]) < smallestDistance) {
        smallestDistance = distances[key];
        smallestDistanceKey = key;
      }
    }

    // Reset the indicator
    this.indicator.classList.remove('tune-up');
    this.indicator.classList.remove('tune-down');
    this.indicator.classList.remove('in-tune');

    if (smallestDistance < -this.tolerance) {
      this.indicator.classList.add('tune-up');
    } else if (smallestDistance > this.tolerance) {
      this.indicator.classList.add('tune-down');
    } else {
      this.indicator.classList.add('in-tune');
    }

    if (this.frequencyToRender === -1)
      this.frequencyToRender = frequency;

    this.frequencyToRender += (frequency - this.frequencyToRender) * 0.15;

    this.frequencyMessage.textContent =
        this.frequencyToRender.toFixed(2) + 'Hz';
    this.stringFrequencyMessage.textContent =
        this.frequencies[smallestDistanceKey].toFixed(2) + 'Hz';

  }
}

new TuningInstructions();
