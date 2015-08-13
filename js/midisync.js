(function(global) {
    'use strict';

    /*! Enumeration of MIDI types */
    var MidiType = {
    	NoteOff	              : 0x80,	///< Note Off
    	NoteOn                : 0x90,	///< Note On
    	AfterTouchPoly        : 0xA0,	///< Polyphonic AfterTouch
    	ControlChange         : 0xB0,	///< Control Change / Channel Mode
    	ProgramChange         : 0xC0,	///< Program Change
    	AfterTouchChannel     : 0xD0,	///< Channel (monophonic) AfterTouch
    	PitchBend             : 0xE0,	///< Pitch Bend
    	SystemExclusive       : 0xF0,	///< System Exclusive
    	TimeCodeQuarterFrame  : 0xF1,	///< System Common - MIDI Time Code Quarter Frame
    	SongPosition          : 0xF2,	///< System Common - Song Position Pointer
    	SongSelect            : 0xF3,	///< System Common - Song Select
    	TuneRequest           : 0xF6,	///< System Common - Tune Request
    	Clock                 : 0xF8,	///< System Real Time - Timing Clock
    	Start                 : 0xFA,	///< System Real Time - Start
    	Continue              : 0xFB,	///< System Real Time - Continue
    	Stop                  : 0xFC,	///< System Real Time - Stop
    	ActiveSensing         : 0xFE,	///< System Real Time - Active Sensing
    	SystemReset           : 0xFF,	///< System Real Time - System Reset
    	InvalidType           : 0x00    ///< For notifying errors
    };

    // -----------------------------------------------------------------------------

    /*! Enumeration of Thru filter modes */
    var MidiFilterMode =
    {
        Off                   : 0,  ///< Thru disabled (nothing passes through).
        Full                  : 1,  ///< Fully enabled Thru (every incoming message is sent back).
        SameChannel           : 2,  ///< Only the messages on the Input Channel will be sent back.
        DifferentChannel      : 3,  ///< All the messages but the ones on the Input Channel will be sent back.
    };

    // -----------------------------------------------------------------------------

    /*! \brief Enumeration of Control Change command numbers.
    See the detailed controllers numbers & description here:
    http://www.somascape.org/midi/tech/spec.html#ctrlnums
    */
    var MidiControlChangeNumber =
    {
        // High resolution Continuous Controllers MSB (+32 for LSB) ----------------
        BankSelect                  : 0,
        ModulationWheel             : 1,
        BreathController            : 2,
        // CC3 undefined
        FootController              : 4,
        PortamentoTime              : 5,
        DataEntry                   : 6,
        ChannelVolume               : 7,
        Balance                     : 8,
        // CC9 undefined
        Pan                         : 10,
        ExpressionController        : 11,
        EffectControl1              : 12,
        EffectControl2              : 13,
        // CC14 undefined
        // CC15 undefined
        GeneralPurposeController1   : 16,
        GeneralPurposeController2   : 17,
        GeneralPurposeController3   : 18,
        GeneralPurposeController4   : 19,

        // Switches ----------------------------------------------------------------
        Sustain                     : 64,
        Portamento                  : 65,
        Sostenuto                   : 66,
        SoftPedal                   : 67,
        Legato                      : 68,
        Hold                        : 69,

        // Low resolution continuous controllers -----------------------------------
        SoundController1            : 70,   ///< Synth: Sound Variation   FX: Exciter On/Off
        SoundController2            : 71,   ///< Synth: Harmonic Content  FX: Compressor On/Off
        SoundController3            : 72,   ///< Synth: Release Time      FX: Distortion On/Off
        SoundController4            : 73,   ///< Synth: Attack Time       FX: EQ On/Off
        SoundController5            : 74,   ///< Synth: Brightness        FX: Expander On/Off
        SoundController6            : 75,   ///< Synth: Decay Time        FX: Reverb On/Off
        SoundController7            : 76,   ///< Synth: Vibrato Rate      FX: Delay On/Off
        SoundController8            : 77,   ///< Synth: Vibrato Depth     FX: Pitch Transpose On/Off
        SoundController9            : 78,   ///< Synth: Vibrato Delay     FX: Flange/Chorus On/Off
        SoundController10           : 79,   ///< Synth: Undefined         FX: Special Effects On/Off
        GeneralPurposeController5   : 80,
        GeneralPurposeController6   : 81,
        GeneralPurposeController7   : 82,
        GeneralPurposeController8   : 83,
        PortamentoControl           : 84,
        // CC85 to CC90 undefined
        Effects1                    : 91,   ///< Reverb send level
        Effects2                    : 92,   ///< Tremolo depth
        Effects3                    : 93,   ///< Chorus send level
        Effects4                    : 94,   ///< Celeste depth
        Effects5                    : 95,   ///< Phaser depth

        // Channel Mode messages ---------------------------------------------------
        AllSoundOff                 : 120,
        ResetAllControllers         : 121,
        LocalControl                : 122,
        AllNotesOff                 : 123,
        OmniModeOff                 : 124,
        OmniModeOn                  : 125,
        MonoModeOn                  : 126,
        PolyModeOn                  : 127
    };

    // -----------------------------------------------------------------------------

    var midiSync = {


        initMidi: function() {
            navigator.requestMIDIAccess().then(function(info) {
                selector.addEventListener('change', function(e) {
                    midiInputChanged(e.target.value);
                });
                allInputs = info.inputs;

                info.inputs.forEach(function(input, id) {
                    var opt = document.createElement('option');
                    opt.setAttribute('value', id);
                    opt.innerHTML = input.name;
                    selector.appendChild(opt);
                });
                var firstId = info.inputs.keys().next().value;

                midiSync.midiInputChanged(firstId);

            }, function(error) {
                console.log("MIDI init went wrong", error);
            });
        },

        midiInputChanged: function(id) {
            if (openPort) openPort.removeEventListener('midimessage');
            console.log(id, allInputs.get(id))
            if (allInputs && allInputs.get(id)) {
                openPort = allInputs.get(id);
                console.log("attaching message handler");
                openPort.addEventListener('midimessage', midiSync.onMidiMessage)
                openPort.open();
                console.log(openPort.connection)
            }
        },

        MIDIDecodeClock: function(ClockData){
            // console.log("MIDI_TIME_CLOCK");

            var _ticksPerqNote = 24.0 * 4.0/tempoDenominator;
            var ticksPerBar = tempoNumerator * _ticksPerqNote; //576
            var ticks32thNotePerBar =  ticksPerBar/8.0;
            var  ticksPer32thNote =  _ticksPerqNote/8.0;


            tempoTicks += 1;
            ticksfor32thNote +=1;
            if(ticksfor32thNote % ticksPer32thNote == 0 ) {
                // if(num32thNotes % 2 == 0) midiOut.sendNoteOff(1, 62, 0); else  midiOut.sendNoteOn(1, 62, 127);
                num32thNotes  += 1;
            }
            if(tempoTicks % _ticksPerqNote == 0 ) {
                tempoqNotes += 1;
                tempoTicks = 0;
                //// hemos llegado al beat final::::
                if (tempoqNotes % (tempoNumerator + 1) == 0 ) {   /// eso está bien ???
                    tempoBars += 1;
                    tempoqNotes = 1;
                    num32thNotes = 0;
                    ticksfor32thNote = 0;
                }
            }

            // console.log(tempoBars);
        },
        MIDIDecodeSPP: function(MTCData){
            // 14-bit value
            var _14bit;
            _14bit = MTCData[2];
            _14bit <<= 8;
            _14bit |= MTCData[1];
            // console.log(_14bit);
        },
        MIDIContinue: function(){
            bNewStart = true;
            bStopped = false;
        },
        MIDIStart: function(){

            console.log("Start");
            // video.currentTime = times[kMTCFrames]/24 + times[kMTCSeconds];
            // console.log(video.currentTime);
            times[kMTCFrames] = 0;
            times[kMTCSeconds] = 0;
            times[kMTCMinutes] = 0;
            times[kMTCHours] = 0;

            bNewStart = true;
            bStopped = false;

            // controls.play();

        },
        MIDIStop: function(){

            controls.pause();
            bStopped = true;
            iDelay = 0;
        },
        MIDIDecodeMTC: function(MTCData){
            if (!bStopped){
                var messageIndex        = MTCData[1] >> 4;       // the high nibble: which quarter message is this (0...7).
                var val                 = MTCData[1] & 0xf;      // the low nibble: value
                var timeIndex           = messageIndex  >> 1;              // which time component (frames, seconds, minutes or hours) is
                var bNewFrame           = messageIndex % 4 == 0;

                // the time encoded in the MTC is 1 frame behind by the time we have received a new frame, so adjust accordingly
                if(bNewFrame) {
                    if (iDelay >= 2){
                        times[kMTCFrames]++;
                        if(times[kMTCFrames] >= numFrames) {
                            times[kMTCFrames] %= numFrames;
                            // console.log(video.duration);
                            times[kMTCSeconds]++;
                            if(times[kMTCSeconds] == 60) {
                                times[kMTCSeconds] %= 60;
                                times[kMTCMinutes]++;
                                if(times[kMTCMinutes] >= 60) {
                                    times[kMTCMinutes] %= 60;
                                    times[kMTCHours]++;
                                }
                            }
                        }
                        if (bNewStart){
                            video.currentTime = times[kMTCFrames]/24 + times[kMTCSeconds];
                            console.log(video.currentTime);
                            controls.play();
                            bNewStart = false;
                        }
                        // console.log("frames: "  + times[kMTCFrames]);
                        // console.log("hours: "   + times[kMTCHours]);
                        // console.log("minutes: " + times[kMTCMinutes]);
                        // console.log("seconds: " + times[kMTCSeconds]);
                    }

                    iDelay++
                }


                if(messageIndex % 2 == 0) {                             // if this is lower nibble of time component
                    times[timeIndex]    = val;
                } else {                                                // ... or higher nibble
                    times[timeIndex]    |=  val << 4;

                }

                if(messageIndex == 7) {
                    times[kMTCHours] &= 0x1F;                               // only use lower 5 bits for hours (higher bits indicate SMPTE type)
                    var smpteType = val >> 1;
                    // switch(smpteType) {
                    //   case 0: numFrames = 24; szType = "24 fps"; break;
                    //   case 1: numFrames = 25; szType = "25 fps"; break;
                    //   case 2: numFrames = 30; szType = "30 fps (drop-frame)"; break;
                    //   case 3: numFrames = 30; szType = "30 fps"; break;
                    //   default: numFrames = 100; szType = " **** unknown SMPTE type ****";
                    // }
                }
            }
        },
        onMidiMessage: function(message) {
            var data = message.data;
            var statusCode = data[0] >> 4;
            var channelNumber = data[0] & 0b1111;
            // console.log(statusCode, channelNumber, data[1], data[2]);
            // console.log(data[0], data[1], data[2]);

            switch (data[0]) {

                case MidiType.NoteOff:
                    console.log("NoteOff");
                    break;

                case MidiType.ControlChange:
                    console.log("Control Change");
                    break;

                case MidiType.NoteOn:
                    console.log("NoteOn");
                    break;

                case MidiType.SystemExclusive:
                    console.log("SystemExclusive");
                    break;

                case MidiType.TimeCodeQuarterFrame:
                    midiSync.MIDIDecodeMTC(data);
                    break;

                case MidiType.SongPosition:
                    midiSync.MIDIDecodeSPP(data);
                    break;

                case MidiType.PitchBend:
                    console.log("PitchBend");
                    break;

                case MidiType.AfterTouchPoly:
                    // console.log("AfterTouch");
                    break;

                case MidiType.Clock:
                    //console.log("Clock");
                    break;

                case MidiType.Start:
                    midiSync.MIDIStart();
                    break;

                case MidiType.Continue:
                    midiSync.MIDIContinue();
                    break;

                case MidiType.Stop:
                    midiSync.MIDIStop();
                    break;

                case MidiType.SystemReset:
                    console.log("SystemReset");
                    break;

                case MidiType.ProgramChange:
                    console.log("ProgramChange");
                    break;
                default:
                    console.log("Unknown");

            }
            // if  (statusCode == 8) { // Note On
            //     console.log("Note On");
            //
            // } else if  (statusCode == 9) { // Note off
            //     console.log("Note OFF");
            //
            // } else if  (statusCode == 10) { // Aftertouch
            // } else if  (statusCode == 11) { //Chan 1 Control/Mode Change
            //     console.log("Control Change");
            // } else if  (statusCode == 12) { // Prgram Change
            // } else if  (statusCode == 13) { // Channel Pressure
            // } else if  (statusCode == 14) { // Pitch Bend Change
            //     console.log("Pitch Bend Change");
            // } else if  (statusCode == 15) {
            //
            //     if (channelNumber == 0xa){ // Start
            //         console.log("Start");
            //         // video.currentTime = times[kMTCFrames]/24 + times[kMTCSeconds];
            //         // console.log(video.currentTime);
            //         times[kMTCFrames] = 0;
            //         times[kMTCSeconds] = 0;
            //         times[kMTCMinutes] = 0;
            //         times[kMTCHours] = 0;
            //
            //         bNewStart = true;
            //         bStopped = false;
            //
            //         // controls.play();
            //     } else if (channelNumber == 0xb) { // Continue
            //         console.log("Continue");
            //         // video.currentTime = times[kMTCSeconds];
            //         bNewStart = true;
            //         bStopped = false;
            //
            //
            //         // console.log(times[kMTCSeconds]); // At the moment it start at the time of the last stop
            //         // controls.play();
            //     } else if (channelNumber == 0xc) {
            //         console.log("Stop");
            //         // times[kMTCFrames] = 0;
            //         // times[kMTCSeconds] = 0;
            //         // times[kMTCMinutes] = 0;
            //         // times[kMTCHours] = 0;
            //         controls.pause();
            //
            //         bStopped = true;
            //         iDelay = 0;
            //         // times[kMTCSeconds] = 0;
            //         // times[kMTCFrames] = 0;
            //         // times[kMTCMinutes] = 0;
            //         // times[kMTCHours] = 0;
            //     } else if (channelNumber == 0x0){ //Full frame messages
            //         console.log("Full Frame");
            //     } else if (channelNumber == 0xf){ //sysex f0 ff f7
            //         console.log("sysex");
            //     } else if (channelNumber == 8){ // MIDI_TIME_CLOCK
            //         // console.log("MIDI_TIME_CLOCK");
            //
            //         var _ticksPerqNote = 24.0 * 4.0/tempoDenominator;
            //         var ticksPerBar = tempoNumerator * _ticksPerqNote; //576
            //         var ticks32thNotePerBar =  ticksPerBar/8.0;
            //         var  ticksPer32thNote =  _ticksPerqNote/8.0;
            //
            //
            //         tempoTicks += 1;
            //         ticksfor32thNote +=1;
            //         if(ticksfor32thNote % ticksPer32thNote == 0 ) {
            //             // if(num32thNotes % 2 == 0) midiOut.sendNoteOff(1, 62, 0); else  midiOut.sendNoteOn(1, 62, 127);
            //             num32thNotes  += 1;
            //         }
            //         if(tempoTicks % _ticksPerqNote == 0 ) {
            //             tempoqNotes += 1;
            //             tempoTicks = 0;
            //             //// hemos llegado al beat final::::
            //             if (tempoqNotes % (tempoNumerator + 1) == 0 ) {   /// eso está bien ???
            //                 tempoBars += 1;
            //                 tempoqNotes = 1;
            //                 num32thNotes = 0;
            //                 ticksfor32thNote = 0;
            //             }
            //         }
            //
            //         // console.log(tempoBars);
            //     } else if (channelNumber == 0x1){ //  MTC Quarter Frame
            //         if (!bStopped){
            //             var messageIndex        = data[1] >> 4;       // the high nibble: which quarter message is this (0...7).
            //             var val                 = data[1] & 0xf;      // the low nibble: value
            //             var timeIndex           = messageIndex  >> 1;              // which time component (frames, seconds, minutes or hours) is this
            //             var bNewFrame           = messageIndex % 4 == 0;
            //
            //             // the time encoded in the MTC is 1 frame behind by the time we have received a new frame, so adjust accordingly
            //             if(bNewFrame) {
            //                 // if (times[kMTCFrames] % 2 == 0){
            //                 //     times[kMTCFrames]++
            //                 // }
            //                 if (iDelay >= 2){
            //                     times[kMTCFrames]++;
            //                     if(times[kMTCFrames] >= numFrames) {
            //                         times[kMTCFrames] %= numFrames;
            //                         // console.log(video.duration);
            //                         times[kMTCSeconds]++;
            //                         if(times[kMTCSeconds] == 60) {
            //                             times[kMTCSeconds] %= 60;
            //                             times[kMTCMinutes]++;
            //                             if(times[kMTCMinutes] >= 60) {
            //                                 times[kMTCMinutes] %= 60;
            //                                 times[kMTCHours]++;
            //                             }
            //                         }
            //                     }
            //
            //                     if (bNewStart){
            //                         video.currentTime = times[kMTCFrames]/24 + times[kMTCSeconds];
            //                         console.log(video.currentTime);
            //                         controls.play();
            //                         bNewStart = false;
            //                     }
            //                     // if (times[kMTCFrames] % 2 != 0){
            //                     //     times[kMTCFrames]++
            //                     // }
            //                     // console.log("frames: "  + times[kMTCFrames]);
            //                     // console.log("hours: "   + times[kMTCHours]);
            //                     // console.log("minutes: " + times[kMTCMinutes]);
            //                     // console.log("seconds: " + times[kMTCSeconds]);
            //                 }
            //
            //                 iDelay++
            //             }
            //
            //
            //             if(messageIndex % 2 == 0) {                             // if this is lower nibble of time component
            //                 times[timeIndex]    = val;
            //             } else {                                                // ... or higher nibble
            //                 times[timeIndex]    |=  val << 4;
            //
            //             }
            //
            //             if(messageIndex == 7) {
            //                 times[kMTCHours] &= 0x1F;                               // only use lower 5 bits for hours (higher bits indicate SMPTE type)
            //                 var smpteType = val >> 1;
            //                 // switch(smpteType) {
            //                 //   case 0: numFrames = 24; szType = "24 fps"; break;
            //                 //   case 1: numFrames = 25; szType = "25 fps"; break;
            //                 //   case 2: numFrames = 30; szType = "30 fps (drop-frame)"; break;
            //                 //   case 3: numFrames = 30; szType = "30 fps"; break;
            //                 //   default: numFrames = 100; szType = " **** unknown SMPTE type ****";
            //                 // }
            //             }
            //         }
            //     }
            // }

        }

    }

    global.midiSync = midiSync;

})(window);
