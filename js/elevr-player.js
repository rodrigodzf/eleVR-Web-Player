/**
 * eleVR Web Player: A web player for 360 video on the Oculus
 * Copyright (C) 2014 Andrea Hawksley and Andrew Lutomirski
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the Mozilla Public License; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
/* global controls, projection, util, webGL, webVR */

'use strict';

var currentScreenOrientation = window.orientation || 0; // active default

var timing = {showTiming: false, // Switch to true to show frame times in the console
              frameTime: 0,
              prevFrameTime: 0,
              canvasResized: 0,
              textureLoaded: 0,
              textureTime: 0,
              start: 0,
              end: 0,
              framesSinceIssue: 0
              };

var videoObjectURL = null;
var videoOptions = {};


// WebMIDI Vars
// ***************************************************************
var bNewStart = false;
var bStopped = false;
var iDelay   = 0;      // we need 2 frames delay I dont know why
var numFrames = 30 // frames per second

var openPort = null;
var allInputs = null;

var kMTCFrames      = 0;
var kMTCSeconds     = 1;
var kMTCMinutes     = 2;
var kMTCHours       = 3;

//http://forum.openframeworks.cc/t/getting-midi-sync-message-song-how-to-solved/8667/4
var tempoNumerator = 4; /// chose the one of your song...., ie. 4/4, 2/4 ..... the number in the numerator of the signature.
var tempoDenominator = 4; /// choose the one you want...
var tempoTicks = 0;
var tempoqNotes = 1;
var tempoBars = 1;
var isPlaying = false;
var num32thNotes = 0;
var ticksfor32thNote = 0;

// these static variables could be globals, or class properties etc.
var times     = [0, 0, 0, 0];                 // this static buffer will hold our 4 time componens (frames, seconds, minutes, hours)
var szType     = "24 fps";                           // SMPTE type as string (24fps, 25fps, 30fps drop-frame, 30fps)

// ***************************************************************
function initElements() {
  window.container = document.getElementById('video-container');
  window.container.style.width = window.innerWidth + 'px';
  window.container.style.height = window.innerHeight + 'px';
  window.leftLoad = document.getElementById('left-load');
  window.rightLoad = document.getElementById('right-load');
  window.leftPlay = document.getElementById('left-play');
  window.rightPlay = document.getElementById('right-play');
  window.canvas = document.getElementById('glcanvas');
  window.video = document.getElementById('video');

  // Buttons
  window.playButton = document.getElementById('play-pause');
  window.playL = document.getElementById('play-l');
  window.playR = document.getElementById('play-r');
  window.muteButton = document.getElementById('mute');
  window.loopButton = document.getElementById('loop');
  window.fullScreenButton = document.getElementById('full-screen');

  // Sliders
  window.seekBar = document.getElementById('seek-bar');

  // Selectors
  window.videoSelect = document.getElementById('video-select');
  window.projectionSelect = document.getElementById('projection-select');
  window.selector = document.getElementById("midi_input_device_select");

  document.getElementById('title-l').style.fontSize = window.outerHeight / 20 + 'px';
  document.getElementById('title-r').style.fontSize = window.outerHeight / 20 + 'px';

  document.getElementById('message-l').style.fontSize = window.outerHeight / 30 + 'px';
  document.getElementById('message-r').style.fontSize = window.outerHeight / 30 + 'px';
}

function runEleVRPlayer() {
  webVR.initWebVR();

  initElements();
  controls.create();

  midiSync.initMidi();
  webGL.initWebGL();

  if (webGL.gl) {
    webGL.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    webGL.gl.clearDepth(1.0);
    webGL.gl.disable(webGL.gl.DEPTH_TEST);

    util.setCanvasSize();

    // Keyboard Controls
    controls.enableKeyControls();

    window.shader = new webGL.Shader({
      fragmentShaderName: 'shader-fs',
      vertexShaderName: 'shader-vs',
      attributes: ['aVertexPosition'],
      uniforms: ['uSampler', 'eye', 'projection', 'proj_inv'],
    });

    webGL.initBuffers();
    webGL.initTextures();

    window.video.addEventListener('canplaythrough', controls.loaded);
    window.video.addEventListener('ended', controls.ended);

    // Keep a record of all the videos that are in the drop-down menu.
    Array.prototype.slice.call(window.videoSelect.options).forEach(function(option) {
      videoOptions[option.value] = option;
    });

    initFromSettings(window.location.hash || window.location.search);
  }
}

function initFromSettings(newSettings) {
  if (!newSettings) {
    return;
  }

  var settings = util.getTruthyURLSearchParams(newSettings, {
    autoplay: false,
    projection: 'mono',
    loop: true
  });

  if (!settings.projection) {
    // Hack because we coerce '0' to `false` in `util.getTruthyURLSearchParams`.
    settings.projection = '0';
  }

  settings.projection = util.getCustomProjection(settings.projection);

  if (projection !== settings.projection) {
    projection = settings.projection;

    if (window.projectionSelect) {
      window.projectionSelect.value = settings.projection;
    }
  }

  controls.setLooping(settings.loop);

  if (settings.video) {
    window.video.innerHTML = '';

    if (window.videoSelect) {
      var optionValue = settings.projection + settings.video;

      if (optionValue in videoOptions) {
        videoOptions[optionValue].selected = true;
      } else {
        var option = document.createElement('option');
        option.selected = true;
        option.textContent = settings.title || util.getVideoTitle(settings.video);

        // Note: The controls code expects the filename to be prefixed with '0' or '1'.
        option.value = optionValue;

        if (settings.autoplay) {
          option.dataset.autoplay = '';
        } else {
          delete option.dataset.autoplay;
        }

        videoOptions[optionValue] = option;

        window.videoSelect.appendChild(option);
      }
    }

    controls.loadVideo(settings.video);
  }

  if (settings.autoplay) {
    controls.play();
  } else {
    window.video.pause();
  }
}

window.addEventListener('hashchange', function() {
  initFromSettings(window.location.hash);
});

window.addEventListener('message', function(e) {
  if (typeof e.data === 'object') {
    window.location.hash = '#' + JSON.stringify(e.data);
  } else if (typeof e.data === 'string') {
    window.location.hash = '#' + e.data;
  } else {
    return;
  }
});
