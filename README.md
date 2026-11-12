# Nail The Pitch

**Know the note. Own the sound.**

Nail The Pitch is a small web app for training your **absolute pitch**, one note at a time. Listen closely, trust your instinct, and watch your ear get sharper — no scores to chase, just progress to make.

## Features

- **3 progressive training levels:**
  1. **Find the octave** — hear the pitch and pinpoint its place.
  2. **Name the note** — recognize the note, whatever the octave.
  3. **Note & octave** — the full picture: identify note and octave in one go.

- **Real-time generated audio** via the Web Audio API (no audio files to load).
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
| JavaScript (vanilla) | Game logic and audio synthesis |
| Web Audio API | Sound generation (MIDI 36–83) |

## Installation

No build step or packages required. Just clone or download the repository and open `index.html` in a modern browser.

```bash
git clone <repository-url>
cd nailthenote
# open index.html in your browser
```

**Tip:** for the best experience, use **headphones**.

## Live web app

Try it online: **[https://fonztech.github.io/NailThePitch/](https://fonztech.github.io/NailThePitch/)**

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
├── script.js    # Game logic and audio synthesis (Web Audio API)
├── favicon.png   # Site favicon
├── LICENSE.md   # LGPL-3.0 license text
├── README.md    # Project documentation
└── .gitignore
```

## How the sound works

Notes are synthesized on the fly from a MIDI number (36–83). Each note is built from a fundamental plus a few harmonics, with an amplitude envelope that produces a soft, realistic tone — all computed live with the Web Audio API.

## Roadmap (ideas)

- [ ] New modes or increasing difficulty levels
- [ ] Statistics persistence (e.g. localStorage)
- [ ] Reference instrument support (piano, guitar)
- [ ] Automated tests

## License

GNU Lesser General Public License v3.0 (LGPL-3.0). See [LICENSE.md](LICENSE.md) for details.
