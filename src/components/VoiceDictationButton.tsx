"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((
        ev: { resultIndex: number; results: SpeechRecognitionResultList }
      ) => void)
    | null;
  onerror: ((ev: { error: string; message: string }) => void) | null;
  onend: (() => void) | null;
};

function getCtor(): { new (): RecognitionInstance } | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: { new (): RecognitionInstance };
    webkitSpeechRecognition?: { new (): RecognitionInstance };
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function appendFinalTranscripts(
  ev: { resultIndex: number; results: SpeechRecognitionResultList },
  consume: (t: string) => void
): boolean {
  let any = false;
  for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
    const part = ev.results.item(i);
    if (!part?.isFinal) continue;
    const t = part.item(0)?.transcript?.trim();
    if (t) {
      consume(t);
      any = true;
    }
  }
  return any;
}

/** Mikrofon → tekst w polu (przeglądarka); potem użytkownik wysyła jak zwykle do parsowania kcal. */
export default function VoiceDictationButton({
  onAppendTranscript,
  disabled,
}: {
  onAppendTranscript: (spoken: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const recRef = useRef<RecognitionInstance | null>(null);
  const receivedFinalRef = useRef(false);
  const lastInterimRef = useRef("");
  const appendRef = useRef(onAppendTranscript);

  appendRef.current = onAppendTranscript;

  const [supported] = useState(() => !!getCtor());

  const forceAbort = useCallback(() => {
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  /** Kończenie przyciskiem „Stop” — musi być `.stop()`, nie `.abort()`, żeby przeglądarka dopisała wynik. */
  const requestStopListening = useCallback(() => {
    const r = recRef.current;
    if (!r) {
      setListening(false);
      return;
    }
    try {
      r.stop();
    } catch {
      forceAbort();
    }
  }, [forceAbort]);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    },
    []
  );

  const toggle = useCallback(() => {
    if (listening) {
      requestStopListening();
      return;
    }

    const Ctor = getCtor();
    if (!Ctor || disabled) return;

    setHint(null);
    receivedFinalRef.current = false;
    lastInterimRef.current = "";

    const r = new Ctor();
    r.lang = "pl-PL";
    r.continuous = true;
    r.interimResults = true;

    const pushFinalChunk = (t: string) => {
      receivedFinalRef.current = true;
      lastInterimRef.current = "";
      appendRef.current(t);
    };

    r.onresult = (ev) => {
      appendFinalTranscripts(ev, pushFinalChunk);
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const part = ev.results.item(i);
        if (!part?.isFinal) {
          const live = part.item(0)?.transcript?.trim() ?? "";
          if (live) lastInterimRef.current = live;
        }
      }
    };

    r.onerror = (ev) => {
      if (ev.error === "aborted") return;
      if (ev.error === "no-speech") {
        setHint((prev) =>
          prev ??
          "Nic nie zostało wyłapane — mów przy włączonym „Mów”, potem krótko „Stop”."
        );
        return;
      }
      if (
        ev.error === "not-allowed" ||
        ev.error === "permission-denied"
      ) {
        setHint("Brak dostępu do mikrofonu.");
      } else if (ev.error === "audio-capture") {
        setHint("Nie znaleziono mikrofonu.");
      } else if (ev.error === "network") {
        setHint(
          "Brak sieci lub serwis mowy niedostępny — Chrome często wymaga Internetu."
        );
      } else {
        setHint(`Mowa: ${ev.error}`);
      }
    };

    r.onend = () => {
      recRef.current = null;
      setListening(false);

      if (!receivedFinalRef.current && lastInterimRef.current.trim()) {
        appendRef.current(lastInterimRef.current.trim());
        receivedFinalRef.current = true;
      }
      lastInterimRef.current = "";

      if (!receivedFinalRef.current) {
        setHint((prev) =>
          prev ??
          "Brak dopisanego tekstu. Najpierw mów przy „Mów”, przerwa po zdaniu, dopiero wtedy „Stop”."
        );
      }
    };

    try {
      r.start();
      recRef.current = r;
      setListening(true);
    } catch {
      setHint("Nie można uruchomić rozpoznawania mowy.");
      recRef.current = null;
      setListening(false);
    }
  }, [listening, disabled, requestStopListening]);

  if (!supported) {
    return (
      <p
        className="text-[10px] text-white/35"
        title="Wypróbuj Chrome lub Edge na Androidzie / Desktop"
      >
        Mowa: nieobsługiwane
      </p>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Zatrzymaj dyktowanie" : "Dyktuj — tekst w polu"}
        className={`touch-manipulation shrink-0 whitespace-nowrap rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-45 ${
          listening
            ? "border-red-400/70 bg-red-950/35 text-red-200"
            : "border-white/25 bg-transparent text-white hover:border-[#EF9F27]/50 hover:bg-white/5"
        }`}
      >
        {listening ? "Stop" : "Mów"}
      </button>
      {hint ? <p className="text-[10px] text-amber-400/95">{hint}</p> : null}
    </div>
  );
}
