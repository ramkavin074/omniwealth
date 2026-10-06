// Records one short spoken utterance from the microphone as 16 kHz mono WAV, stopping by
// itself when the speaker goes quiet. Used for cloud voice billing: the phone's built-in
// recogniser is weak at Tamil, so the audio itself goes to the server (Gemini).

import { bytesToBase64, downsample, encodeWav, rms } from '@/lib/wav';

export type RecordResult =
  | { ok: true; wav: Uint8Array; seconds: number }
  | { ok: false; reason: 'permission' | 'unsupported' | 'no-speech' | 'error' };

const TARGET_RATE = 16000;

interface Opts {
  /** Give up if nobody speaks within this long. */
  waitMs?: number;
  /** Stop after this much quiet once speech has started. */
  silenceMs?: number;
  /** Hard cap on the recording. */
  maxMs?: number;
}

export function recorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
  );
}

export async function recordUtterance(opts: Opts = {}): Promise<RecordResult> {
  const waitMs = opts.waitMs ?? 6000;
  const silenceMs = opts.silenceMs ?? 1300;
  const maxMs = opts.maxMs ?? 15000;
  if (!recorderSupported()) return { ok: false, reason: 'unsupported' };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : 'error' };
  }

  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext;
  try {
    ctx = new Ctx();
    await ctx.resume();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return { ok: false, reason: 'error' };
  }

  return new Promise<RecordResult>((resolve) => {
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0; // the processor only runs when connected onward; keep it silent
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);

    const chunks: Float32Array[] = [];
    const startedAt = performance.now();
    let noise = 0;
    let noiseBlocks = 0;
    let speechAt = -1; // chunk index where speech began
    let lastLoud = startedAt;
    let finished = false;

    const finish = (r: (() => RecordResult) | RecordResult) => {
      if (finished) return;
      finished = true;
      node.onaudioprocess = null;
      try {
        source.disconnect();
        node.disconnect();
        mute.disconnect();
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
      resolve(typeof r === 'function' ? r() : r);
    };

    const build = (): RecordResult => {
      if (speechAt < 0) return { ok: false, reason: 'no-speech' };
      // Keep a little lead-in before the first word.
      const from = Math.max(0, speechAt - 2);
      const used = chunks.slice(from);
      const total = used.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total);
      let o = 0;
      for (const c of used) {
        all.set(c, o);
        o += c.length;
      }
      const seconds = total / ctx.sampleRate;
      if (seconds < 0.4) return { ok: false, reason: 'no-speech' };
      const pcm = downsample(all, ctx.sampleRate, TARGET_RATE);
      return { ok: true, wav: encodeWav(pcm, Math.min(TARGET_RATE, ctx.sampleRate)), seconds };
    };

    node.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      const now = performance.now();
      const level = rms(data);
      chunks.push(data);
      // Learn the room's noise level from the first few blocks, then set the speech threshold.
      if (noiseBlocks < 4) {
        noise = Math.max(noise, level);
        noiseBlocks++;
      }
      const threshold = Math.max(0.02, noise * 2.5);
      if (level > threshold) {
        if (speechAt < 0 && noiseBlocks >= 4) speechAt = chunks.length - 1;
        if (speechAt >= 0) lastLoud = now;
      }
      if (speechAt < 0 && now - startedAt > waitMs) finish({ ok: false, reason: 'no-speech' });
      else if (speechAt >= 0 && now - lastLoud > silenceMs) finish(build);
      else if (now - startedAt > maxMs) finish(build);
    };
  });
}

export { bytesToBase64 };
