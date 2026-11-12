    (() => {
      "use strict";

      const pitchClasses = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
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
          copy: "The octave doesn't matter. Name the note.",
          kicker: "Name that note"
        },
        full: {
          name: "Note & octave",
          title: "Name the full pitch.",
          copy: "Choose the note and octave you heard.",
          kicker: "The full picture"
        }
      };

      const homeScreen = document.querySelector("#home-screen");
      const gameScreen = document.querySelector("#game-screen");
      const modeName = document.querySelector("#mode-name");
      const questionTitle = document.querySelector("#question-title");
      const questionCopy = document.querySelector("#question-copy");
      const questionKicker = document.querySelector("#question-kicker");
      const answerGrid = document.querySelector("#answer-grid");
      const feedback = document.querySelector("#feedback");
      const nextButton = document.querySelector("#next-button");
      const timer = document.querySelector("#timer");
      const correctCount = document.querySelector("#correct-count");
      const incorrectCount = document.querySelector("#incorrect-count");
      const questionCount = document.querySelector("#question-count");
      const soundOrb = document.querySelector("#sound-orb");

      let activeMode = null;
      let currentQuestion = null;
      let answered = false;
      let correct = 0;
      let incorrect = 0;
      let questions = 0;
      let startedAt = 0;
      let timerInterval = null;
      let audioContext = null;
      let audioStopTimer = null;

      function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
        const seconds = (totalSeconds % 60).toString().padStart(2, "0");
        return `${minutes}:${seconds}`;
      }

      function updateTimer() {
        timer.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
      }

      function startSession(mode) {
        activeMode = mode;
        correct = 0;
        incorrect = 0;
        questions = 0;
        correctCount.textContent = "0";
        incorrectCount.textContent = "0";
        questionCount.textContent = "0";
        timer.textContent = "00:00";
        homeScreen.hidden = true;
        gameScreen.hidden = false;
        modeName.textContent = modes[mode].name;
        questionTitle.textContent = modes[mode].title;
        questionCopy.textContent = modes[mode].copy;
        questionKicker.textContent = modes[mode].kicker;
        startedAt = Date.now();
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
        nextQuestion();
      }

      function stopSession() {
        clearInterval(timerInterval);
        clearTimeout(audioStopTimer);
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        gameScreen.hidden = true;
        homeScreen.hidden = false;
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

      function makeQuestion() {
        const note = pitchFromMidi(randomInt(36, 83));
        let choices;
        let answer;

        if (activeMode === "octave") {
          choices = [2, 3, 4, 5, 6].map(String);
          answer = String(note.octave);
        } else if (activeMode === "note") {
          choices = [...pitchClasses];
          answer = note.name;
        } else {
          const possibleNotes = [];
          for (let midi = 48; midi <= 83; midi++) possibleNotes.push(pitchFromMidi(midi));
          const distractors = shuffle(possibleNotes.filter(pitch => pitch.midi !== note.midi)).slice(0, 11);
          choices = shuffle([note, ...distractors]).map(pitch => ({
            label: pitch.label,
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
        playNote();
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
        if (audioContext.state === "suspended") await audioContext.resume();
        return audioContext;
      }

      async function playNote() {
        const context = await getAudioContext();
        if (!context || !currentQuestion) return;

        clearTimeout(audioStopTimer);
        soundOrb.classList.add("is-playing");
        const start = context.currentTime + 0.02;
        const frequency = 440 * Math.pow(2, (currentQuestion.note.midi - 69) / 12);
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

        audioStopTimer = setTimeout(() => soundOrb.classList.remove("is-playing"), 1450);
      }

      function submitAnswer(button) {
        if (answered) return;
        answered = true;
        const isCorrect = button.dataset.answer === String(currentQuestion.answer);
        const rightAnswer = activeMode === "octave"
          ? `${currentQuestion.note.name}${currentQuestion.note.octave}`
          : activeMode === "note"
            ? currentQuestion.note.name
            : currentQuestion.note.label;

        if (isCorrect) {
          correct++;
          correctCount.textContent = String(correct);
          feedback.textContent = "That's right. Nice ear!";
          feedback.classList.add("is-correct");
          button.classList.add("is-correct");
        } else {
          incorrect++;
          incorrectCount.textContent = String(incorrect);
          feedback.textContent = `Not quite — the note was ${rightAnswer}.`;
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

      document.querySelectorAll("[data-mode]").forEach(button => {
        button.addEventListener("click", () => startSession(button.dataset.mode));
      });
      document.querySelector("#back-button").addEventListener("click", stopSession);
      document.querySelector(".brand").addEventListener("click", event => {
        event.preventDefault();
        if (activeMode) stopSession();
      });
      document.querySelector("#play-button").addEventListener("click", playNote);
      nextButton.addEventListener("click", nextQuestion);

      function nextQuestion() {
        if (!activeMode) return;
        makeQuestion();
      }
    })();
