"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { OUTPUT_LANGUAGES } from "@/lib/languages";

type Status = "idle" | "connecting" | "active" | "error";

const SILENCE_TIMEOUT_MS = 30_000;
const SILENCE_RMS_THRESHOLD = 0.015;
const SILENCE_CHECK_INTERVAL_MS = 200;
const DEFAULT_GAIN = 2.0;
const MAX_GAIN = 5.0;

interface ServerEvent {
  type: string;
  delta?: string;
  [key: string]: unknown;
}

export default function Translator() {
  const [status, setStatus] = useState<Status>("idle");
  const [language, setLanguage] = useState("en");
  const [gain, setGain] = useState(DEFAULT_GAIN);
  const [error, setError] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [silenceSecondsLeft, setSilenceSecondsLeft] = useState(
    SILENCE_TIMEOUT_MS / 1000
  );
  const [micLevel, setMicLevel] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const silenceTimerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
      } catch {}
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    gainNodeRef.current = null;
    micAnalyserRef.current = null;
    setMicLevel(0);
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setSilenceSecondsLeft(SILENCE_TIMEOUT_MS / 1000);
  }, [cleanup]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain;
    }
  }, [gain]);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setSourceText("");
    setTranslatedText("");
    setStatus("connecting");
    try {
      const sessionRes = await fetch("/api/translate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: language }),
      });
      if (!sessionRes.ok) {
        const body = (await sessionRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? `Failed to create session (${sessionRes.status})`
        );
      }
      const { client_secret: clientSecret } = (await sessionRes.json()) as {
        client_secret: string;
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const micSource = audioCtx.createMediaStreamSource(stream);
      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 1024;
      micAnalyserRef.current = micAnalyser;
      micSource.connect(micAnalyser);

      lastVoiceAtRef.current = Date.now();
      const sampleBuf = new Float32Array(micAnalyser.fftSize);
      silenceTimerRef.current = window.setInterval(() => {
        const analyser = micAnalyserRef.current;
        if (!analyser) return;
        analyser.getFloatTimeDomainData(sampleBuf);
        let sumSquares = 0;
        for (let i = 0; i < sampleBuf.length; i++) {
          sumSquares += sampleBuf[i] * sampleBuf[i];
        }
        const rms = Math.sqrt(sumSquares / sampleBuf.length);
        setMicLevel(Math.min(1, rms * 8));
        const now = Date.now();
        if (rms > SILENCE_RMS_THRESHOLD) {
          lastVoiceAtRef.current = now;
        }
        const elapsed = now - lastVoiceAtRef.current;
        const remaining = Math.max(
          0,
          Math.ceil((SILENCE_TIMEOUT_MS - elapsed) / 1000)
        );
        setSilenceSecondsLeft(remaining);
        if (elapsed >= SILENCE_TIMEOUT_MS) {
          stop();
        }
      }, SILENCE_CHECK_INTERVAL_MS);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = ({ streams }) => {
        const [remoteStream] = streams;
        if (!remoteStream) return;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
        try {
          const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = gain;
          gainNodeRef.current = gainNode;
          remoteSource.connect(gainNode).connect(audioCtx.destination);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.muted = true;
          }
        } catch (err) {
          console.warn("Gain routing failed; using <audio> playback", err);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.volume = 1;
          }
        }
      };

      const dataChannel = pc.createDataChannel("oai-events");
      dataChannel.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as ServerEvent;
          if (event.type === "session.output_transcript.delta" && event.delta) {
            setTranslatedText((prev) => prev + event.delta);
          } else if (
            event.type === "session.input_transcript.delta" &&
            event.delta
          ) {
            setSourceText((prev) => prev + event.delta);
          } else if (event.type === "session.error" || event.type === "error") {
            console.error("Realtime error event", event);
          }
        } catch {}
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "disconnected") {
          setError("接続が切断されました");
          stop();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime/translations/calls",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );
      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(`SDP exchange failed (${sdpRes.status}): ${errText}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("active");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[Translator] start failed", e);
      setError(message);
      setStatus("error");
      cleanup();
    }
  }, [language, gain, cleanup, stop]);

  const onLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  const onGainChange = (e: ChangeEvent<HTMLInputElement>) => {
    setGain(parseFloat(e.target.value));
  };

  const isActive = status === "active";
  const isConnecting = status === "connecting";
  const buttonLabel = isConnecting
    ? "接続中..."
    : isActive
      ? "停止"
      : "翻訳を開始";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <h1 className="text-xl font-semibold tracking-tight">
          Voice Translator
        </h1>
        <p className="text-xs text-slate-400">
          日本語で話すと、相手の言語でスピーカーから再生されます
        </p>
      </header>

      <section className="flex flex-col gap-3 px-5 pb-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">出力言語</span>
          <select
            value={language}
            onChange={onLanguageChange}
            disabled={isActive || isConnecting}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-base text-slate-100 disabled:opacity-50"
          >
            {OUTPUT_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs text-slate-400">
            <span>スピーカー音量 (×{gain.toFixed(1)})</span>
            <span className="text-[10px] text-slate-500">
              大きな声で出すほど歪みやすくなります
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={MAX_GAIN}
            step={0.1}
            value={gain}
            onChange={onGainChange}
            className="accent-indigo-400"
          />
        </label>
      </section>

      <section className="flex flex-1 flex-col gap-3 overflow-hidden px-5 py-3">
        <div className="flex flex-1 flex-col gap-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500">
            <span>入力（日本語）</span>
            <MicMeter level={micLevel} active={isActive} />
          </div>
          <p className="flex-1 overflow-y-auto whitespace-pre-wrap text-base leading-relaxed text-slate-200">
            {sourceText || (
              <span className="text-slate-600">マイクに向かって話してください</span>
            )}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-hidden rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-indigo-300">
            出力（
            {OUTPUT_LANGUAGES.find((l) => l.code === language)?.label ??
              language}
            ）
          </div>
          <p className="flex-1 overflow-y-auto whitespace-pre-wrap text-base leading-relaxed text-indigo-100">
            {translatedText || (
              <span className="text-indigo-500">翻訳結果がここに表示されます</span>
            )}
          </p>
        </div>
      </section>

      {error && (
        <div className="mx-5 mb-2 rounded-lg border border-red-700/60 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <footer className="flex flex-col items-stretch gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {isActive && (
          <div className="text-center text-xs text-slate-400">
            無音検知: 残り{silenceSecondsLeft}秒で自動切断
          </div>
        )}
        <button
          type="button"
          onClick={isActive ? stop : start}
          disabled={isConnecting}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 ${
            isActive
              ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
              : "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
          }`}
        >
          {buttonLabel}
        </button>
      </footer>

      <audio ref={remoteAudioRef} autoPlay playsInline />
    </main>
  );
}

function MicMeter({ level, active }: { level: number; active: boolean }) {
  const pct = Math.round(level * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500">
        {active ? "🎙️" : "⏸"}
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
