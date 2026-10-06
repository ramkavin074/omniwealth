import { describe, expect, it } from 'vitest';
import { bytesToBase64, downsample, encodeWav, rms } from './wav';

describe('wav helpers', () => {
  it('writes a valid 16-bit mono WAV header and samples', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 16000);
    const dv = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(...wav.subarray(o, o + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(dv.getUint32(24, true)).toBe(16000);
    expect(dv.getUint16(22, true)).toBe(1);
    expect(dv.getUint16(34, true)).toBe(16);
    expect(dv.getUint32(40, true)).toBe(8);
    expect(wav.length).toBe(44 + 8);
    expect(dv.getInt16(46, true)).toBe(32767);
    expect(dv.getInt16(48, true)).toBe(-32768);
  });

  it('downsamples by averaging and keeps the duration', () => {
    const src = new Float32Array(48000).fill(0.5);
    const out = downsample(src, 48000, 16000);
    expect(out.length).toBe(16000);
    expect(out[100]).toBeCloseTo(0.5);
  });

  it('leaves audio alone when already at or below the target rate', () => {
    const src = new Float32Array([0.1, 0.2]);
    expect(downsample(src, 16000, 16000)).toBe(src);
  });

  it('round-trips bytes through base64, including large buffers', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
    const b64 = bytesToBase64(bytes);
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(back.length).toBe(bytes.length);
    expect(back[99_999]).toBe(bytes[99_999]);
  });

  it('measures level', () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0);
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});
