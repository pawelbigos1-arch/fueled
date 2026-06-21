"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { addDays, formatDateKey, parseDateKey } from "@/lib/fueled-storage";
import type { DailyReflection } from "@/lib/growth-types";
import VoiceRecordButton from "@/components/VoiceRecordButton";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

const textareaCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60 min-h-[120px] resize-y";

type Props = {
  dateKey: string;
  onBack: () => void;
  onSaved: () => void;
};

export default function DayReflectionView({ dateKey, onBack, onSaved }: Props) {
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("daily_reflections")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", dateKey)
      .maybeSingle();
    if (err) console.error("[DayReflectionView] load:", err.message);
    const row = data as DailyReflection | null;
    setTranscript(row?.transcript ?? "");
    setSummary(row?.summary ?? "");
    setLoading(false);
  }, [dateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function appendTranscript(chunk: string) {
    setTranscript((prev) => {
      const t = chunk.trim();
      if (!t) return prev;
      return prev.trim() ? `${prev.trim()}\n\n${t}` : t;
    });
  }

  async function saveReflection(nextSummary?: string) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      date: dateKey,
      transcript: transcript.trim(),
      summary: (nextSummary ?? summary).trim(),
      updated_at: new Date().toISOString(),
    };

    const { error: err } = await supabase
      .from("daily_reflections")
      .upsert(payload, { onConflict: "user_id,date" });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  async function generateSummary() {
    if (!transcript.trim()) {
      setError("Najpierw wpisz lub nagraj transkrypcję.");
      return;
    }
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/reflection/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim() }),
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok || !data.summary) {
        setError(data.error ?? "Nie udało się wygenerować podsumowania.");
        setSummarizing(false);
        return;
      }
      setSummary(data.summary);
      await saveReflection(data.summary);
    } catch {
      setError("Błąd sieci.");
    } finally {
      setSummarizing(false);
    }
  }

  const dateLabel = parseDateKey(dateKey).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return <p className="text-center text-xs text-white/45">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-[#EF9F27] underline-offset-2 hover:underline"
      >
        ← Lista dni
      </button>

      <h2 className="text-base font-semibold capitalize text-white">{dateLabel}</h2>

      <div className={cardCls}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Transkrypcja
        </p>
        <textarea
          className={textareaCls}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Pisz ręcznie lub nagraj mowę — zapis dosłowny tego, co powiesz…"
        />
        <div className="mt-3">
          <VoiceRecordButton onTranscript={appendTranscript} disabled={saving} />
        </div>
      </div>

      <div className={cardCls}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Podsumowanie refleksji
        </p>
        <div className="min-h-[100px] whitespace-pre-wrap rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white/85">
          {summary || (
            <span className="text-white/35">
              Wygeneruj podsumowanie na podstawie transkrypcji.
            </span>
          )}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveReflection()}
          className="w-full rounded-xl border border-[#333] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Zapisywanie…" : "Zapisz transkrypcję"}
        </button>
        <button
          type="button"
          disabled={summarizing || saving}
          onClick={() => void generateSummary()}
          className="w-full rounded-xl bg-[#EF9F27] py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {summarizing ? "Generuję podsumowanie…" : "Generuj podsumowanie"}
        </button>
      </div>
    </div>
  );
}

export function weekDayKeys(weekStart: string): string[] {
  const keys: string[] = [];
  let d = parseDateKey(weekStart);
  for (let i = 0; i < 7; i += 1) {
    keys.push(formatDateKey(d));
    d = addDays(d, 1);
  }
  return keys;
}
