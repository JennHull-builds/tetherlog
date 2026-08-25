import {
  VOICE_TEXT_PLACEHOLDER,
  type TranscriptStatus,
} from "../types";

/** Timeslice so long dumps (10+ min) stay chunked — not one giant in-memory take. */
const RECORDER_TIMESLICE_MS = 1000;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          0: { transcript: string };
        }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined" &&
    window.isSecureContext
  );
}

export function pickRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export interface VoiceParkResult {
  audioBlob: Blob;
  audioMimeType: string;
  durationMs: number;
  text: string;
  transcriptStatus: TranscriptStatus;
}

/**
 * One recording session: chunked MediaRecorder + best-effort Web Speech.
 * Park never waits on STT — transcript is whatever landed before stop.
 */
export class VoiceSession {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recognition: SpeechRecognitionLike | null = null;
  private transcriptParts: string[] = [];
  private interimTranscript = "";
  private startedAt = 0;
  private mimeType = "";

  async start(): Promise<void> {
    if (!isVoiceSupported()) {
      throw new Error("Microphone needs HTTPS (or localhost).");
    }

    this.chunks = [];
    this.transcriptParts = [];
    this.interimTranscript = "";
    this.mimeType = pickRecorderMimeType();

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = this.mimeType
      ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
      : new MediaRecorder(this.stream);

    this.mimeType = recorder.mimeType || this.mimeType || "audio/webm";
    this.recorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    this.startedAt = Date.now();
    recorder.start(RECORDER_TIMESLICE_MS);
    this.startSpeechBestEffort();
  }

  private startSpeechBestEffort(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-GB";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const piece = result[0]?.transcript?.trim();
          if (!piece) continue;
          if (result.isFinal) {
            this.transcriptParts.push(piece);
            this.interimTranscript = "";
          } else {
            interim = interim ? `${interim} ${piece}` : piece;
          }
        }
        if (interim) this.interimTranscript = interim;
      };

      recognition.onerror = null;
      recognition.onend = null;

      this.recognition = recognition;
      recognition.start();
    } catch {
      this.recognition = null;
    }
  }

  async stop(): Promise<VoiceParkResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.cleanupTracks();
      throw new Error("Nothing was recording.");
    }

    const durationMs = Math.max(0, Date.now() - this.startedAt);

    const audioBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = this.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.onerror = () => reject(new Error("Recording failed."));
      try {
        recorder.stop();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Recording failed."));
      }
    });

    this.stopSpeechQuietly();
    this.cleanupTracks();

    const joined = [...this.transcriptParts, this.interimTranscript]
      .filter(Boolean)
      .join(" ")
      .trim();
    const text = joined || VOICE_TEXT_PLACEHOLDER;
    const transcriptStatus: TranscriptStatus = joined
      ? "ready"
      : "unavailable";

    return {
      audioBlob,
      audioMimeType: audioBlob.type || this.mimeType || "audio/webm",
      durationMs,
      text,
      transcriptStatus,
    };
  }

  /** Tear down without producing a park result (unmount / cancel). */
  dispose(): void {
    try {
      if (this.recorder && this.recorder.state !== "inactive") {
        this.recorder.onstop = null;
        this.recorder.stop();
      }
    } catch {
      /* ignore */
    }
    this.stopSpeechQuietly();
    this.cleanupTracks();
    this.chunks = [];
    this.recorder = null;
  }

  private stopSpeechQuietly(): void {
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
  }

  private cleanupTracks(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
