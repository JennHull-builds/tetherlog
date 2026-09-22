/**
 * The one sound in the app: a commit acknowledgment (D-016). Synthesized with
 * Web Audio, not a shipped file — zero binary weight, zero network request,
 * consistent with self-hosting everything else here. Off by default
 * (AppSettings.soundEnabled); CaptureView is the only caller.
 *
 * Reads its shape from tokens.json's "sound" group and reuses the existing
 * commit spring's duration rather than a new hardcoded one, so the sound and
 * the visual pulse can never drift apart on their own.
 */
import { springs } from "../motion/springs.generated";
import { readNumber } from "./motion";

let ctx: AudioContext | null = null;

/** Safari shipped this prefixed for years; harmless to still check for it. */
interface WindowWithWebkitAudio {
  webkitAudioContext?: typeof AudioContext;
}

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ?? (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * A soft, low tone that falls in pitch — weight landing, not a chime. Park is
 * itself the user gesture, so there is no autoplay-policy gate to work around.
 */
export function playParkSound(): void {
  const audioCtx = getContext();
  if (!audioCtx) return;

  if (audioCtx.state === "suspended") void audioCtx.resume();

  const freqStart = readNumber("--tl-sound-commit-frequency-start", 220);
  const freqEnd = readNumber("--tl-sound-commit-frequency-end", 110);
  const gainPeak = readNumber("--tl-sound-commit-gain-peak", 0.22);
  const durationS = springs.commit.durationMs / 1000;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, now + durationS);

  // Softens the attack so it reads as felt rather than clicked.
  filter.type = "lowpass";
  filter.frequency.value = 900;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + durationS + 0.02);
  osc.onended = () => {
    osc.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
