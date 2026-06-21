"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function VoiceRecordButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!(
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof MediaRecorder !== "undefined"
    );
  });

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupStream();
      return;
    }

    setBusy(true);
    setHint("Przetwarzanie mowy…");

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const mime = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    cleanupStream();

    if (blob.size < 100) {
      setHint("Nagranie zbyt krótkie — spróbuj ponownie.");
      setBusy(false);
      return;
    }

    try {
      const ext = mime.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("audio", blob, `reflection.${ext}`);

      const res = await fetch("/api/reflection/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok || !data.transcript) {
        setHint(data.error ?? "Transkrypcja nie powiodła się.");
        setBusy(false);
        return;
      }
      onTranscript(data.transcript);
      setHint(null);
    } catch {
      setHint("Błąd sieci podczas transkrypcji.");
    } finally {
      setBusy(false);
    }
  }, [cleanupStream, onTranscript]);

  const startRecording = useCallback(async () => {
    if (disabled || busy || recording) return;
    setHint(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.start(250);
      mediaRef.current = recorder;
      setRecording(true);
    } catch {
      setHint("Brak dostępu do mikrofonu.");
      cleanupStream();
    }
  }, [busy, cleanupStream, disabled, recording]);

  const toggle = useCallback(() => {
    if (recording) void stopAndTranscribe();
    else void startRecording();
  }, [recording, startRecording, stopAndTranscribe]);

  if (!supported) {
    return (
      <p className="text-[10px] text-white/35">
        Nagrywanie niedostępne — użyj pola tekstowego.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={toggle}
        aria-pressed={recording}
        className={`touch-manipulation rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-45 ${
          recording
            ? "border-red-400/70 bg-red-950/35 text-red-200"
            : "border-white/25 bg-transparent text-white hover:border-[#EF9F27]/50"
        }`}
      >
        {busy ? "…" : recording ? "Stop i transkrybuj" : "Nagraj mowę"}
      </button>
      {hint ? <p className="text-[10px] text-amber-400/95">{hint}</p> : null}
    </div>
  );
}
