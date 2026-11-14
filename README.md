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

No build step or packages required. Over a real web server the app plays
recorded piano WAVs; opened directly from disk it automatically falls back to a
built-in synthesized tone. The two paths are described below.

### Option A — over a web server (recorded piano samples)

The browser must be able to fetch the WAV files, which requires serving the
folder (plain `file://` won't work). Add the six mono samples to the project
root and start a simple server:

```bash
git clone <repository-url>
cd nailthenote
# add C2.wav … C7.wav here
python3 -m http.server 8000
# then open http://localhost:8000
```

The required samples are `C2.wav`, `C3.wav`, `C4.wav`, `C5.wav`, `C6.wav`, and
`C7.wav`, recorded from the same piano. C7 provides a nearby anchor for the
game's highest notes (up to B6).

### Option B — direct from disk (no server)

Just open `index.html` in a browser. Because WAV fetching is blocked under
`file://`, the app detects this and uses a built-in Web Audio synthesizer
instead, so the game still works with no files or server.

The detected engine is also announced in the browser console on load, e.g.
`Nail The Pitch: using recorded piano WAV samples (pitch-shifted).` or
`Nail The Pitch: using the built-in synthesizer engine.`

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

The app serves two playback paths and picks one automatically:

- **Web server (http/https):** the six piano WAVs are fetched and decoded on
  first playback. For each target MIDI pitch, the closest C-note sample is
  chosen and its `AudioBufferSourceNode` playback rate set to the matching
  semitone interval. This preserves the recorded attack and decay while
  covering C2–B6 without a sample for every key.
- **Direct from disk (file://):** `fetch` of local files is blocked, so the app
  falls back to a built-in synthesizer that builds each note from a fundamental
  plus harmonics with an amplitude envelope.

The check is `location.protocol` — a real server means samples, otherwise synth.
The choice is logged to the browser console on startup.

## License

GNU Lesser General Public License v3.0 (LGPL-3.0). See [LICENSE.md](LICENSE.md) for details.
