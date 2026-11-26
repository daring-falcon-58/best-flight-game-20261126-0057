// All sound in Sky Courier is synthesised live with WebAudio — no audio files, no
// network. A twin-oscillator engine drone follows the throttle, filtered noise is the
// wind, and short sine bursts mark rings, landings and crashes.
export function makeAudio() {
  let ctx = null; let master = null; let engOsc1 = null; let engOsc2 = null;
  let engGain = null; let windGain = null; let windFilter = null; let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // Engine: a sawtooth + a detuned square, through a low-pass.
    engOsc1 = ctx.createOscillator(); engOsc1.type = 'sawtooth'; engOsc1.frequency.value = 58;
    engOsc2 = ctx.createOscillator(); engOsc2.type = 'square'; engOsc2.frequency.value = 116;
    const engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 420;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engOsc1.connect(engFilter); engOsc2.connect(engFilter);
    engFilter.connect(engGain); engGain.connect(master);
    engOsc1.start(); engOsc2.start();
    // Wind: looped white noise through a band-pass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass';
    windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    wind.start();
    return true;
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    /** Called every frame while flying: throttle 0..1, speed m/s. */
    update(throttle, speed) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engOsc1.frequency.setTargetAtTime(52 + throttle * 68, t, 0.08);
      engOsc2.frequency.setTargetAtTime(104 + throttle * 136, t, 0.08);
      engGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.22, speed * 0.0022), t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
    },
    ring() { tone(880, 0.35, 'sine', 0.35); tone(1318, 0.5, 'sine', 0.3, 0.09); },
    land() { tone(523, 0.3, 'sine', 0.3); tone(784, 0.5, 'sine', 0.28, 0.12); },
    crash() {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.6;
      src.connect(g); g.connect(master); src.start(t0);
      tone(70, 0.6, 'sine', 0.5);
    },
  };
}
