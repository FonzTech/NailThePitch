"use strict";

const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const getPitch = require("../get-pitch.js");

const CHUNK_SIZE = 8192;
const PITCH_CLASS_BY_NAME = {
  C: 0, Csharp: 1, D: 2, Dsharp: 3, E: 4, F: 5,
  Fsharp: 6, G: 7, Gsharp: 8, A: 9, Asharp: 10, B: 11
};
const WAV_NOTE_FILES = readdirSync(__dirname)
  .filter(filename => filename.endsWith(".wav"))
  .map(filename => {
    const match = /^([A-G](?:sharp)?)(\d)(?:-2)?\.wav$/.exec(filename);
    assert.ok(match, `${filename} should use scientific pitch notation`);
    const [, pitchName, octave] = match;
    return {
      filename,
      midi: 12 * (Number(octave) + 1) + PITCH_CLASS_BY_NAME[pitchName]
    };
  })
  .sort((a, b) => a.midi - b.midi);

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

function rms(samples) {
  let sumSquared = 0;
  for (const sample of samples) sumSquared += sample * sample;
  return Math.sqrt(sumSquared / samples.length);
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

function findInitialPluckPeak(samples, sampleRate) {
  const windowSize = Math.round(sampleRate * 0.01);
  const hopSize = Math.round(sampleRate * 0.005);
  const searchEnd = Math.min(samples.length, Math.floor(sampleRate * 0.5));
  let peakStart = 0;
  let peakRms = 0;

  for (let start = 0; start + windowSize <= searchEnd; start += hopSize) {
    let sumSquared = 0;
    for (let i = start; i < start + windowSize; i++) {
      sumSquared += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquared / windowSize);
    if (rms > peakRms) {
      peakRms = rms;
      peakStart = start;
    }
  }
  return peakStart;
}

test("detects every chromatic pitch from E2 through E4", () => {
  for (const sampleRate of [44100, 48000]) {
    const options = {
      minFrequency: frequencyForMidi(37),
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

test("holds the plucked note steadily for at least one second", () => {
  const options = {
    minFrequency: frequencyForMidi(37),
    maxFrequency: frequencyForMidi(81)
  };

  for (const { filename, midi } of WAV_NOTE_FILES) {
    const { samples, sampleRate } = readPcm16Wav(filename);
    const tracker = getPitch.createPitchTracker();
    const expected = frequencyForMidi(midi);
    const peakStart = findInitialPluckPeak(samples, sampleRate);
    const hopSize = Math.round(sampleRate * 0.08);
    const oneSecondLater = peakStart + sampleRate;
    const pitchRange = WAV_NOTE_FILES.map(note => note.midi);
    assert.equal(Math.min(...pitchRange), 38, "the set should start at D2");
    assert.equal(Math.max(...pitchRange), 80, "the set should reach Gsharp5");
    let firstDetectedAt = null;
    let lastChunkStart = peakStart;

    for (let start = peakStart; start < oneSecondLater; start += hopSize) {
      if (start + CHUNK_SIZE > samples.length) break;
      lastChunkStart = start;
      const actual = tracker.getPitch(
        samples.subarray(start, start + CHUNK_SIZE),
        sampleRate,
        options
      );
      if (actual === null) {
        const chunk = samples.subarray(start, start + CHUNK_SIZE);
        if (firstDetectedAt !== null && rms(chunk) >= 0.008) {
          assert.fail(`${filename} lost pitch detection while its pluck was still audible`);
        }
        continue;
      }

      if (firstDetectedAt === null) firstDetectedAt = start;
      assert.ok(
        Math.abs(centsBetween(actual, expected)) < 35,
        `${filename} at ${(start / sampleRate).toFixed(2)}s: expected ${expected.toFixed(2)} Hz, received ${actual.toFixed(2)} Hz`
      );
    }

    assert.ok(firstDetectedAt !== null, `${filename} should produce a stable pitch`);
    assert.ok(
      firstDetectedAt - peakStart <= sampleRate * 0.8,
      `${filename} should settle within one second of its initial pluck peak`
    );
    assert.ok(
      lastChunkStart >= oneSecondLater - hopSize,
      `${filename} should provide a full second of pluck audio`
    );
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
