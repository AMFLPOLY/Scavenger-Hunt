/*
 * Optional sound effects, synthesized with the Web Audio API (no audio files, works offline).
 * Off by default; the audio engine is only started after he taps the speaker button,
 * which keeps phone autoplay rules happy.
 */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  let ctx = null;
  let master = null;
  let enabled = false;

  function audio() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, at, duration, { type = 'sine', gain = 0.1, slideTo } = {}) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noise(at, duration, gain = 0.05) {
    const t0 = ctx.currentTime + at;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(env).connect(master);
    src.start(t0);
  }

  const effects = {
    beep: () => tone(1040, 0, 0.07, { type: 'square', gain: 0.03 }),
    key: () => tone(1500, 0, 0.035, { type: 'square', gain: 0.02 }),
    message: () => {
      tone(880, 0, 0.06, { type: 'sine', gain: 0.07 });
      tone(1320, 0.08, 0.09, { type: 'sine', gain: 0.06 });
    },
    hint: () => {
      tone(660, 0, 0.09, { type: 'triangle', gain: 0.08 });
      tone(990, 0.1, 0.14, { type: 'triangle', gain: 0.08 });
    },
    error: () => {
      tone(220, 0, 0.12, { type: 'sawtooth', gain: 0.045, slideTo: 150 });
      tone(160, 0.13, 0.16, { type: 'sawtooth', gain: 0.04, slideTo: 110 });
    },
    success: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.08, 0.28, { type: 'triangle', gain: 0.09 })),
    glitch: () => {
      noise(0, 0.07, 0.05);
      noise(0.11, 0.04, 0.035);
    },
    unlock: () => [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => tone(f, i * 0.14, 1.8, { gain: 0.06 })),
  };

  OG.sound = {
    isEnabled: () => enabled,
    /** warmUp = true when called from a tap, so the browser lets audio start. */
    setEnabled(on, warmUp) {
      enabled = !!on;
      if (enabled && warmUp) audio();
    },
    play(name) {
      if (!enabled || !effects[name]) return;
      try {
        if (audio()) effects[name]();
      } catch (e) {
        /* sound is optional; never let it break the game */
      }
    },
  };
})();
