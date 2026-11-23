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
        }
      };

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
      const detectMicStatus = document.querySelector("#detect-mic-status");
      const detectReadout = document.querySelector("#detect-readout");
      const detectReadCopy = document.querySelector("#detect-read-copy");
      const detectBarFill = document.querySelector("#detect-bar-fill");
      const detectFeedback = document.querySelector("#detect-feedback");
      const detectTimer = document.querySelector("#detect-timer");
      const detectCorrectCount = document.querySelector("#detect-correct-count");
      const detectIncorrectCount = document.querySelector("#detect-incorrect-count");
      const detectQuestionCount = document.querySelector("#detect-question-count");
      const detectModal = document.querySelector("#detect-modal");
      const detectMicCheckStatus = document.querySelector("#detect-mic-check-status");
      const detectMicCheckBtn = document.querySelector("#detect-mic-check");
      const detectOctaveCheckboxes = document.querySelector("#detect-octave-checkboxes");
      const detectStart = document.querySelector("#detect-start");

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
        rafId: null,
        micEnabled: false,
        stableMidi: null,
        stableSince: null,
        stableLastSeenAt: null,
        smoothedMidi: null,
        locked: false
      };
      let detectMicCheckAttempt = 0;
      // Detectable note range: E2 (MIDI 40) to E5 (MIDI 76).
      const DETECT_LOW_MIDI = 40;
      const DETECT_HIGH_MIDI = 76;
      const DETECT_PITCH_CONFIRMATION_MS = 500;
      const DETECT_MAX_SAMPLE_GAP_MS = 250;
      const DETECT_PITCH_SMOOTHING = 0.25;
      const DETECT_AUTOCORRELATION_THRESHOLD = 0.8;

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
      function synthNote(context, midi, start) {
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
        audioStopTimer = setTimeout(() => soundOrb.classList.remove("is-playing"), 1450);
      }

      function playSampleNote(context, midi, url) {
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
            soundOrb.classList.remove("is-playing");
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
        if (mode === "full") {
          octaveModalKicker.textContent = "03 / THE FULL PICTURE";
          octaveModalTitle.textContent = "Note & octave";
          octaveModalCopy.textContent = "Pick the note names to use.";
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
        // Wait until the browser has painted the modal before focusing the select.
        requestAnimationFrame(() => octaveSelect.focus());
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
        startSession(mode, octave, noteCount, notation);
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

      function openDetectModal() {
        detectOctaveCheckboxes.replaceChildren();
        [2, 3, 4, 5].forEach(oct => {
          const { lo, hi } = detectRangeForOctave(oct);
          const label = document.createElement("label");
          label.className = "octave-check";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = String(oct);
          input.checked = true;
          const span = document.createElement("span");
          span.textContent = `Octave ${oct}  ·  ${noteShortLabel(lo)}-${noteShortLabel(hi)}`;
          label.append(input, span);
          detectOctaveCheckboxes.append(label);
        });
        detectModal.removeAttribute("inert");
        detectModal.hidden = false;
        detectMicCheckStatus.textContent = "Check microphone access before starting.";
        detectMicCheckStatus.className = "detect-mic-check-status";
        detectMicCheckBtn.hidden = false;
        detectMicCheckBtn.disabled = false;
        detectStart.disabled = true;
        detectMicCheckBtn.focus();
      }

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

        const checked = [...detectOctaveCheckboxes.querySelectorAll("input[type=checkbox]:checked")]
          .map(input => Number(input.value));
        closeDetectModal(false);
        detect.octaves = checked.length ? checked : [2, 3, 4, 5];
        startDetectSession();
        enableDetectMic();
      }

      async function checkDetectMicrophone() {
        const attempt = ++detectMicCheckAttempt;
        detectMicCheckBtn.disabled = true;
        detectMicCheckStatus.className = "detect-mic-check-status";
        detectMicCheckStatus.textContent = "Requesting microphone access…";

        try {
          ensureMicrophoneApiAvailable();
          const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
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
        detectTarget.textContent = "—";
        detectReadout.textContent = "—";
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

      function selectedOctaveDescription() {
        const octaves = [...new Set(detect.octaves)].sort((a, b) => a - b);
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
        const candidates = [];
        detect.octaves.forEach(oct => {
          const { lo, hi } = detectRangeForOctave(oct);
          for (let m = lo; m <= hi; m++) candidates.push(m);
        });
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
        detectReadout.textContent = "—";
        detectReadCopy.textContent = "Play the target note to lock it in.";
        detectBarFill.style.width = "0%";
        detectFeedback.textContent = "";
        detectFeedback.className = "feedback detect-feedback";

        detect.questions++;
        detectQuestionCount.textContent = String(detect.questions);

        setMicStatus(detect.micEnabled
          ? `Listening… pluck the target note within ${selectedOctaveDescription()}.`
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
            detect.stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          }
          const Ctor = window.AudioContext || window.webkitAudioContext;
          detect.audioContext = new Ctor();
          const source = detect.audioContext.createMediaStreamSource(detect.stream);
          const analyser = detect.audioContext.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);
          detect.analyser = analyser;
          detect.micEnabled = true;
          detectMicBtn.hidden = true;
          detectMicIndicator.hidden = false;
          setMicStatus(`Listening… pluck the target note within ${selectedOctaveDescription()}.`);
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

      // Estimate the fundamental frequency (Hz) using autocorrelation with
      // parabolic interpolation. Returns null when the signal is too weak.
      function detectPitchFrequency() {
        const buflen = detect.analyser.fftSize;
        const timeData = new Float32Array(buflen);
        detect.analyser.getFloatTimeDomainData(timeData);

        let sumSq = 0;
        for (let i = 0; i < buflen; i++) sumSq += timeData[i] * timeData[i];
        const rms = Math.sqrt(sumSq / buflen);
        if (rms < 0.008) return null;

        const sampleRate = detect.audioContext.sampleRate;
        const minFreq = 75;
        const maxFreq = 720;
        const maxLag = Math.min(Math.floor(sampleRate / minFreq), buflen - 1);
        const minLag = Math.floor(sampleRate / maxFreq);

        const nsdf = new Float32Array(maxLag - minLag + 1);
        let offset = 0;
        for (let lag = minLag; lag <= maxLag; lag++) {
          let crossCorrelation = 0;
          let signalEnergy = 0;
          for (let i = 0; i + lag < buflen; i++) {
            const current = timeData[i];
            const shifted = timeData[i + lag];
            crossCorrelation += current * shifted;
            signalEnergy += current * current + shifted * shifted;
          }
          nsdf[offset++] = signalEnergy === 0 ? 0 : (2 * crossCorrelation) / signalEnergy;
        }

        let strongestPeak = -1;
        let strongestPeakIdx = -1;
        let peakIdx = -1;
        for (let i = 1; i < nsdf.length - 1; i++) {
          if (nsdf[i] > nsdf[i - 1] && nsdf[i] >= nsdf[i + 1] && nsdf[i] > 0) {
            if (nsdf[i] >= DETECT_AUTOCORRELATION_THRESHOLD) {
              peakIdx = i;
              break;
            }
            if (nsdf[i] > strongestPeak) {
              strongestPeak = nsdf[i];
              strongestPeakIdx = i;
            }
          }
        }
        if (peakIdx < 0) peakIdx = strongestPeakIdx;
        if (peakIdx < 0) return null;
        const left = nsdf[peakIdx - 1];
        const center = nsdf[peakIdx];
        const right = nsdf[peakIdx + 1];
        const denominator = left - 2 * center + right;
        const interpolationOffset = denominator === 0
          ? 0
          : Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator));
        return sampleRate / (minLag + peakIdx + interpolationOffset);
      }

      function midiValueFromFrequency(freq) {
        return 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
      }

      function midiFromFrequency(freq) {
        return Math.round(midiValueFromFrequency(freq));
      }

      function updateDetectReadout(freq) {
        if (freq === null || freq <= 0) {
          detectReadout.textContent = "—";
          detectBarFill.style.width = "0%";
          return;
        }
        detectReadout.textContent = noteShortLabel(midiFromFrequency(freq));
        const norm = Math.max(0, Math.min(1, (freq - 82) / (659 - 82)));
        detectBarFill.style.width = `${Math.round(norm * 100)}%`;
      }

      function detectPitchTick() {
        const now = performance.now();
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
        detectFeedback.textContent = `That's right — ${noteShortLabel(detect.target.midi)} (${hertz} Hz). Nice ear!`;
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
        detectReadCopy.textContent = `Heard ${heard} — keep trying the target.`;
        detectFeedback.textContent = `That was ${heard}, not ${noteShortLabel(detect.target.midi)}. Try again!`;
        detectFeedback.className = "feedback detect-feedback is-wrong";
        detectReadout.classList.add("miss");
        setTimeout(() => detectReadout.classList.remove("miss"), 400);

        // Signal the error on the target note too, then revert it — the same
        // note stays up until the player plays it correctly.
        detectTarget.classList.add("shake");
        setTimeout(() => detectTarget.classList.remove("shake"), 450);
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
