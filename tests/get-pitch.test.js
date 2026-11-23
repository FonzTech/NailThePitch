"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const getPitch = require("../get-pitch.js");

const CHUNK_SIZE = 8192;
const WAV_NOTE_FILES = [
  ["e2.wav", 40], ["f2.wav", 41], ["gb2.wav", 42], ["g2.wav", 43],
  ["ab2.wav", 44], ["a2.wav", 45], ["bb2.wav", 46], ["b2.wav", 47],
  ["e4.wav", 64], ["f4.wav", 65], ["gb4.wav", 66], ["g4.wav", 67],
  ["ab4.wav", 68], ["a4.wav", 69], ["bb4.wav", 70], ["b4.wav", 71]
];

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

function readPcm16Wav(filename) {
  const buffer = readFileSync(path.join(__dirname, filename));
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF", `${filename} should be a RIFF file`);
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE", `${filename} should be a WAVE file`);

  let audioFormat;
  let channels;
  let sampleRate;
  let bitsPerSample;
  let dataStart;
  let dataSize;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkStart;
      dataSize = chunkSize;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  assert.equal(audioFormat, 1, `${filename} should use uncompressed PCM`);
  assert.equal(bitsPerSample, 16, `${filename} should use 16-bit samples`);
  assert.ok(channels > 0, `${filename} should contain audio channels`);
  assert.ok(dataStart !== undefined, `${filename} should contain audio data`);

  const frameCount = dataSize / (channels * 2);
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      const sampleOffset = dataStart + (frame * channels + channel) * 2;
      sum += buffer.readInt16LE(sampleOffset) / 32768;
    }
    samples[frame] = sum / channels;
  }
  return { samples, sampleRate };
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

test("detects the note in the provided octave-2 and octave-4 WAVs", () => {
  const options = {
    minFrequency: frequencyForMidi(39),
    maxFrequency: frequencyForMidi(72)
  };
  const windowOffsets = [0.4, 0.6];

  for (const [filename, midi] of WAV_NOTE_FILES) {
    const { samples, sampleRate } = readPcm16Wav(filename);
    const expected = frequencyForMidi(midi);
    for (const seconds of windowOffsets) {
      const start = Math.floor(seconds * sampleRate);
      const chunk = samples.subarray(start, start + CHUNK_SIZE);
      assert.equal(chunk.length, CHUNK_SIZE, `${filename} should contain a window at ${seconds}s`);
      const actual = getPitch(chunk, sampleRate, options);
      assert.ok(actual !== null, `${filename} should be detected at ${seconds}s`);
      assert.ok(
        Math.abs(centsBetween(actual, expected)) < 35,
        `${filename} at ${seconds}s: expected ${expected.toFixed(2)} Hz, received ${actual.toFixed(2)} Hz`
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
