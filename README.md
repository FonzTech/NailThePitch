# Nail The Pitch

## Live web app

Try it online: **[https://fonztech.github.io/NailThePitch/](https://fonztech.github.io/NailThePitch/)**

## Know the note. Own the sound.

Nail The Pitch is a small web app for training your **absolute pitch**, one note at a time. Listen closely, trust your instinct, and watch your ear get sharper — no scores to chase, just progress to make.

## Features

- **3 progressive training levels:**
  1. **Find the octave** — hear the pitch and pinpoint its place.
  2. **Name the note** — recognize the note, whatever the octave.
  3. **Note & octave** — the full picture: identify note and octave in one go.

- **Recorded piano samples** played and pitch-shifted with the Web Audio API.
- **Live session statistics** — time, correct answers, incorrect answers, and question count.
- **Instant feedback** with random distractors for every question.
- **Responsive, accessible interface** (ARIA, keyboard navigation).
- **Switchable dark theme** — toggle button on the game selector screen.
- **Zero dependencies**: just HTML, CSS, and vanilla JavaScript.

## Stack

| Technology | Role |
|------------|------|
| HTML5 | Page structure |
| CSS3 | Styling and responsive layout |
| JavaScript (vanilla) | Game logic and piano sample playback |
| Web Audio API | Sample playback and pitch shifting (MIDI 36–95) |

## Installation

No build step or packages required. Clone or download the repository, add the six piano WAV files listed below to
the project root, and serve the folder from a local web server. The browser
fetches and decodes the WAVs, which does not work reliably from a `file://` URL.

```bash
git clone <repository-url>
cd nailthenote
python3 -m http.server 8000
# then open http://localhost:8000
```

The required mono samples are `C2.wav`, `C3.wav`, `C4.wav`, `C5.wav`,
`C6.wav`, and `C7.wav` in the project root. C7 provides a nearby anchor for
the game's highest notes (up to B6). Each question uses the nearest C sample
and shifts its playback rate to the target pitch.

**Tip:** for the best experience, use **headphones**.

## Usage

1. On the home screen, choose one of the three training modes.
2. Tap (or click) the sound orb to play the note again as often as you like.
3. Pick your answer from the options shown.
4. Get instant feedback and move on to the next note.
5. Use **Back to menu** to return to the mode selection.

## Project structure

```
nailthenote/
├── index.html   # Home and game screen structure
├── styles.css   # Styling, layout, and animations
├── script.js    # Game logic and sample playback (Web Audio API)
├── C2.wav–C7.wav # Piano samples (provided separately)
├── favicon.png   # Site favicon
├── LICENSE.md   # LGPL-3.0 license text
├── README.md    # Project documentation
└── .gitignore
```

## How the sound works

The app loads the six piano WAV samples on first playback. For each target MIDI
pitch, it chooses the closest C-note sample and sets an `AudioBufferSourceNode`
playback rate by the corresponding semitone interval. This keeps the recorded
piano attack and decay while allowing the game to cover C2–B6 without a sample
for every key.

## License

GNU Lesser General Public License v3.0 (LGPL-3.0). See [LICENSE.md](LICENSE.md) for details.
