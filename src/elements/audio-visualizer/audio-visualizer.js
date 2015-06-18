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

class AudioVisualizer {

  constructor () {
    // Defer normal constructor behavior to created because we're only
    // allowed to take the prototype with us from the class.
    Polymer(AudioVisualizer.prototype);
  }

  get is () {
    return 'audio-visualizer';
  }

  created () {
    this.audioProcessor = document.querySelector('audio-processor');
    this.surroundCanvas = document.createElement('canvas');

    this.hasPrerenderedSurroundAndNoteMarkers = false;

    this.onAudioData = this.onAudioData.bind(this);
    this.waitForDimensions = this.waitForDimensions.bind(this);
    this.draw = this.draw.bind(this);
    this.onResize = this.onResize.bind(this);

    this.dialAngle = Math.PI * 2;
    this.realDialAngle = Math.PI * 2;
    this.note = 'C';
    this.octave = '4th octave';
  }

  attached () {

    this.canvas = this.$.pitch;
    this.ctx = this.canvas.getContext('2d');
    this.surroundCtx = this.surroundCanvas.getContext('2d');

    this.audioProcessor.addEventListener('audio-data', this.onAudioData);

    this.gradientLeft = this.ctx.createLinearGradient(-16, 0, 0, 0);
    this.gradientLeft.addColorStop(0, 'rgba(0,0,0,0)');
    this.gradientLeft.addColorStop(1, 'rgba(0,0,0,0.2)');

    this.gradientRight = this.ctx.createLinearGradient(0, 0, 16, 0);
    this.gradientRight.addColorStop(0, 'rgba(0,0,0,0.2)');
    this.gradientRight.addColorStop(1, 'rgba(0,0,0,0)');

    this.gradientDialShadow = this.ctx.createLinearGradient(0, 0,
          55, 55);
    this.gradientDialShadow.addColorStop(0, 'rgba(0,0,0,0.3)');
    this.gradientDialShadow.addColorStop(1, 'rgba(0,0,0,0)');

    this.gradientInnerCircleShadow = this.ctx.createLinearGradient(0, 0,
          0, 100);
    this.gradientInnerCircleShadow.addColorStop(0, 'rgba(0,0,0,0.3)');
    this.gradientInnerCircleShadow.addColorStop(1, 'rgba(0,0,0,0)');

    window.addEventListener('resize', this.onResize);

    requestAnimationFrame(this.waitForDimensions);
  }

  detached () {
    this.audioProcessor.removeEventListener('audio-data', this.onAudioData);
    window.removeEventListener('resize', this.onResize);
  }

  waitForDimensions () {

    this.width = this.canvas.parentElement.offsetWidth;
    this.height = this.canvas.parentElement.offsetHeight;

    if (this.width === 0 || this.height === 0) {
      requestAnimationFrame(this.waitForDimensions);
      return;
    }

    this.classList.add('resolved');

    this.onResize();
    requestAnimationFrame(this.draw);
  }

  onResize () {

    let dPR = window.devicePixelRatio || 1;

    // Switch off the canvas.
    this.canvas.style.display = 'none';

    // Find out how large the parent element is.
    this.width = this.canvas.parentElement.offsetWidth;
    this.height = this.canvas.parentElement.offsetHeight;

    // Switch it back on.
    this.canvas.style.display = 'block';

    // Scale the backing store by the dPR.
    this.canvas.width = this.width * dPR;
    this.canvas.height = this.height * dPR;

    // Scale it back down to the width and height we want in logical pixels.
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    // Account for any upscaling by applying a single scale transform.
    this.ctx.scale(dPR, dPR);

    this.hasPrerenderedSurroundAndNoteMarkers = false;

  }

  onAudioData (e) {

    let TAU = Math.PI * 2;

    // Convert frequency to an angle.
    let frequency = e.detail.frequency;
    let linearizedFrequency = Math.log2(frequency / 440);
    let newDialAngle = (linearizedFrequency * TAU - Math.PI * 0.5) % TAU;

    // Figure out how far we need to travel.
    let newDialAngleDifference = (newDialAngle - this.realDialAngle) % TAU;

    // If it's more than half a circle, it's better to
    // go in the other direction.
    if (Math.abs(newDialAngleDifference) > Math.PI)
      newDialAngleDifference = (newDialAngleDifference + TAU) % TAU;

    // We're going to get some rounding errors here, but it should be
    // good enough for what we're trying to achieve.
    this.realDialAngle = this.realDialAngle + newDialAngleDifference;
    this.note = AudioNotation.convertNote(e.detail.note);
    this.octave = AudioNotation.convertOctave(e.detail.octave);

  }

