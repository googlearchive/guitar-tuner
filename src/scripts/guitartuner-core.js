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

import ToasterInstance from './libs/Toaster';

(function () {
  // Don't you just love prefixed stuff? No? Me neither.
  window.AudioContext = window.AudioContext ||
      window.webkitAudioContext ||
      window.mozAudioContext ||
      window.msAudioContext;

  navigator.getUserMedia = navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

  if (typeof window.AudioContext === 'undefined' ||
      typeof navigator.getUserMedia === 'undefined') {

    requestAnimationFrame(function() {
      document.body.classList.add('unsupported');
    });
    return;
  }

  document.body.classList.add('supported');

  /**
   * Conditionally loads webcomponents polyfill if needed.
   * Credit: Glen Maddern (geelen on GitHub)
   */
  var webComponentsSupported = ('registerElement' in document
    && 'import' in document.createElement('link')
    && 'content' in document.createElement('template'));

  if (!webComponentsSupported) {
    var wcPoly = document.createElement('script');
    wcPoly.async = true;
    wcPoly.src = '/third_party/webcomponents-lite.min.js';
    wcPoly.onload = lazyLoadPolymerAndElements;
    document.head.appendChild(wcPoly);
  } else {
    lazyLoadPolymerAndElements();
  }

  function lazyLoadPolymerAndElements() {

    // Let's use Shadow DOM if we have it, because awesome.
    window.Polymer = window.Polymer || {};
    window.Polymer.dom = 'shadow';

    var elements = [
      '/elements/audio-processor/audio-processor.html',
      '/elements/audio-visualizer/audio-visualizer.html',
      '/elements/tuning-instructions/tuning-instructions.html'
    ];

    elements.forEach(function(elementURL) {

      var elImport = document.createElement('link');
      elImport.rel = 'import';
      elImport.href = elementURL;
      elImport.async = 'true';

      document.head.appendChild(elImport);

    })
  }

  if ('serviceWorker' in navigator) {

    navigator.serviceWorker.register('/sw.js').then(function(registration) {

      var isUpdate = false;

      // If this fires we should check if there's a new Service Worker
      // waiting to be activated. If so, ask the user to force refresh.
      if (registration.active)
        isUpdate = true;

      registration.onupdatefound = function(event) {

        console.log("A new Service Worker version has been found...");

        // If an update is found the spec says that there is a new Service
        // Worker installing, so we should wait for that to complete then
        // show a notification to the user.
        registration.installing.onstatechange = function(event) {

          if (this.state === 'installed') {

            console.log("Service Worker Installed.");

            if (isUpdate) {
              ToasterInstance().then(toaster => {
                toaster.toast(
                    'App updated. Restart for the new version.');
              });
            } else {
              ToasterInstance().then(toaster => {
                toaster.toast('App ready for offline use.');
              });
            }

          } else {
            console.log("New Service Worker state: ", this.state);
          }
        };
      };
    }, function(err) {
      console.log(err);
    });

  }
})();
