"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const getPitch = require("../get-pitch.js");

const CHUNK_SIZE = 8192;

function frequencyForMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function makeTone(frequency, sampleRate, partials = [1], phase = 0) {
  return Float32Array.from({ length: CHUNK_SIZE }, (_, index) => {
    const time = index / sampleRate;
    return partials.reduce((value, amplitude, partialIndex) => {
      const harmonic = partialIndex + 1;
      return value + amplitude * Math.sin(
        2 * Math.PI * frequency * harmonic * time + phase * harmonic
      );
    }, 0);
  });
}

function centsBetween(actual, expected) {
  return 1200 * Math.log2(actual / expected);
}

test("detects every chromatic pitch from E2 through E4", () => {
  for (const sampleRate of [44100, 48000]) {
    const options = {
      minFrequency: frequencyForMidi(39),
      maxFrequency: frequencyForMidi(65)
    };

    for (let midi = 40; midi <= 64; midi++) {
      const expected = frequencyForMidi(midi);
      const actual = getPitch(makeTone(expected, sampleRate), sampleRate, options);
      assert.ok(actual !== null, `${sampleRate} Hz: MIDI ${midi} should be detected`);
      assert.ok(
        Math.abs(centsBetween(actual, expected)) < 5,
        `${sampleRate} Hz, MIDI ${midi}: expected ${expected.toFixed(2)} Hz, received ${actual.toFixed(2)} Hz`
      );
    }
  }
});

test("uses the fundamental when a G2 second harmonic is stronger", () => {
  const expected = frequencyForMidi(43);
  const actual = getPitch(
    makeTone(expected, 48000, [0.1, 1, 0.3]),
    48000,
    {
      minFrequency: frequencyForMidi(39),
      maxFrequency: frequencyForMidi(84)
    }
  );

  assert.ok(actual !== null);
  assert.ok(
    Math.abs(centsBetween(actual, expected)) < 5,
    `Expected G2 near ${expected.toFixed(2)} Hz, received ${actual.toFixed(2)} Hz`
  );
});

test("returns null for silence", () => {
  assert.equal(getPitch(new Float32Array(CHUNK_SIZE), 48000), null);
});