  draw () {

    let minDimension = Math.min(this.width, this.height);
    let radius = Math.round(minDimension * 0.5);
    let radiusInner = Math.round(radius - minDimension * 0.18);

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.dialAngle += (this.realDialAngle - this.dialAngle) * 0.15;

    if (!this.hasPrerenderedSurroundAndNoteMarkers)
      this.prerenderSurroundAndNoteMarkers(radius, radiusInner);

    // Dial
    this.drawSurroundAndNoteMarkers(radius, radiusInner);
    this.drawDialShadow(radius);
    this.drawDial(radius);
    this.drawInnerCircle(radius);

    requestAnimationFrame(this.draw);
  }

  prerenderSurroundAndNoteMarkers (radius, radiusInner) {

    this.hasPrerenderedSurroundAndNoteMarkers = true;

    let TAU = Math.PI * 2;
    let notes = 12;
    let step = TAU / notes;
    let dPR = window.devicePixelRatio || 1;

    // Scale the backing store by the dPR.
    this.surroundCanvas.width = this.width * dPR;
    this.surroundCanvas.height = this.height * dPR;
    this.surroundCtx.scale(dPR, dPR);

    this.surroundCtx.fillStyle = '#FF9800';

    // Outer circle - Orange
    this.surroundCtx.beginPath();
    this.surroundCtx.arc(this.width * 0.5, this.height * 0.5, radius, 0, TAU);
    this.surroundCtx.closePath();
    this.surroundCtx.fill();

    // Divider Lines
    this.surroundCtx.save();
    this.surroundCtx.translate(this.width * 0.5, this.height * 0.5);
    this.surroundCtx.translate(0.5, 0.5);
    this.surroundCtx.rotate(step * -0.5);
    this.surroundCtx.strokeStyle = 'rgba(0,0,0,0.1)';
    this.surroundCtx.fillStyle = '#FFF';

    this.surroundCtx.textBaseline = 'middle';
    this.surroundCtx.textAlign = 'center';

    for (let i = 0; i < notes; i++) {
      let noteIndex = (i + 3) % 12;
      let noteStr = AudioNotation.convertNote(noteIndex);
      let noteSharp = noteStr.length > 1;

      this.surroundCtx.save();
      this.surroundCtx.beginPath();
      this.surroundCtx.rotate(i * step);
      this.surroundCtx.moveTo(0, -radius);
      this.surroundCtx.lineTo(0, 0);
      this.surroundCtx.stroke();
      this.surroundCtx.closePath();

      this.surroundCtx.rotate(step * 0.5);
      this.surroundCtx.font = 'normal 400 20px Roboto';
      this.surroundCtx.fillText(noteStr[0], 0,
        -radius + (radius - radiusInner) * 0.5);

      if (noteSharp) {
        this.surroundCtx.save();
        this.surroundCtx.translate(12,
            -radius + (radius - radiusInner) * 0.5 - 6);
        this.surroundCtx.scale(0.7, 0.7);
        this.surroundCtx.font = 'normal 400 20px sans-serif';
        this.surroundCtx.fillText(noteStr[1], 0, 0);
        this.surroundCtx.restore();
      }
      this.surroundCtx.restore();
    }

    this.surroundCtx.restore();

    // Outer circle - Punch through
    this.surroundCtx.save();
    this.surroundCtx.globalCompositeOperation = 'destination-out';
    this.surroundCtx.beginPath();
    this.surroundCtx.arc(this.width * 0.5, this.height * 0.5,
        radiusInner, 0, TAU);
    this.surroundCtx.closePath();
    this.surroundCtx.fill();
    this.surroundCtx.restore();
  }

  drawSurroundAndNoteMarkers () {
    let scale = 1 / (window.devicePixelRatio || 1);
    this.ctx.save();
    this.ctx.scale(scale, scale);
    this.ctx.drawImage(this.surroundCanvas, 0, 0);
    this.ctx.restore();
  }

