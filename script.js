    (() => {
      "use strict";

      const pitchClasses = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
      const solfegeClasses = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
      const modes = {
        octave: {
          name: "Find the octave",
          title: "Which octave did you hear?",
          copy: "Choose the octave that matches the sound.",
          kicker: "Your turn"
        },
        note: {
          name: "Name the note",
          title: "What note is it?",
          copy: "Recognize the note.",
          kicker: "Name that note"
        },
        full: {
          name: "Note & octave",
          title: "Name the full pitch.",
          copy: "Choose the note and octave you heard.",
          kicker: "The full picture"
        },
        detect: {
          name: "Live note detection",
          title: "Live note detection",
          copy: "Play the target note on your guitar and let the mic hear it.",
          kicker: "Live play"
        },
        read: {
          name: "Read the staff",
          title: "Which note is written here?",
          copy: "Read the note on the treble staff and pick its name.",
          kicker: "Your turn"
        }
      };

      // Letter spellings used for the treble-staff game. Every black-key pitch
      // class has BOTH a sharp and a flat spelling, so the player must read the
      // exact accidental written on the staff (E♭ from D♯, A♭ from G♯, etc).
      const readPitchDefs = [
        { name: "C",  letter: "C", accidental: "nat",   midi:  0 },
        { name: "C♯", letter: "C", accidental: "sharp", midi:  1 },
        { name: "D♭", letter: "D", accidental: "flat",  midi:  1 },
        { name: "D",  letter: "D", accidental: "nat",   midi:  2 },
        { name: "D♯", letter: "D", accidental: "sharp", midi:  3 },
        { name: "E♭", letter: "E", accidental: "flat",  midi:  3 },
        { name: "E",  letter: "E", accidental: "nat",   midi:  4 },
        { name: "F",  letter: "F", accidental: "nat",   midi:  5 },
        { name: "F♯", letter: "F", accidental: "sharp", midi:  6 },
        { name: "G♭", letter: "G", accidental: "flat",  midi:  6 },
        { name: "G",  letter: "G", accidental: "nat",   midi:  7 },
        { name: "G♯", letter: "G", accidental: "sharp", midi:  8 },
        { name: "A♭", letter: "A", accidental: "flat",  midi:  8 },
        { name: "A",  letter: "A", accidental: "nat",   midi:  9 },
        { name: "A♯", letter: "A", accidental: "sharp", midi: 10 },
        { name: "B♭", letter: "B", accidental: "flat",  midi: 10 },
        { name: "B",  letter: "B", accidental: "nat",   midi: 11 }
      ];

      // Solfège spellings for the treble-staff game, mirroring the letter set
      // so every black-key class also has both a sharp and a flat spelling.
      const readSolfegioDefs = [
        { name: "Do",   letter: "C", accidental: "nat",   midi:  0 },
        { name: "Do#",  letter: "C", accidental: "sharp", midi:  1 },
        { name: "Re♭",  letter: "D", accidental: "flat",  midi:  1 },
        { name: "Re",   letter: "D", accidental: "nat",   midi:  2 },
        { name: "Re#",  letter: "D", accidental: "sharp", midi:  3 },
        { name: "Mi♭",  letter: "E", accidental: "flat",  midi:  3 },
        { name: "Mi",   letter: "E", accidental: "nat",   midi:  4 },
        { name: "Fa",   letter: "F", accidental: "nat",   midi:  5 },
        { name: "Fa#",  letter: "F", accidental: "sharp", midi:  6 },
        { name: "Sol♭", letter: "G", accidental: "flat",  midi:  6 },
        { name: "Sol",  letter: "G", accidental: "nat",   midi:  7 },
        { name: "Sol#", letter: "G", accidental: "sharp", midi:  8 },
        { name: "La♭",  letter: "A", accidental: "flat",  midi:  8 },
        { name: "La",   letter: "A", accidental: "nat",   midi:  9 },
        { name: "La#",  letter: "A", accidental: "sharp", midi: 10 },
        { name: "Si♭",  letter: "B", accidental: "flat",  midi: 10 },
        { name: "Si",   letter: "B", accidental: "nat",   midi: 11 }
      ];

      // The full list of possible staff spellings for the active notation.
      function readStaffDefs() {
        return activeNotation === "solfege"
          ? readSolfegioDefs
          : readPitchDefs;
      }

      // The spelling(s) that match the given MIDI note's pitch class — one for
      // natural notes, both the sharp and flat spelling for black-key notes so
      // the written accidental is chosen at random.
      function readSpellingDefs(midi) {
        const pc = midi % 12;
        return readStaffDefs().filter(d => d.midi === pc);
      }

      // Lead-in delay (ms) before the first note plays when entering a game.
      const settings = {
        entryDelay: 250
      };
      const pianoSampleFiles = [
        { midi: 36, url: "C2.wav" },
        { midi: 48, url: "C3.wav" },
        { midi: 60, url: "C4.wav" },
        { midi: 72, url: "C5.wav" },
        { midi: 84, url: "C6.wav" },
        { midi: 96, url: "C7.wav" }
      ];

      // Browsers block fetch() of local files under a file:// URL, so the WAV
      // samples can only load from a real web server (http/https). When the
      // page is opened straight from disk, fall back to the built-in synth.
      const usesSamples = location.protocol === "http:" || location.protocol === "https:";

      if (usesSamples) {
        console.log("Nail The Pitch: using recorded piano WAV samples (pitch-shifted). " +
          "Serving over http(s) lets the browser fetch the audio files.");
      } else {
        console.log("Nail The Pitch: using the built-in synthesizer engine. " +
          "Opened from file:// where browsers block fetching local WAV samples.");
      }

      const homeScreen = document.querySelector("#home-screen");
      const gameScreen = document.querySelector("#game-screen");
      const app = document.querySelector(".app");
      const themeToggle = document.querySelector("#theme-toggle");
      const modeName = document.querySelector("#mode-name");
      const questionTitle = document.querySelector("#question-title");
      const questionCopy = document.querySelector("#question-copy");
      const questionKicker = document.querySelector("#question-kicker");
      const answerGrid = document.querySelector("#answer-grid");
      const modeGrid = document.querySelector(".mode-grid");
      const modeCards = [...modeGrid.querySelectorAll(".mode-card")];
      const carouselIndicators = [...document.querySelectorAll(".carousel-indicator")];
      const feedback = document.querySelector("#feedback");
      const nextButton = document.querySelector("#next-button");
      const timer = document.querySelector("#timer");
      const correctCount = document.querySelector("#correct-count");
      const incorrectCount = document.querySelector("#incorrect-count");
      const questionCount = document.querySelector("#question-count");
      const soundOrb = document.querySelector("#sound-orb");
      const octaveModal = document.querySelector("#octave-modal");
      const octaveModalTitle = document.querySelector("#octave-modal-title");
      const octaveModalCopy = document.querySelector("#octave-modal-copy");
      const octaveModalKicker = document.querySelector("#octave-modal-kicker");
      const noteModeFields = document.querySelector("#note-mode-fields");
      const octaveSelect = document.querySelector("#octave-select");
      const noteCountSelect = document.querySelector("#note-count-select");
      const noteNotationSelect = document.querySelector("#note-notation-select");
      const octaveStart = document.querySelector("#octave-start");

      // Live note detection (guitar) references.
      const detectScreen = document.querySelector("#detect-screen");
      const detectModeName = document.querySelector("#detect-mode-name");
      const detectTarget = document.querySelector("#detect-target");
      const detectCopy = document.querySelector("#detect-copy");
      const detectMicBtn = document.querySelector("#detect-mic-btn");
      const detectMicIndicator = document.querySelector("#detect-mic-indicator");
      const detectSkipBtn = document.querySelector("#detect-skip-btn");
      const detectMicStatus = document.querySelector("#detect-mic-status");
      const detectPitchTracker = getPitch.createPitchTracker();
      const detectReadout = document.querySelector("#detect-readout");
      const detectReadoutNote = document.querySelector("#detect-readout-note");
      const detectReadoutFrequency = document.querySelector("#detect-readout-frequency");
      const detectReadCopy = document.querySelector("#detect-read-copy");
      const detectBarFill = document.querySelector("#detect-bar-fill");
      const detectFeedback = document.querySelector("#detect-feedback");
      const detectTimer = document.querySelector("#detect-timer");
      const detectCorrectCount = document.querySelector("#detect-correct-count");
      const detectIncorrectCount = document.querySelector("#detect-incorrect-count");
      const detectQuestionCount = document.querySelector("#detect-question-count");
      const detectModal = document.querySelector("#detect-modal");
      const detectRangeSelect = document.querySelector("#detect-range-select");
      const detectOctaveFields = document.querySelector("#detect-octave-fields");
      const detectMicCheckStatus = document.querySelector("#detect-mic-check-status");
      const detectMicCheckBtn = document.querySelector("#detect-mic-check");
      const detectOctaveCheckboxes = document.querySelector("#detect-octave-checkboxes");
      const detectStart = document.querySelector("#detect-start");

      // Read-the-staff references.
      const readScreen = document.querySelector("#read-screen");
      const readModeName = document.querySelector("#read-mode-name");
      const readStaffWrap = document.querySelector("#read-staff-wrap");
      const readSoundOrb = document.querySelector("#read-sound-orb");
      const readAnswerGrid = document.querySelector("#read-answer-grid");
      const readFeedback = document.querySelector("#read-feedback");
      const readNextButton = document.querySelector("#read-next-button");
      const readTimer = document.querySelector("#read-timer");
      const readCorrectCount = document.querySelector("#read-correct-count");
      const readIncorrectCount = document.querySelector("#read-incorrect-count");
      const readQuestionCount = document.querySelector("#read-question-count");

      // Read-the-staff state.
      const read = {
        active: false,
        correctCount: 0,
        incorrectCount: 0,
        questions: 0,
        startedAt: 0,
        timerInterval: null,
        playTimer: null,
        currentQuestion: null,
        answered: false
      };

      // Live note detection (guitar) state.
      const detect = {
        active: false,
        octaves: [2, 3, 4, 5],
        target: null,
        correctCount: 0,
        incorrectCount: 0,
        questions: 0,
        startedAt: 0,
        timerInterval: null,
        stream: null,
        audioContext: null,
        analyser: null,
        inputBuffer: null,
        rafId: null,
        lastPitchCheckAt: 0,
        micEnabled: false,
        rangeLowMidi: 40,
        rangeHighMidi: 76,
        rangeDescription: "E2-E5",
        stableMidi: null,
        stableSince: null,
        stableLastSeenAt: null,
        smoothedMidi: null,
        locked: false
      };
      let detectMicCheckAttempt = 0;
      const DETECT_LOW_MIDI = 12;  // C0
      const DETECT_HIGH_MIDI = 119; // B8
      const DETECT_PITCH_CONFIRMATION_MS = 500;
      const DETECT_MAX_SAMPLE_GAP_MS = 250;
      const DETECT_PITCH_SMOOTHING = 0.15;
      const detectRangePresets = [
        { group: "Keyboards", value: "keys-108", label: "108 Keys (Custom Stuart & Sons) - C0 - B8, 9 Octaves", low: 12, high: 119 },
        { group: "Keyboards", value: "keys-97", label: "97 Keys (Bösendorfer Imperial) - C0 - C8, 8 Octaves", low: 12, high: 108 },
        { group: "Keyboards", value: "keys-92", label: "92 Keys (Bösendorfer 225) - F0 - C8, 7⅔ Octaves", low: 17, high: 108 },
        { group: "Keyboards", value: "keys-88", label: "88 Keys (Standard Concert Grand / Upright) - A0 - C8, 7¼ Octaves", low: 21, high: 108 },
        { group: "Keyboards", value: "keys-85", label: "85 Keys (Historical Standard) - A0 - A7, 7 Octaves", low: 21, high: 105 },
        { group: "Keyboards", value: "keys-76", label: "76 Keys (Stage Piano / Synthesizer) - E1 - G7, 6 Octaves", low: 28, high: 103 },
        { group: "Keyboards", value: "keys-73", label: "73 Keys (Classic Electric Piano style) - E1 - E7, 6 Octaves", low: 28, high: 100 },
        { group: "Keyboards", value: "keys-61", label: "61 Keys (Standard Portable Keyboard) - C2 - C7, 5 Octaves", low: 36, high: 96 },
        { group: "Keyboards", value: "keys-49", label: "49 Keys (Compact MIDI Controller) - C2 - C6, 4 Octaves", low: 36, high: 84 },
        { group: "Keyboards", value: "keys-37", label: "37 Keys (Mini Synth / Controller) - F2 - F5 (or C3 - C6), 3 Octaves", low: 41, high: 77 },
        { group: "Keyboards", value: "keys-32", label: "32 Keys (Ultra-compact / Melodica) - F2 - C5, ~2½ Octaves", low: 41, high: 72 },
        { group: "Keyboards", value: "keys-25", label: "25 Keys (Pocket / Travel Controller) - C3 - C5, 2 Octaves", low: 48, high: 72 },
        { group: "Guitar (19 frets)", value: "guitar-e-standard", label: "E Standard - E2-B5", low: 40, high: 83 },
        { group: "Guitar (19 frets)", value: "guitar-drop-d", label: "Drop D - D2-B5", low: 38, high: 83 },
        { group: "Guitar (19 frets)", value: "guitar-d-standard", label: "D Standard - D2-A5", low: 38, high: 81 },
        { group: "Guitar (19 frets)", value: "guitar-drop-c", label: "Drop C - C2-A5", low: 36, high: 81 },
        { group: "4-string bass (19 frets)", value: "bass-4-e-standard", label: "E Standard - E1-D4", low: 28, high: 62 },
        { group: "4-string bass (19 frets)", value: "bass-4-drop-d", label: "Drop D - D1-D4", low: 26, high: 62 },
        { group: "4-string bass (19 frets)", value: "bass-4-d-standard", label: "D Standard - D1-C4", low: 26, high: 60 },
        { group: "4-string bass (19 frets)", value: "bass-4-drop-c", label: "Drop C - C1-C4", low: 24, high: 60 },
        { group: "5-string bass (19 frets)", value: "bass-5-e-standard", label: "E Standard - B0-D4", low: 23, high: 62 },
        { group: "5-string bass (19 frets)", value: "bass-5-drop-d", label: "Drop D - B0-D4", low: 23, high: 62 },
        { group: "5-string bass (19 frets)", value: "bass-5-d-standard", label: "D Standard - A0-C4", low: 21, high: 60 },
        { group: "5-string bass (19 frets)", value: "bass-5-drop-c", label: "Drop C - G0-C4", low: 19, high: 60 },
        { group: "6-string bass (19 frets)", value: "bass-6-e-standard", label: "E Standard - B0-G4", low: 23, high: 67 },
        { group: "6-string bass (19 frets)", value: "bass-6-drop-d", label: "Drop D - B0-G4", low: 23, high: 67 },
        { group: "6-string bass (19 frets)", value: "bass-6-d-standard", label: "D Standard - A0-F4", low: 21, high: 65 },
        { group: "6-string bass (19 frets)", value: "bass-6-drop-c", label: "Drop C - G0-F4", low: 19, high: 65 },
        { group: "Custom", value: "custom", label: "Custom - choose octaves", custom: true }
      ];

      let activeMode = null;
      let openForMode = null;
      let activeOctave = 4;
      let activeNoteCount = 6;
      let activeNotation = "letters";
      let currentQuestion = null;
      let answered = false;
      let correct = 0;
      let incorrect = 0;
      let questions = 0;
      let startedAt = 0;
      let timerInterval = null;
      let audioContext = null;
      let entryDelayTimer = null;
      let audioStopTimer = null;
      let pianoSampleBuffersPromise = null;
      let activeSampleSource = null;

      // Request/resume audio output inside a user gesture so the browser's
      // autoplay policy unlocks sound before the first note is scheduled.
      async function primeAudio() {
        try {
          const context = await getAudioContext();
          if (context && context.state === "suspended") {
            await context.resume();
          }
        } catch (error) {
          /* Audio is blocked; playNote will surface its own message. */
        }
      }

      function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
        const seconds = (totalSeconds % 60).toString().padStart(2, "0");
        return `${minutes}:${seconds}`;
      }

      function updateTimer() {
        timer.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
      }

      function startSession(mode, octave, noteCount, notation) {
        activeMode = mode;
        activeOctave = (typeof octave === "number") ? octave : 4;
        activeNoteCount = (typeof noteCount === "number") ? noteCount : 6;
        activeNotation = (notation === "solfege") ? "solfege" : "letters";
        correct = 0;
        incorrect = 0;
        questions = 0;
        correctCount.textContent = "0";
        incorrectCount.textContent = "0";
        questionCount.textContent = "0";
        timer.textContent = "00:00";
        homeScreen.hidden = true;
        gameScreen.hidden = false;
        app.classList.add("is-playing");
        modeName.textContent = modes[mode].name;
        questionTitle.textContent = modes[mode].title;
        if (mode === "note") {
          const bounds = octaveHzBounds(activeOctave);
          questionCopy.textContent = `Recognize the note inside octave ${activeOctave} (${bounds.start}-${bounds.end} Hz).`;
        } else {
          questionCopy.textContent = modes[mode].copy;
        }
        questionKicker.textContent = modes[mode].kicker;
        startedAt = Date.now();
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);

        makeQuestion();
        clearTimeout(entryDelayTimer);
        entryDelayTimer = setTimeout(playNote, settings.entryDelay);
        primeAudio();
      }

      function stopSession() {
        clearInterval(timerInterval);
        clearTimeout(entryDelayTimer);
        clearTimeout(audioStopTimer);
        if (activeSampleSource) {
          activeSampleSource.onended = null;
          activeSampleSource.stop();
          activeSampleSource = null;
        }
        soundOrb.classList.remove("is-playing");
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        gameScreen.hidden = true;
        homeScreen.hidden = false;
        app.classList.remove("is-playing");
        activeMode = null;
      }

      function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      function shuffle(items) {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = randomInt(0, i);
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }

      function pitchFromMidi(midi) {
        const pitchClass = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        return {
          midi,
          pitchClass,
          octave,
          name: pitchClasses[pitchClass],
          label: `${pitchClasses[pitchClass]}${octave}`
        };
      }

      // Return the pitch-class names for the active notation (letters vs solfège).
      function notationClasses() {
        return activeNotation === "solfege" ? solfegeClasses : pitchClasses;
      }

      // The currently-selected notation's name for a given MIDI note.
      function notationName(midi) {
        return notationClasses()[midi % 12];
      }

      // Notation-aware full label (e.g. "C#4" or "Do#4").
      function notationLabel(midi) {
        return `${notationName(midi)}${Math.floor(midi / 12) - 1}`;
      }

      function makeQuestion() {
        // "note" mode is constrained to the chosen octave (2-6): C at MIDI
        // 12*(octave+1) up to B at 12*(octave+2)-1. Other modes use C2-B6.
        const lo = activeMode === "note" ? 12 * (activeOctave + 1) : 36;
        const hi = activeMode === "note" ? 12 * (activeOctave + 2) - 1 : 95;
        const note = pitchFromMidi(randomInt(lo, hi));
        let choices;
        let answer;

        if (activeMode === "octave") {
          choices = [2, 3, 4, 5, 6].map(String);
          answer = String(note.octave);
        } else if (activeMode === "note") {
          // Show a subset of pitch options (correct note + distractors),
          // sized by the chosen note count, using the active notation.
          const currentName = notationName(note.midi);
          const others = notationClasses().filter(name => name !== currentName);
          const distractors = shuffle(others).slice(0, Math.max(0, activeNoteCount - 1));
          choices = shuffle([currentName, ...distractors]);
          answer = currentName;
        } else {
          const possibleNotes = [];
          for (let midi = 36; midi <= 95; midi++) possibleNotes.push(pitchFromMidi(midi));
          const distractors = shuffle(possibleNotes.filter(pitch => pitch.midi !== note.midi)).slice(0, 11);
          choices = shuffle([note, ...distractors]).map(pitch => ({
            label: notationLabel(pitch.midi),
            answer: pitch.midi
          }));
          answer = note.midi;
        }

        currentQuestion = { note, choices, answer };
        answered = false;
        feedback.textContent = "";
        feedback.className = "feedback";
        nextButton.hidden = true;
        answerGrid.replaceChildren();

        choices.forEach(choice => {
          const label = typeof choice === "string" ? choice : choice.label;
          const value = typeof choice === "string" ? choice : choice.answer;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "answer-button";
          button.textContent = label;
          button.dataset.answer = String(value);
          button.addEventListener("click", () => submitAnswer(button));
          answerGrid.append(button);
        });

        questions++;
        questionCount.textContent = String(questions);
      }

      async function getAudioContext() {
        if (!audioContext || audioContext.state === "closed") {
          const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextConstructor) {
            feedback.textContent = "Audio isn't supported by this browser.";
            feedback.className = "feedback is-wrong";
            return null;
          }
          audioContext = new AudioContextConstructor();
        }
        // Resume inside the caller's user gesture. Browsers may require an
        // interaction to unlock sound output (autoplay policy).
        if (audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch (error) {
            feedback.textContent = "Tap again to turn on the sound.";
            feedback.className = "feedback is-wrong";
          }
        }
        return audioContext;
      }

      function loadPianoSamples(context) {
        if (!pianoSampleBuffersPromise) {
          pianoSampleBuffersPromise = Promise.all(pianoSampleFiles.map(async ({ midi, url }) => {
            const response = await fetch(new URL(url, document.baseURI));
            if (!response.ok) {
              throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
            }
            const buffer = await context.decodeAudioData(await response.arrayBuffer());
            return [midi, buffer];
          })).then(entries => new Map(entries)).catch(error => {
            pianoSampleBuffersPromise = null;
            throw error;
          });
        }
        return pianoSampleBuffersPromise;
      }

      function nearestPianoSample(midi) {
        return pianoSampleFiles.reduce((nearest, sample) =>
          Math.abs(sample.midi - midi) < Math.abs(nearest.midi - midi) ? sample : nearest
        );
      }

      // Synthesizer fallback for file:// usage where the WAV samples can't be
      // fetched. Builds a soft tone from a fundamental plus harmonics with an
      // amplitude envelope, matching the original pre-sample behaviour.
      function synthNote(context, midi, start, orb = soundOrb) {
        const frequency = 440 * Math.pow(2, (midi - 69) / 12);
        const partials = [
          { multiple: 1, gain: 0.72 },
          { multiple: 2, gain: 0.18 },
          { multiple: 3, gain: 0.07 }
        ];
        partials.forEach(({ multiple, gain: level }) => {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency * multiple, start);
          envelope.gain.setValueAtTime(0.0001, start);
          envelope.gain.exponentialRampToValueAtTime(level, start + 0.025);
          envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.35);
          oscillator.connect(envelope);
          envelope.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 1.4);
        });
        clearTimeout(audioStopTimer);
        audioStopTimer = setTimeout(() => orb.classList.remove("is-playing"), 1450);
      }

      function playSampleNote(context, midi, url, orb = soundOrb) {
        if (activeSampleSource) {
          activeSampleSource.onended = null;
          activeSampleSource.stop();
          activeSampleSource = null;
        }
        const sample = nearestPianoSample(midi);
        const playbackRate = Math.pow(2, (midi - sample.midi) / 12);
        const source = context.createBufferSource();
        source.buffer = url;
        source.playbackRate.setValueAtTime(playbackRate, context.currentTime);
        source.connect(context.destination);
        activeSampleSource = source;
        source.onended = () => {
          if (activeSampleSource === source) {
            activeSampleSource = null;
            orb.classList.remove("is-playing");
          }
        };
        source.start(context.currentTime + 0.02);
      }

      async function playNote() {
        const context = await getAudioContext();
        if (!context || !currentQuestion) return;

        const question = currentQuestion;
        const midi = question.note.midi;

        if (soundOrb.classList.contains("is-playing")) {
          soundOrb.classList.remove("is-playing");
          void soundOrb.offsetWidth;
        }
        soundOrb.classList.add("is-playing");

        if (!usesSamples) {
          // Running from a plain file:// URL (no web server): fall back to the
          // built-in synthesizer since the WAVs cannot be fetched.
          synthNote(context, midi, context.currentTime + 0.02);
          return;
        }

        let buffers;
        try {
          buffers = await loadPianoSamples(context);
        } catch (error) {
          if (currentQuestion !== question || !activeMode) return;
          console.error("Failed to load piano samples:", error);
          feedback.textContent = "Could not load the piano WAVs. Make sure C2.wav-C7.wav are in the project root.";
          feedback.className = "feedback is-wrong";
          return;
        }

        if (currentQuestion !== question || !activeMode) return;
        const sample = nearestPianoSample(midi);
        playSampleNote(context, midi, buffers.get(sample.midi));
      }

      function frequencyForMidi(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
      }

      // Lowest (C) and highest (B) hertz of an octave, rounded to integers.
      function octaveHzBounds(octave) {
        const startMidi = 12 * (octave + 1);   // C of the octave
        const endMidi = 12 * (octave + 2) - 1; // B of the octave
        return {
          start: Math.round(frequencyForMidi(startMidi)),
          end: Math.round(frequencyForMidi(endMidi))
        };
      }

      function submitAnswer(button) {
        if (answered) return;
        answered = true;
        const isCorrect = button.dataset.answer === String(currentQuestion.answer);
        const rightAnswer = activeMode === "octave"
          ? `${currentQuestion.note.name}${currentQuestion.note.octave}`
          : activeMode === "note"
            ? notationName(currentQuestion.note.midi)
            : notationLabel(currentQuestion.note.midi);
        const hertz = Math.round(frequencyForMidi(currentQuestion.note.midi));

        if (isCorrect) {
          correct++;
          correctCount.textContent = String(correct);
          feedback.innerHTML = `That's right - <b>${rightAnswer} (${hertz} Hz)</b>. Nice ear!`;
          feedback.classList.add("is-correct");
          button.classList.add("is-correct");
        } else {
          incorrect++;
          incorrectCount.textContent = String(incorrect);
          feedback.innerHTML = `Not quite - the note was <b>${rightAnswer} (${hertz} Hz)</b>.`;
          feedback.classList.add("is-wrong");
          button.classList.add("is-wrong");
          const correctButton = [...answerGrid.children].find(
            option => option.dataset.answer === String(currentQuestion.answer)
          );
          if (correctButton) correctButton.classList.add("is-correct");
        }

        answerGrid.querySelectorAll("button").forEach(option => { option.disabled = true; });
        nextButton.hidden = false;
        nextButton.focus();
      }

      function openOctaveModal(mode) {
        openForMode = mode;

        // Show each octave's frequency range in the dropdown options.
        [...octaveSelect.options].forEach(option => {
          const bounds = octaveHzBounds(Number(option.value));
          option.textContent = `${option.value} (${bounds.start}-${bounds.end} Hz)`;
        });

        // Adapt the modal to the chosen game. The full game always spans all
        // octaves and all 12 notes, so its octave/count fields aren't relevant.
        // The read-the-staff game has a fixed staff range too, so it also only
        // asks for the note names (letters vs solfège).
        if (mode === "full") {
          octaveModalKicker.textContent = "03 / THE FULL PICTURE";
          octaveModalTitle.textContent = "Note & octave";
          octaveModalCopy.textContent = "Pick the note names to use.";
          noteModeFields.hidden = true;
        } else if (mode === "read") {
          octaveModalKicker.textContent = "05 / READ THE STAFF";
          octaveModalTitle.textContent = "Read the staff";
          octaveModalCopy.textContent = "Do you want letter names (ABCDEFG) or solfège (Do Re Mi)?";
          noteModeFields.hidden = true;
        } else {
          octaveModalKicker.textContent = "02 / STEP TWO";
          octaveModalTitle.textContent = "Name the note";
          octaveModalCopy.textContent = "Choose an octave and how many notes to pick from.";
          noteModeFields.hidden = false;
        }

        activeOctave = Number(octaveSelect.value) || 4;
        // Show and make the modal interactive.
        octaveModal.removeAttribute("inert");
        octaveModal.hidden = false;
        octaveModal.querySelector(".modal-dialog").focus();
        // Wait until the browser has painted the modal before focusing the
        // active field: the octave select for range games, the notation select
        // when the octave/count fields are hidden (full and read games).
        requestAnimationFrame(() => {
          if (noteModeFields.hidden) {
            noteNotationSelect.focus();
          } else {
            octaveSelect.focus();
          }
        });
      }

      function closeOctaveModal() {
        // Hide and make the modal (and its focusable descendants) inert.
        octaveModal.hidden = true;
        octaveModal.setAttribute("inert", "");
      }

      function beginGame() {
        const mode = openForMode || "note";
        const octave = Number(octaveSelect.value) || 4;
        const noteCount = Number(noteCountSelect.value) || 6;
        const notation = noteNotationSelect.value || "letters";
        closeOctaveModal();
        if (mode === "read") {
          readStartSession(notation);
        } else {
          startSession(mode, octave, noteCount, notation);
        }
      }

      // ---- Live note detection (guitar) ----

      function noteShortLabel(midi) {
        return `${pitchClasses[midi % 12]}${Math.floor(midi / 12) - 1}`;
      }

      function detectRangeForOctave(oct) {
        return {
          lo: Math.max(DETECT_LOW_MIDI, 12 * (oct + 1)),
          hi: Math.min(DETECT_HIGH_MIDI, 12 * (oct + 2) - 1)
        };
      }

      function populateDetectRangeOptions() {
        const previousValue = detectRangeSelect.value;
        detectRangeSelect.replaceChildren();
        let currentGroup = null;
        let optionGroup = null;

        detectRangePresets.forEach(preset => {
          if (preset.group !== currentGroup) {
            currentGroup = preset.group;
            optionGroup = document.createElement("optgroup");
            optionGroup.label = currentGroup;
            detectRangeSelect.append(optionGroup);
          }
          const option = document.createElement("option");
          option.value = preset.value;
          option.textContent = preset.label;
          optionGroup.append(option);
        });
        detectRangeSelect.value = detectRangePresets.some(preset => preset.value === previousValue)
          ? previousValue
          : "guitar-e-standard";
      }

      function openDetectModal() {
        const previousOctaves = new Set(
          [...detectOctaveCheckboxes.querySelectorAll("input[type=checkbox]:checked")]
            .map(input => Number(input.value))
        );
        populateDetectRangeOptions();
        detectOctaveCheckboxes.replaceChildren();
        Array.from({ length: 9 }, (_, octave) => octave).forEach(oct => {
          const { lo, hi } = detectRangeForOctave(oct);
          const label = document.createElement("label");
          label.className = "octave-check";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = String(oct);
          input.checked = previousOctaves.size ? previousOctaves.has(oct) : true;
          const span = document.createElement("span");
          span.append(
            document.createTextNode(`${noteShortLabel(lo)}-${noteShortLabel(hi)}`),
            document.createElement("br"),
            document.createTextNode(String(oct))
          );
          label.append(input, span);
          detectOctaveCheckboxes.append(label);
        });
        detectOctaveFields.hidden = detectRangeSelect.value !== "custom";
        detectModal.removeAttribute("inert");
        detectModal.hidden = false;
        detectMicCheckStatus.textContent = "Check microphone access before starting.";
        detectMicCheckStatus.className = "detect-mic-check-status";
        detectMicCheckBtn.hidden = false;
        detectMicCheckBtn.disabled = false;
        detectStart.disabled = true;
        detectMicCheckBtn.focus();
      }

      detectRangeSelect.addEventListener("change", () => {
        detectOctaveFields.hidden = detectRangeSelect.value !== "custom";
      });

      function closeDetectModal(stopStream = true) {
        detectMicCheckAttempt++;
        detectModal.hidden = true;
        detectModal.setAttribute("inert", "");
        if (stopStream && detect.stream) {
          detect.stream.getTracks().forEach(track => track.stop());
          detect.stream = null;
        }
      }

      function ensureMicrophoneApiAvailable() {
        if (!window.isSecureContext) {
          throw new Error("Microphone access requires HTTPS or localhost.");
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("This browser does not support microphone access.");
        }
      }

      function microphoneErrorMessage(error) {
        switch (error.name) {
          case "NotAllowedError":
          case "SecurityError":
            return "Microphone permission was denied. Allow microphone access for this site in Chrome's site settings, then try again.";
          case "NotFoundError":
            return "No microphone was found on this device.";
          case "NotReadableError":
            return "The microphone is busy or unavailable. Close other apps using it and try again.";
          default:
            return error.message || "Microphone access was denied or unavailable.";
        }
      }

      function beginDetect() {
        const selectedPreset = detectRangePresets.find(preset => preset.value === detectRangeSelect.value);
        if (!selectedPreset) {
          detectMicCheckStatus.className = "detect-mic-check-status is-error";
          detectMicCheckStatus.textContent = "Choose a valid instrument range.";
          return;
        }
        const selectedOctaves = selectedPreset.custom
          ? [...detectOctaveCheckboxes.querySelectorAll("input[type=checkbox]:checked")]
            .map(input => Number(input.value))
          : [];
        if (selectedPreset.custom && selectedOctaves.length === 0) {
          detectMicCheckStatus.className = "detect-mic-check-status is-error";
          detectMicCheckStatus.textContent = "Select at least one octave.";
          detectOctaveCheckboxes.querySelector("input").focus();
          return;
        }

        const microphoneReady = detect.stream &&
          detect.stream.getAudioTracks().some(track => track.readyState === "live");
        if (!microphoneReady) {
          detectMicCheckStatus.className = "detect-mic-check-status is-error";
          detectMicCheckStatus.textContent = "Microphone access is no longer active. Check it again to start.";
          detectMicCheckBtn.hidden = false;
          detectMicCheckBtn.disabled = false;
          detectStart.disabled = true;
          detectMicCheckBtn.focus();
          return;
        }

        if (selectedPreset.custom) {
          const ranges = selectedOctaves.map(detectRangeForOctave);
          detect.octaves = selectedOctaves;
          detect.rangeLowMidi = Math.min(...ranges.map(range => range.lo));
          detect.rangeHighMidi = Math.max(...ranges.map(range => range.hi));
          detect.rangeDescription = selectedOctaveDescription(selectedOctaves);
        } else {
          detect.octaves = [];
          detect.rangeLowMidi = selectedPreset.low;
          detect.rangeHighMidi = selectedPreset.high;
          detect.rangeDescription = `${noteShortLabel(selectedPreset.low)}-${noteShortLabel(selectedPreset.high)}`;
        }
        closeDetectModal(false);
        startDetectSession();
        enableDetectMic();
      }

      // Audio capture constraints tuned for pitch detection: disable all
      // processing that would colour the signal and request a clean mono 44.1kHz
      // stream so low guitar/bass strings keep their fundamentals.
      const detectAudioConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Legacy Google/Chromium-specific options.
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          // Prevents Chrome from cutting low frequencies (crucial for bass).
          googHighpassFilter: false,
          // Performance optimization for pitch detection.
          channelCount: 1,
          sampleRate: 44100
        },
        video: false
      };

      async function checkDetectMicrophone() {
        const attempt = ++detectMicCheckAttempt;
        detectMicCheckBtn.disabled = true;
        detectMicCheckStatus.className = "detect-mic-check-status";
        detectMicCheckStatus.textContent = "Requesting microphone access…";

        try {
          ensureMicrophoneApiAvailable();
          const stream = await navigator.mediaDevices.getUserMedia(detectAudioConstraints);
          if (attempt !== detectMicCheckAttempt) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          if (!stream.getAudioTracks().some(track => track.readyState === "live")) {
            stream.getTracks().forEach(track => track.stop());
            throw new Error("No active microphone track was found.");
          }
          detect.stream = stream;
          detectMicCheckStatus.classList.add("is-ready");
          detectMicCheckStatus.textContent = "✓ Microphone is ready. Start when you are ready.";
          detectMicCheckBtn.hidden = true;
          detectStart.disabled = false;
          detectStart.focus();
        } catch (error) {
          if (attempt !== detectMicCheckAttempt) return;
          console.error("Microphone check failed:", error);
          detectMicCheckStatus.classList.add("is-error");
          detectMicCheckStatus.textContent = microphoneErrorMessage(error);
          detectMicCheckBtn.disabled = false;
          detectMicCheckBtn.focus();
        }
      }

      function startDetectSession() {
        activeMode = "detect";
        detect.active = true;
        detectMicBtn.hidden = false;
        detectMicBtn.disabled = false;
        detectMicBtn.textContent = "Enable microphone";
        detectMicIndicator.hidden = true;
        detect.correctCount = 0;
        detect.incorrectCount = 0;
        detect.questions = 0;
        detect.locked = false;
        detect.lastHandledMidi = null;
        detectTarget.textContent = "-";
        detectReadoutNote.textContent = "-";
        detectReadoutFrequency.textContent = "- Hz";
        detectBarFill.style.width = "0%";
        detectFeedback.textContent = "";
        detectFeedback.className = "feedback detect-feedback";
        detectCorrectCount.textContent = "0";
        detectIncorrectCount.textContent = "0";
        detectQuestionCount.textContent = "0";
        detectModeName.textContent = modes.detect.name;

        homeScreen.hidden = true;
        detectScreen.hidden = false;
        app.classList.add("is-playing");

        detect.startedAt = Date.now();
        clearInterval(detect.timerInterval);
        detect.timerInterval = setInterval(() => {
          detectTimer.textContent = formatTime(Math.floor((Date.now() - detect.startedAt) / 1000));
        }, 1000);

        generateDetectTarget();
      }

      function selectedOctaveDescription(octaveSelection = detect.octaves) {
        const octaves = [...new Set(octaveSelection)].sort((a, b) => a - b);
        const ranges = [];
        let start = octaves[0];
        let end = start;

        for (const octave of octaves.slice(1)) {
          if (octave === end + 1) {
            end = octave;
          } else {
            ranges.push(start === end ? `octave ${start}` : `octaves ${start}-${end}`);
            start = end = octave;
          }
        }

        if (start !== undefined) {
          ranges.push(start === end ? `octave ${start}` : `octaves ${start}-${end}`);
        }
        return ranges.join(" and ");
      }

      function generateDetectTarget() {
        detectPitchTracker.reset();
        const candidates = [];
        if (detect.octaves.length) {
          detect.octaves.forEach(oct => {
            const { lo, hi } = detectRangeForOctave(oct);
            for (let m = lo; m <= hi; m++) candidates.push(m);
          });
        } else {
          for (let midi = detect.rangeLowMidi; midi <= detect.rangeHighMidi; midi++) {
            candidates.push(midi);
          }
        }
        let pick = candidates[randomInt(0, candidates.length - 1)];
        if (candidates.length > 1 && detect.target) {
          let guard = 0;
          while (pick === detect.target.midi && guard++ < 20) {
            pick = candidates[randomInt(0, candidates.length - 1)];
          }
        }
        detect.target = pitchFromMidi(pick);
        detect.locked = false;
        detect.lastHandledMidi = null;
        detect.stableMidi = null;
        detect.stableSince = null;
        detect.stableLastSeenAt = null;
        detect.smoothedMidi = null;

        detectTarget.textContent = noteShortLabel(pick);
        detectTarget.classList.remove("hit");
        detectReadoutNote.textContent = "-";
        detectReadoutFrequency.textContent = "- Hz";
        detectReadCopy.textContent = "Play the target note to lock it in.";
        detectBarFill.style.width = "0%";
        detectFeedback.textContent = "";
        detectFeedback.className = "feedback detect-feedback";

        detect.questions++;
        detectQuestionCount.textContent = String(detect.questions);

        setMicStatus(detect.micEnabled
          ? `Listening… pluck the target note within ${detect.rangeDescription}.`
          : "Enable the microphone to play.");
      }

      function setMicStatus(text) {
        if (detectMicStatus) detectMicStatus.textContent = text;
      }

      async function enableDetectMic() {
        if (detect.micEnabled || !detect.active) return;
        try {
          ensureMicrophoneApiAvailable();
        } catch (error) {
          setMicStatus(microphoneErrorMessage(error));
          detectFeedback.textContent = "Microphone unavailable here.";
          detectFeedback.className = "feedback detect-feedback is-wrong";
          return;
        }
        try {
          const hasLiveTrack = detect.stream &&
            detect.stream.getAudioTracks().some(track => track.readyState === "live");
          if (!hasLiveTrack) {
            detect.stream = await navigator.mediaDevices.getUserMedia(detectAudioConstraints);
          }
          const Ctor = window.AudioContext || window.webkitAudioContext;
          detect.audioContext = new Ctor();
          const source = detect.audioContext.createMediaStreamSource(detect.stream);
          const analyser = detect.audioContext.createAnalyser();
          analyser.fftSize = 8192;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);
          detect.analyser = analyser;
          detect.inputBuffer = new Float32Array(analyser.fftSize);
          detect.lastPitchCheckAt = 0;
          detect.micEnabled = true;
          detectMicBtn.hidden = true;
          detectMicIndicator.hidden = false;
          setMicStatus(`Listening… pluck the target note within ${detect.rangeDescription}.`);
          const tick = () => {
            if (!detect.active) return;
            if (detect.micEnabled && detect.analyser) detectPitchTick();
            detect.rafId = requestAnimationFrame(tick);
          };
          detect.rafId = requestAnimationFrame(tick);
        } catch (error) {
          console.error("Could not start microphone input:", error);
          setMicStatus(microphoneErrorMessage(error));
          detectFeedback.textContent = "Microphone access was denied or unavailable.";
          detectFeedback.className = "feedback detect-feedback is-wrong";
        }
      }

      // Estimate the fundamental frequency (Hz) using autocorrelation. Returns null when the signal is too weak.
      function detectPitchFrequency() {
        detect.analyser.getFloatTimeDomainData(detect.inputBuffer);
        return detectPitchTracker.getPitch(detect.inputBuffer, detect.audioContext.sampleRate, {
          minFrequency: frequencyForMidi(Math.max(0, detect.rangeLowMidi - 1)),
          maxFrequency: frequencyForMidi(detect.rangeHighMidi + 1)
        });
      }

      function midiValueFromFrequency(freq) {
        return 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
      }

      function midiFromFrequency(freq) {
        return Math.round(midiValueFromFrequency(freq));
      }

      function updateDetectReadout(freq) {
        if (freq === null || freq <= 0) {
          detectReadoutNote.textContent = "-";
          detectReadoutFrequency.textContent = "- Hz";
          detectBarFill.style.width = "0%";
          return;
        }
        detectReadoutNote.textContent = noteShortLabel(midiFromFrequency(freq));
        detectReadoutFrequency.textContent = `${Math.round(freq)} Hz`;
        const minFreq = frequencyForMidi(detect.rangeLowMidi);
        const maxFreq = frequencyForMidi(detect.rangeHighMidi);
        const norm = Math.max(0, Math.min(1, (freq - minFreq) / (maxFreq - minFreq)));
        detectBarFill.style.width = `${Math.round(norm * 100)}%`;
      }

      function detectPitchTick() {
        const now = performance.now();
        if (now - detect.lastPitchCheckAt < 80) return;
        detect.lastPitchCheckAt = now;
        const freq = detectPitchFrequency();
        if (freq === null) {
          updateDetectReadout(null);
          detect.stableMidi = null;
          detect.stableSince = null;
          detect.stableLastSeenAt = null;
          detect.smoothedMidi = null;
          return;
        }
        const rawMidi = midiValueFromFrequency(freq);
        detect.smoothedMidi = detect.smoothedMidi === null
          ? rawMidi
          : detect.smoothedMidi + DETECT_PITCH_SMOOTHING * (rawMidi - detect.smoothedMidi);
        const smoothedFrequency = 440 * Math.pow(2, (detect.smoothedMidi - 69) / 12);
        updateDetectReadout(smoothedFrequency);
        const midi = Math.round(detect.smoothedMidi);
        if (detect.locked) return;

        if (detect.stableMidi !== midi ||
            detect.stableLastSeenAt === null ||
            now - detect.stableLastSeenAt > DETECT_MAX_SAMPLE_GAP_MS) {
          detect.stableMidi = midi;
          detect.stableSince = now;
        }
        detect.stableLastSeenAt = now;
        if (now - detect.stableSince < DETECT_PITCH_CONFIRMATION_MS) return;

        if (midi === detect.target.midi) {
          handleDetectHit(midi);
        } else if (detect.lastHandledMidi !== midi) {
          handleDetectMiss(midi);
          detect.lastHandledMidi = midi;
        }
        detect.stableMidi = null;
        detect.stableSince = null;
        detect.stableLastSeenAt = null;
        detect.smoothedMidi = null;
      }

      function handleDetectHit() {
        detect.locked = true;
        detect.correctCount++;
        detectCorrectCount.textContent = String(detect.correctCount);
        detectReadCopy.textContent = "Got it! Play the next note below.";
        detectBarFill.style.width = "100%";

        const hertz = Math.round(frequencyForMidi(detect.target.midi));
        detectFeedback.textContent = `That's right - ${noteShortLabel(detect.target.midi)} (${hertz} Hz). Nice ear!`;
        detectFeedback.className = "feedback detect-feedback is-correct";
        detectTarget.classList.add("hit");

        setTimeout(() => {
          if (detect.active && !detectScreen.hidden) generateDetectTarget();
        }, 1200);
      }

      function handleDetectMiss(midi) {
        detect.incorrectCount++;
        detectIncorrectCount.textContent = String(detect.incorrectCount);
        const heard = noteShortLabel(midi);
        detectReadCopy.textContent = `Heard ${heard} - keep trying the target.`;
        detectFeedback.textContent = `That was ${heard}, not ${noteShortLabel(detect.target.midi)}. Try again!`;
        detectFeedback.className = "feedback detect-feedback is-wrong";
        detectReadout.classList.add("miss");
        setTimeout(() => detectReadout.classList.remove("miss"), 400);

        // Signal the error on the target note too, then revert it - the same
        // note stays up until the player plays it correctly.
        detectTarget.classList.add("shake");
        setTimeout(() => detectTarget.classList.remove("shake"), 450);
      }

      function skipDetectTarget() {
        if (!detect.active || detect.locked || !detect.target) return;

        detect.locked = true;
        detect.incorrectCount++;
        detectIncorrectCount.textContent = String(detect.incorrectCount);
        detectReadCopy.textContent = "Skipped. Moving to the next note.";
        detectFeedback.textContent = `Skipped ${noteShortLabel(detect.target.midi)}. Counted as incorrect.`;
        detectFeedback.className = "feedback detect-feedback is-wrong";
        detectTarget.classList.add("shake");
        setTimeout(() => detectTarget.classList.remove("shake"), 450);
        setTimeout(() => {
          if (detect.active && !detectScreen.hidden) generateDetectTarget();
        }, 1200);
      }

      function stopDetectSession() {
        detect.active = false;
        if (detect.rafId) {
          cancelAnimationFrame(detect.rafId);
          detect.rafId = null;
        }
        if (detect.stream) {
          detect.stream.getTracks().forEach(track => track.stop());
          detect.stream = null;
        }
        if (detect.audioContext) {
          detect.audioContext.close();
          detect.audioContext = null;
        }
        clearInterval(detect.timerInterval);
        detect.timerInterval = null;
        detect.analyser = null;
        detect.inputBuffer = null;
        detectPitchTracker.reset();
        detect.micEnabled = false;
        detect.locked = false;
        detect.target = null;
        detect.stableMidi = null;
        detect.stableSince = null;
        detect.stableLastSeenAt = null;
        detect.smoothedMidi = null;
        detect.lastHandledMidi = null;

        detectMicBtn.textContent = "Enable microphone";
        detectMicBtn.disabled = false;
        detectMicBtn.hidden = false;
        detectMicIndicator.hidden = true;

        detectScreen.hidden = true;
        homeScreen.hidden = false;
        app.classList.remove("is-playing");
        activeMode = null;
      }

      // ---- Read the staff (treble clef) ----

      const READ_LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
      const READ_LOW_MIDI = 60 - 2;  // 60 is C4 (middle C) - one ledger line below the staff
      const READ_HIGH_MIDI = 77 + 5; // 77 is F5 (top line of the treble staff)

      // Diatonic position of a note's letter as half-staff-gaps from the bottom
      // line (E4 = 0). Lines sit on integers, spaces on half-integers.
      function readLetterHalfSpace(letter, octave) {
        const diIndex = READ_LETTER_INDEX[letter] + 7 * (octave - 1); // E4 = 23
        return (diIndex - 23) * 0.5;
      }

      // Fixed vector paths keep accidentals consistent across system fonts.
      function readAccidentalPath(accidental) {
        if (accidental === "sharp") {
          return "M6.42 28.98L12.79 25.59L12.79 18.95L15.31 18.95L15.31 24.24L19.21 22.17L19.21 25.88L15.31 27.95L15.31 38.84L19.21 36.77L19.21 40.48L15.31 42.55L15.31 49.73L12.79 49.73L12.79 43.90L6.42 47.29L6.42 53.96L3.91 53.96L3.91 48.63L0 50.71L0 47.00L3.91 44.92L3.91 34.03L0 36.11L0 32.40L3.91 30.32L3.91 23.73L6.42 23.73L6.42 28.98M6.42 43.58L12.79 40.19L12.79 29.30L6.42 32.69L6.42 43.58Z";
        }
        if (accidental === "flat") {
          return "M14.45 43.85Q14.45 45.83 13.82 47.33Q13.18 48.83 12.12 49.95Q11.06 51.07 9.68 51.84Q8.30 52.61 6.80 53.08Q5.30 53.54 3.78 53.75Q2.27 53.96 0.93 53.96L0 53.96L0 18.95L2.51 18.95L2.51 39.60Q3.88 38.38 5.32 37.68Q6.76 36.99 8.69 36.99Q10.08 36.99 11.16 37.49Q12.23 37.99 12.96 38.89Q13.70 39.79 14.07 41.06Q14.45 42.33 14.45 43.85M2.51 52.64Q4.44 52.44 5.90 51.70Q7.35 50.95 8.31 49.79Q9.28 48.63 9.75 47.12Q10.23 45.61 10.23 43.85Q10.23 42.92 10.01 42.10Q9.79 41.28 9.34 40.69Q8.89 40.09 8.20 39.73Q7.52 39.38 6.59 39.38Q5.47 39.38 4.46 39.86Q3.44 40.33 2.51 41.06L2.51 52.64Z";
        }
        return null;
      }

      // Build the treble-staff SVG with a G clef and the requested note.
      function buildReadStaffSVG(midi, def) {
        const octave = Math.floor(midi / 12) - 1;
        const halfSpace = readLetterHalfSpace(def.letter, octave);

        const gap = 11;              // px between adjacent staff lines
        const staffTop = 20;         // y of the top (5th) line
        const staffBottom = staffTop + gap * 4;
        const staffLeft = 0;         // x where the 5 lines start (at the origin)
        const staffRight = staffLeft + 96;

        // Notehead centre. halfSpace is measured from the BOTTOM line, so:
        const noteX = staffLeft + 72;
        const noteY = staffBottom - halfSpace * gap;

        const lines = [];
        for (let i = 0; i < 5; i++) {
          const y = staffTop + i * gap;
          lines.push(`<line x1="${staffLeft}" y1="${y}" x2="${staffRight}" y2="${y}"/>`);
        }

        // Ledger lines below/above the staff. Draw a line for every staff-line
        // position from the first ledger up to (and including) the note's line,
        // so notes resting in spaces also show the line beneath them. The two
        // lowest and two highest notes in range skip their outermost line.
        const ledgerSVG = [];
        const lowLedger = Math.floor(halfSpace);
        console.log();
        const suppressBottomLine =
          (midi === READ_LOW_MIDI && def.accidental === "flat") ||
          (midi === READ_LOW_MIDI + 3 && def.accidental === "flat") ||
          (midi === READ_LOW_MIDI + 4) ||
          (midi === READ_LOW_MIDI + 5 && def.accidental === "sharp");
        const suppressTopLine =
          (midi === READ_HIGH_MIDI && def.accidental === "flat") ||
          (midi === READ_HIGH_MIDI - 2 && def.accidental === "sharp") ||
          (midi === READ_HIGH_MIDI - 3) ||
          (midi === READ_HIGH_MIDI - 4 && def.accidental === "flat");
        if (lowLedger < 0) {
          for (let pos = -1; pos >= lowLedger; pos--) {
            if (suppressBottomLine && pos === lowLedger) continue;
            ledgerSVG.push(readLedgerLine(staffLeft + 48, staffBottom - pos * gap));
          }
        } else if (halfSpace > 4) {
          for (let pos = 5; pos <= Math.ceil(halfSpace); pos++) {
            if (suppressTopLine && pos === Math.ceil(halfSpace)) continue;
            ledgerSVG.push(readLedgerLine(staffLeft + 48, staffTop - (pos - 4) * gap));
          }
        }

        // The accidental (♯/♭) sits just to the left of the notehead, aligned
        // with the note's y position.
        const acc = readAccidentalPath(def.accidental);
        const sharpYOffset = 7;
        const flatYOffset = 5;
        const accidentalYOffset = def.accidental === "flat"
          ? flatYOffset
          : sharpYOffset;
        const accidentalScale = 0.65;
        const accidentalBaseline = noteY + accidentalYOffset;
        const accidentalTop = accidentalBaseline - (53.96 - 18.95) * accidentalScale;
        const accSVG = acc
          ? `<path class="read-accidental" transform="translate(${noteX - 20} ${accidentalTop}) scale(${accidentalScale}) translate(0 -18.95)" d="${acc}"/>`
          : "";

        const notehead = `<ellipse class="read-notehead" cx="${noteX}" cy="${noteY}" rx="7" ry="5.2" transform="rotate(-18 ${noteX} ${noteY})"/>`;

        // Anchor the clef's lower curl to the bottom E line using staff
        // coordinates, rather than a font-dependent text baseline.
        const clefX = staffLeft + 5;
        const clefTop = staffTop - gap;

        // Size the viewBox (anchored at 0,0) to the rightmost and bottommost
        // rendered content: staff + ledger lines, notehead, accidental when
        // present, and the treble clef.
        const noteBottom = noteY + 7;
        const accBottom = acc ? accidentalBaseline : -Infinity;
        const vbW = Math.max(staffRight, noteX + 7, acc ? noteX - 20 + 16 : 0) + 4;
        const vbH = Math.max(staffBottom, noteBottom, accBottom) + 4;

        const svg =
          `<svg class="read-staff" viewBox="0 0 ${vbW} ${vbH}" width="100%" data-zoom="1" role="button" tabindex="0" aria-label="Treble staff showing ${def.name}${octave}. Activate to zoom.">
            ${lines.join("")}
            ${ledgerSVG.join("")}
            ${readTrebleClef(clefX, clefTop, staffBottom - clefTop)}
            ${accSVG}
            ${notehead}
          </svg>`;

        return svg;
      }

      function readLedgerLine(x, y) {
        const half = 15;
        return `<line class="read-ledger" x1="${x - half}" y1="${y}" x2="${x + 26 + half}" y2="${y}"/>`;
      }

      // Draw the treble clef as vector geometry so its shape and alignment
      // don't depend on the platform's installed music fonts.
      function readTrebleClef(x, top, height) {
        const scale = height / (9674 - 5608) * 1.35;
        const translateX = x - 1186 * scale;
        const translateY = top - 5608 * scale - 2;
        return `<path class="read-clef-path"
          transform="translate(${translateX} ${translateY}) scale(${scale})"
          d="M 2002,7851 C 1941,7868 1886,7906 1835,7964 C 1784,8023 1759,8088 1759,8158 C 1759,8202 1774,8252 1803,8305 C 1832,8359 1876,8398 1933,8423 C 1952,8427 1961,8437 1961,8451 C 1961,8456 1954,8461 1937,8465 C 1846,8442 1771,8393 1713,8320 C 1655,8246 1625,8162 1623,8066 C 1626,7963 1657,7867 1716,7779 C 1776,7690 1853,7627 1947,7590 L 1878,7235 C 1724,7363 1599,7496 1502,7636 C 1405,7775 1355,7926 1351,8089 C 1353,8162 1368,8233 1396,8301 C 1424,8370 1466,8432 1522,8489 C 1635,8602 1782,8661 1961,8667 C 2022,8663 2087,8652 2157,8634 L 2002,7851 z M 2074,7841 L 2230,8610 C 2384,8548 2461,8413 2461,8207 C 2452,8138 2432,8076 2398,8021 C 2365,7965 2321,7921 2265,7889 C 2209,7857 2146,7841 2074,7841 z M 1869,6801 C 1902,6781 1940,6746 1981,6697 C 2022,6649 2062,6592 2100,6528 C 2139,6463 2170,6397 2193,6330 C 2216,6264 2227,6201 2227,6143 C 2227,6118 2225,6093 2220,6071 C 2216,6035 2205,6007 2186,5988 C 2167,5970 2143,5960 2113,5960 C 2053,5960 1999,5997 1951,6071 C 1914,6135 1883,6211 1861,6297 C 1838,6384 1825,6470 1823,6557 C 1828,6656 1844,6737 1869,6801 z M 1806,6859 C 1761,6697 1736,6532 1731,6364 C 1732,6256 1743,6155 1764,6061 C 1784,5967 1813,5886 1851,5816 C 1888,5746 1931,5693 1979,5657 C 2022,5625 2053,5608 2070,5608 C 2083,5608 2094,5613 2104,5622 C 2114,5631 2127,5646 2143,5666 C 2262,5835 2322,6039 2322,6277 C 2322,6390 2307,6500 2277,6610 C 2248,6719 2205,6823 2148,6920 C 2090,7018 2022,7103 1943,7176 L 2024,7570 C 2068,7565 2098,7561 2115,7561 C 2191,7561 2259,7577 2322,7609 C 2385,7641 2439,7684 2483,7739 C 2527,7793 2561,7855 2585,7925 C 2608,7995 2621,8068 2621,8144 C 2621,8262 2590,8370 2528,8467 C 2466,8564 2373,8635 2248,8681 C 2256,8730 2270,8801 2291,8892 C 2311,8984 2326,9057 2336,9111 C 2346,9165 2350,9217 2350,9268 C 2350,9347 2331,9417 2293,9479 C 2254,9541 2202,9589 2136,9623 C 2071,9657 1999,9674 1921,9674 C 1811,9674 1715,9643 1633,9582 C 1551,9520 1507,9437 1503,9331 C 1506,9284 1517,9240 1537,9198 C 1557,9156 1584,9122 1619,9096 C 1653,9069 1694,9055 1741,9052 C 1780,9052 1817,9063 1852,9084 C 1886,9106 1914,9135 1935,9172 C 1955,9209 1966,9250 1966,9294 C 1966,9353 1946,9403 1906,9444 C 1866,9485 1815,9506 1754,9506 L 1731,9506 C 1770,9566 1834,9597 1923,9597 C 1968,9597 2014,9587 2060,9569 C 2107,9550 2146,9525 2179,9493 C 2212,9461 2234,9427 2243,9391 C 2260,9350 2268,9293 2268,9222 C 2268,9174 2263,9126 2254,9078 C 2245,9031 2231,8968 2212,8890 C 2193,8813 2179,8753 2171,8712 C 2111,8727 2049,8735 1984,8735 C 1875,8735 1772,8713 1675,8668 C 1578,8623 1493,8561 1419,8481 C 1346,8401 1289,8311 1248,8209 C 1208,8108 1187,8002 1186,7892 C 1190,7790 1209,7692 1245,7600 C 1281,7507 1327,7419 1384,7337 C 1441,7255 1500,7180 1561,7113 C 1623,7047 1704,6962 1806,6859 z"/>`;
      }

      function readRenderStaff() {
        const q = read.currentQuestion;
        readStaffWrap.innerHTML = buildReadStaffSVG(q.note.midi, q.def);
        const staffSvg = readStaffWrap.querySelector(".read-staff");
        const cycleZoom = () => {
          const currentZoom = Number(staffSvg.dataset.zoom);
          const nextZoom = currentZoom >= 3
            ? 1
            : Number((currentZoom + 0.25).toFixed(2));
          staffSvg.dataset.zoom = String(nextZoom);
          staffSvg.style.setProperty("--staff-zoom", String(nextZoom));
        };
        staffSvg.addEventListener("click", cycleZoom);
        staffSvg.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          cycleZoom();
        });
      }

      function readMakeQuestion() {
        // ---- Debug override: set FORCE_MIDI to a note (60..77) and
        // FORCE_ACCIDENTAL to "natural", "sharp" or "flat" to pin the question.
        const FORCE_MIDI = null;              // e.g. 63
        const FORCE_ACCIDENTAL = null;        // "natural" | "sharp" | "flat"

        let midi = randomInt(READ_LOW_MIDI, READ_HIGH_MIDI);
        let def = null;
        if (FORCE_MIDI != null) {
          midi = FORCE_MIDI;
          const forceType = FORCE_ACCIDENTAL
            ? (FORCE_ACCIDENTAL === "natural" ? "nat" : FORCE_ACCIDENTAL)
            : null;
          const matching = readStaffDefs().filter(
            d => d.midi === midi % 12 && (forceType == null || d.accidental === forceType)
          );
          def = matching[0] ||
            readSpellingDefs(midi)[0] ||
            readStaffDefs().find(d => d.midi === midi % 12);
        } else {
          const candidates = readSpellingDefs(midi);
          def = candidates[randomInt(0, candidates.length - 1)];
        }
        const note = pitchFromMidi(midi);
        const currentName = def.name;
        const others = readStaffDefs()
          .map(d => d.name)
          .filter(name => name !== currentName);
        const distractors = shuffle(others).slice(0, 7);
        const choices = shuffle([currentName, ...distractors]);
        const answer = currentName;

        read.currentQuestion = { note, choices, answer, def };
        read.answered = false;
        readFeedback.textContent = "";
        readFeedback.className = "feedback";
        readNextButton.hidden = true;
        readAnswerGrid.replaceChildren();

        choices.forEach(name => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "answer-button";
          button.textContent = name;
          button.dataset.answer = name;
          button.addEventListener("click", () => readSubmitAnswer(button));
          readAnswerGrid.append(button);
        });

        readRenderStaff();

        read.questions++;
        readQuestionCount.textContent = String(read.questions);
      }

      function readStartSession(notation) {
        activeMode = "read";
        activeNotation = (notation === "solfege") ? "solfege" : "letters";
        read.active = true;
        read.correctCount = 0;
        read.incorrectCount = 0;
        read.questions = 0;
        readCorrectCount.textContent = "0";
        readIncorrectCount.textContent = "0";
        readQuestionCount.textContent = "0";
        readTimer.textContent = "00:00";
        readFeedback.textContent = "";
        readFeedback.className = "feedback";
        readNextButton.hidden = true;
        readModeName.textContent = modes.read.name;

        homeScreen.hidden = true;
        readScreen.hidden = false;
        app.classList.add("is-playing");

        read.startedAt = Date.now();
        clearInterval(read.timerInterval);
        read.timerInterval = setInterval(() => {
          readTimer.textContent = formatTime(Math.floor((Date.now() - read.startedAt) / 1000));
        }, 1000);

        readMakeQuestion();
        clearTimeout(read.playTimer);
        read.playTimer = setTimeout(readPlayNote, settings.entryDelay);
      }

      function readStopSession() {
        read.active = false;
        clearInterval(read.timerInterval);
        read.timerInterval = null;
        clearTimeout(read.playTimer);
        read.playTimer = null;
        read.currentQuestion = null;
        readScreen.hidden = true;
        homeScreen.hidden = false;
        app.classList.remove("is-playing");
        activeMode = null;
      }

      async function readPlayNote() {
        const context = await getAudioContext();
        if (!context || !read.currentQuestion || !read.active) return;
        const question = read.currentQuestion;
        const midi = question.note.midi;

        if (readSoundOrb.classList.contains("is-playing")) {
          readSoundOrb.classList.remove("is-playing");
          void readSoundOrb.offsetWidth;
        }
        readSoundOrb.classList.add("is-playing");

        if (!usesSamples) {
          synthNote(context, midi, context.currentTime + 0.02, readSoundOrb);
          return;
        }

        let buffers;
        try {
          buffers = await loadPianoSamples(context);
        } catch (error) {
          if (read.currentQuestion !== question || !read.active) return;
          console.error("Failed to load piano samples:", error);
          readFeedback.textContent = "Could not load the piano WAVs. Make sure C2.wav-C7.wav are in the project root.";
          readFeedback.className = "feedback is-wrong";
          return;
        }

        if (read.currentQuestion !== question || !read.active) return;
        const sample = nearestPianoSample(midi);
        playSampleNote(context, midi, buffers.get(sample.midi), readSoundOrb);
      }

      function readSubmitAnswer(button) {
        if (read.answered) return;
        read.answered = true;
        const isCorrect = button.dataset.answer === read.currentQuestion.answer;
        const rightAnswer = read.currentQuestion.answer;
        const hertz = Math.round(frequencyForMidi(read.currentQuestion.note.midi));

        if (isCorrect) {
          read.correctCount++;
          readCorrectCount.textContent = String(read.correctCount);
          readFeedback.innerHTML = `That's right - <b>${rightAnswer} (${hertz} Hz)</b>. Nice read!`;
          readFeedback.classList.add("is-correct");
          button.classList.add("is-correct");
        } else {
          read.incorrectCount++;
          readIncorrectCount.textContent = String(read.incorrectCount);
          readFeedback.innerHTML = `Not quite - the note was <b>${rightAnswer} (${hertz} Hz)</b>.`;
          readFeedback.classList.add("is-wrong");
          button.classList.add("is-wrong");
          const correctButton = [...readAnswerGrid.children].find(
            option => option.dataset.answer === read.currentQuestion.answer
          );
          if (correctButton) correctButton.classList.add("is-correct");
        }

        readAnswerGrid.querySelectorAll("button").forEach(option => { option.disabled = true; });
        readNextButton.hidden = false;
        readNextButton.focus();
      }

      function readNextQuestion() {
        if (!read.active) return;
        readMakeQuestion();
        readPlayNote();
      }

      document.querySelector("#read-back-button").addEventListener("click", readStopSession);
      document.querySelector("#read-play-button").addEventListener("click", readPlayNote);
      readNextButton.addEventListener("click", readNextQuestion);

      // ---- End Read the staff ----

      // Wire the live detection controls.
      detectStart.addEventListener("click", beginDetect);
      detectModal.querySelectorAll("[data-detect-close]").forEach(el => {
        el.addEventListener("click", closeDetectModal);
      });
      detectMicCheckBtn.addEventListener("click", checkDetectMicrophone);
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !detectModal.hidden) closeDetectModal();
      });
      detectMicBtn.addEventListener("click", enableDetectMic);
      detectSkipBtn.addEventListener("click", skipDetectTarget);
      document.querySelector("#detect-back-button").addEventListener("click", stopDetectSession);

      function updateCarouselIndicators() {
        if (!window.matchMedia("(max-width: 460px)").matches) return;

        const gridRect = modeGrid.getBoundingClientRect();
        const inset = parseFloat(getComputedStyle(modeGrid).scrollPaddingLeft) || 0;
        const snapEdge = gridRect.left + inset;
        let activeIndex = 0;
        let closestDistance = Infinity;

        modeCards.forEach((card, index) => {
          const distance = Math.abs(card.getBoundingClientRect().left - snapEdge);
          if (distance < closestDistance) {
            closestDistance = distance;
            activeIndex = index;
          }
        });

        carouselIndicators.forEach((indicator, index) => {
          indicator.setAttribute("aria-pressed", String(index === activeIndex));
        });
      }

      let carouselUpdateFrame = null;
      modeGrid.addEventListener("scroll", () => {
        if (carouselUpdateFrame !== null) cancelAnimationFrame(carouselUpdateFrame);
        carouselUpdateFrame = requestAnimationFrame(() => {
          carouselUpdateFrame = null;
          updateCarouselIndicators();
        });
      }, { passive: true });

      carouselIndicators.forEach(indicator => {
        indicator.addEventListener("click", () => {
          const card = modeCards[Number(indicator.dataset.carouselIndex)];
          if (!card) return;
          const gridRect = modeGrid.getBoundingClientRect();
          const inset = parseFloat(getComputedStyle(modeGrid).scrollPaddingLeft) || 0;
          const left = modeGrid.scrollLeft + card.getBoundingClientRect().left - gridRect.left - inset;
          modeGrid.scrollTo({ left, behavior: "smooth" });
        });
      });

      window.addEventListener("resize", updateCarouselIndicators);
      updateCarouselIndicators();

      document.querySelectorAll("[data-mode]").forEach(button => {
        button.addEventListener("click", () => {
          const mode = button.dataset.mode;
          if (mode === "note" || mode === "full") {
            openOctaveModal(mode);
          } else if (mode === "detect") {
            openDetectModal();
          } else if (mode === "read") {
          openOctaveModal("read");
          } else {
            startSession(mode);
          }
        });
      });
      octaveStart.addEventListener("click", beginGame);
      octaveModal.querySelectorAll("[data-modal-close]").forEach(el => {
        el.addEventListener("click", closeOctaveModal);
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !octaveModal.hidden) closeOctaveModal();
      });
      document.querySelector("#back-button").addEventListener("click", stopSession);
      document.querySelector(".brand").addEventListener("click", event => {
        event.preventDefault();
        if (activeMode === "detect") stopDetectSession();
        else if (activeMode === "read") readStopSession();
        else if (activeMode) stopSession();
      });
      document.querySelector("#play-button").addEventListener("click", playNote);
      nextButton.addEventListener("click", nextQuestion);

      function applyTheme(theme) {
        if (theme === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
          themeToggle.setAttribute("aria-pressed", "true");
        } else {
          document.documentElement.removeAttribute("data-theme");
          themeToggle.setAttribute("aria-pressed", "false");
        }
      }

      themeToggle.addEventListener("click", () => {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        applyTheme(dark ? "light" : "dark");
      });

      function nextQuestion() {
        if (!activeMode) return;
        makeQuestion();
        playNote();
      }
    })();
