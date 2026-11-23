(function (root) {
  "use strict";

  const AUTOCORRELATION_THRESHOLD = 0.8;
  const AUTOCORRELATION_PEAK_MARGIN = 0.02;
  const SUBHARMONIC_CHECK_MIN_LAG = 12;

  function frequencyForMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function getPitch(audioChunk, sampleRate, {
    minFrequency = frequencyForMidi(0),
    maxFrequency = frequencyForMidi(120)
  } = {}) {
    if (!audioChunk || typeof audioChunk.length !== "number") {
      throw new TypeError("audioChunk must be an array-like audio sample buffer.");
    }
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new RangeError("sampleRate must be a positive number.");
    }
    if (!Number.isFinite(minFrequency) || minFrequency <= 0 ||
        !Number.isFinite(maxFrequency) || maxFrequency <= minFrequency) {
      throw new RangeError("The frequency range must contain positive, increasing bounds.");
    }
    if (audioChunk.length === 0) return null;

    const downsampleFactor = sampleRate >= 40000
      ? Math.ceil(sampleRate / 24000)
      : 1;
    const sampleData = downsampleFactor === 1
      ? audioChunk
      : new Float32Array(Math.floor(audioChunk.length / downsampleFactor));
    if (downsampleFactor > 1) {
      for (let i = 0; i < sampleData.length; i++) {
        let sum = 0;
        const start = i * downsampleFactor;
        for (let sample = 0; sample < downsampleFactor; sample++) {
          sum += audioChunk[start + sample];
        }
        sampleData[i] = sum / downsampleFactor;
      }
    }

    const sampleCount = sampleData.length;
    if (sampleCount === 0) return null;
    let sumSquared = 0;
    for (let i = 0; i < sampleCount; i++) {
      sumSquared += sampleData[i] * sampleData[i];
    }
    const rms = Math.sqrt(sumSquared / sampleCount);
    if (rms < 0.008) return null;

    const effectiveSampleRate = sampleRate / downsampleFactor;
    const maxLag = Math.min(
      Math.ceil(effectiveSampleRate / minFrequency),
      sampleCount - 1
    );
    const minLag = Math.max(2, Math.floor(effectiveSampleRate / maxFrequency));
    if (maxLag <= minLag) return null;

    const correlation = new Float32Array(sampleCount);
    let offset = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let crossCorrelation = 0;
      let signalEnergy = 0;
      for (let i = 0; i + lag < sampleCount; i++) {
        const current = sampleData[i];
        const shifted = sampleData[i + lag];
        crossCorrelation += current * shifted;
        signalEnergy += current * current + shifted * shifted;
      }
      correlation[offset++] = signalEnergy === 0
        ? 0
        : (2 * crossCorrelation) / signalEnergy;
    }

    let strongestPeak = -1;
    let strongestPeakIdx = -1;
    let firstStrongPeakIdx = -1;
    for (let i = 1; i < offset - 1; i++) {
      if (correlation[i] > correlation[i - 1] &&
          correlation[i] >= correlation[i + 1] &&
          correlation[i] > 0) {
        if (firstStrongPeakIdx < 0 && correlation[i] >= AUTOCORRELATION_THRESHOLD) {
          firstStrongPeakIdx = i;
        }
        if (correlation[i] > strongestPeak) {
          strongestPeak = correlation[i];
          strongestPeakIdx = i;
        }
      }
    }
    if (strongestPeakIdx < 0) return null;

    let peakIdx = firstStrongPeakIdx >= 0 ? firstStrongPeakIdx : strongestPeakIdx;
    while (minLag + peakIdx >= SUBHARMONIC_CHECK_MIN_LAG) {
      const currentLag = minLag + peakIdx;
      const doubledLag = currentLag * 2;
      const lowerBound = Math.max(1, Math.floor(doubledLag * 0.88) - minLag);
      const upperBound = Math.min(offset - 2, Math.ceil(doubledLag * 1.12) - minLag);
      let lowerPeakIdx = -1;
      for (let i = lowerBound; i <= upperBound; i++) {
        const isPeak = correlation[i] > correlation[i - 1] &&
          correlation[i] >= correlation[i + 1];
        if (isPeak && (lowerPeakIdx < 0 || correlation[i] > correlation[lowerPeakIdx])) {
          lowerPeakIdx = i;
        }
      }
      if (lowerPeakIdx < 0 ||
          correlation[lowerPeakIdx] - correlation[peakIdx] <= AUTOCORRELATION_PEAK_MARGIN) {
        break;
      }
      peakIdx = lowerPeakIdx;
    }

    const left = correlation[peakIdx - 1];
    const center = correlation[peakIdx];
    const right = correlation[peakIdx + 1];
    const denominator = left - 2 * center + right;
    let interpolationOffset = denominator === 0
      ? 0
      : Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator));
    if (minLag + peakIdx < 8 && center > 0) {
      const cosine = Math.max(-1, Math.min(1, (left + right) / (2 * center)));
      const angularFrequency = Math.acos(cosine);
      const sine = Math.sin(angularFrequency);
      if (angularFrequency > 0 && sine > 0) {
        const cosineOffset = Math.atan2(right - left, 2 * center * sine) / angularFrequency;
        if (Number.isFinite(cosineOffset) && Math.abs(cosineOffset) <= 0.5) {
          interpolationOffset = cosineOffset;
        }
      }
    }

    return effectiveSampleRate / (minLag + peakIdx + interpolationOffset);
  }

  if (typeof module === "object" && module.exports) {
    module.exports = getPitch;
  } else {
    root.getPitch = getPitch;
  }
})(globalThis);