  drawDialShadow (radius) {

    let dialShadowAlpha =
        1 - Math.pow((1 + Math.cos(this.dialAngle + Math.PI * 1.25)) * 0.5, 3);

    dialShadowAlpha = Math.min(1, dialShadowAlpha);

    this.ctx.save();
    this.ctx.translate(this.width * 0.5, this.height * 0.5);

    let points = [{
      x: Math.sin(this.dialAngle) * -16,
      y: Math.cos(this.dialAngle) * 16
    }, {
      x: Math.cos(this.dialAngle) * -16,
      y: Math.sin(this.dialAngle) * -16
    }, {
      x: Math.cos(this.dialAngle - Math.PI * 0.25) * -16,
      y: Math.sin(this.dialAngle - Math.PI * 0.25) * -16
    }, {
      x: Math.cos(this.dialAngle) * 16,
      y: Math.sin(this.dialAngle) * 16
    }, {
      x: Math.cos(this.dialAngle + Math.PI * 0.25) * 16,
      y: Math.sin(this.dialAngle + Math.PI * 0.25) * 16
    }, {
      x: Math.sin(this.dialAngle) * (radius - 3),
      y: Math.cos(this.dialAngle) * -(radius - 3)
    }];

    let pointMaxIndex = points.length - 1;
    let pointSin = Math.sin(Math.PI * 0.25);
    let pointCos = Math.cos(Math.PI * 0.25);

    points.sort(function(a, b) {

      // Take the point, rotate it by 45 degrees to the right,
      // and *then* sort it by its x value.

      let adjustedAX = a.x * pointCos - a.y * pointSin;
      let adjustedBX = b.x * pointCos - b.y * pointSin;

      return adjustedAX - adjustedBX;
    });


    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    this.ctx.lineTo(points[pointMaxIndex].x, points[pointMaxIndex].y);
    this.ctx.lineTo(points[pointMaxIndex].x + this.height,
        points[pointMaxIndex].y + this.height);
    this.ctx.lineTo(points[0].x + this.height, points[0].y + this.height);
    this.ctx.closePath();
    this.ctx.clip();

    let x = Math.sin(this.dialAngle) * radius * 0.5;
    let y = Math.cos(this.dialAngle) * radius * 0.5;

    this.ctx.globalAlpha = dialShadowAlpha;
    this.ctx.translate(x, -y);
    this.ctx.fillStyle = this.gradientDialShadow;
    this.ctx.fillRect(-radius * 0.5 - 16, -radius * 0.5 - 16,
        this.width, this.height);
    this.ctx.restore();

  }

  drawDial (radius) {

    let shadowAlpha = (Math.cos(this.dialAngle - Math.PI * 0.25) + 1) * 0.5;

    this.ctx.save();
    this.ctx.translate(this.width * 0.5, this.height * 0.5);
    this.ctx.rotate(this.dialAngle);

    // Left hand side
    this.ctx.beginPath();
    this.ctx.arc(0.5, 0, 16, Math.PI * 0.5, -Math.PI);
    this.ctx.arc(0.5, -radius + 6, 3, -Math.PI, -Math.PI * 0.5);
    this.ctx.closePath();

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#FFF';
    this.ctx.fill();

    this.ctx.globalAlpha = 1 - shadowAlpha;
    this.ctx.fillStyle = this.gradientLeft;
    this.ctx.fill();

    // Right hand side
    this.ctx.beginPath();
    this.ctx.arc(-0.5, -radius + 6, 3, -Math.PI * 0.5, 0);
    this.ctx.arc(-0.5, 0, 16, 0, Math.PI * 0.5);
    this.ctx.closePath();

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#FFF';
    this.ctx.fill();

    this.ctx.globalAlpha = shadowAlpha;
    this.ctx.fillStyle = this.gradientRight;
    this.ctx.fill();

    this.ctx.restore();

  }

  drawInnerCircle (radius) {

    let TAU = Math.PI * 2;
    let noteSharp = this.note.length > 1;
    let innerCircleRadius = Math.round(radius * 0.47);

    this.ctx.save();
    this.ctx.translate(this.width * 0.5, this.height * 0.5);

    // Shadow
    this.ctx.save();
    this.ctx.rotate(-Math.PI * 0.25);
    this.ctx.fillStyle = this.gradientInnerCircleShadow;
    this.ctx.fillRect(-innerCircleRadius, 0,
        innerCircleRadius * 2, innerCircleRadius * 2);
    this.ctx.restore();

    // Circle
    this.ctx.beginPath();
    this.ctx.arc(0, 0, innerCircleRadius, 0, TAU);
    this.ctx.closePath();

    this.ctx.fillStyle = '#B0BEC5';
    this.ctx.fill();

    // Label
    this.ctx.fillStyle = '#FFF';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = 'normal 100 80px Roboto';
    this.ctx.fillText(this.note[0], 0, -8);

    if (noteSharp) {
      this.ctx.save();
      this.ctx.translate(32, -28);
      this.ctx.scale(0.5, 0.5);
      this.ctx.font = 'normal 100 80px sans-serif';
      this.ctx.fillText(this.note[1], 0, 0);
      this.ctx.restore();
    }

    this.ctx.globalAlpha = 0.87;
    this.ctx.textBaseline = 'top';
    this.ctx.font = 'normal 400 12px Roboto';
    this.ctx.fillText(this.octave, 0, 32);

    this.ctx.restore();

  }

}

class AudioNotation {

  static convertOctave (octave) {
    let label = 'Octave';
    switch (octave) {
      case 1: return `${octave}st ${label}`;
      case 2: return `${octave}nd ${label}`;
      case 3: return `${octave}rd ${label}`;
      default: return `${octave}th ${label}`;
    }
  }

  static convertNote (note) {
    switch (note) {
      case 0: return 'A';
      case 1: return 'B♭';
      case 2: return 'B';
      case 3: return 'C';
      case 4: return 'C#';
      case 5: return 'D';
      case 6: return 'E♭';
      case 7: return 'E';
      case 8: return 'F';
      case 9: return 'F#';
      case 10: return 'G';
      case 11: return 'G#';
    }
  }

}

new AudioVisualizer();
