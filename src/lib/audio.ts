let ctx: AudioContext | null = null;

export function unlockAudio() {
  const AC = window.AudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function env(osc: OscillatorNode, gain: GainNode, at: number, dur: number, peak: number) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playCue(kind: "ok" | "bad" | "drop", enabled: boolean) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (kind === "ok") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
    env(osc, gain, now, 0.16, 0.05);
    return;
  }
  if (kind === "bad") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
    env(osc, gain, now, 0.2, 0.03);
    return;
  }
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(48, now + 0.28);
  env(osc, gain, now, 0.32, 0.08);
}
