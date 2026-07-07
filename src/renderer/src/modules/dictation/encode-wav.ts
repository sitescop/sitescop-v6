/** Target sample rate for Windows speech recognition. */
export const SPEECH_SAMPLE_RATE = 16000;

/** Encode mono 16-bit PCM float samples as a WAV file (for Windows speech). */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bitsPerSample = 16;
  const blockAlign = bitsPerSample / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

export function mergeSampleChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function normalizeSamples(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i] ?? 0));
  }
  if (peak < 0.02) return samples;
  const gain = 0.92 / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = (samples[i] ?? 0) * gain;
  }
  return out;
}

export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const srcIndex = i * ratio;
    const index = Math.floor(srcIndex);
    const fraction = srcIndex - index;
    const a = samples[index] ?? 0;
    const b = samples[index + 1] ?? a;
    result[i] = a + fraction * (b - a);
  }
  return result;
}

/** Prepare recorded audio for Windows speech (mono, normalized, 16 kHz). */
export function prepareSpeechAudio(samples: Float32Array, sampleRate: number): {
  samples: Float32Array;
  sampleRate: number;
} {
  const normalized = normalizeSamples(samples);
  const resampled = resampleLinear(normalized, sampleRate, SPEECH_SAMPLE_RATE);
  return { samples: resampled, sampleRate: SPEECH_SAMPLE_RATE };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
