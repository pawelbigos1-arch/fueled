"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { addDays, formatDateKey, parseDateKey } from "@/lib/fueled-storage";
import { weekStartMonday } from "@/lib/habit-period";
import type { DailyReflection } from "@/lib/growth-types";
import { weekDayKeys } from "@/components/reflection/DayReflectionView";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

type Props = {
  onOpenDay: (dateKey: string) => void;
};

export default function WeekReflectionPanel({ onOpenDay }: Props) {
  const [weekStart, setWeekStart] = useState(() => weekStartMonday());
  const [entries, setEntries] = useState<DailyReflection[]>([]);
  const [weekSummary, setWeekSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEntries([]);
      setWeekSummary("");
      setLoading(false);
      return;
    }

    const keys = weekDayKeys(weekStart);
    const end = keys[6];
    const { data: rows, error: re } = await supabase
      .from("daily_reflections")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", end)
      .order("date", { ascending: true });
    if (re) console.error("[WeekReflectionPanel] reflections:", re.message);
    setEntries((rows ?? []) as DailyReflection[]);

    const { data: ws, error: we } = await supabase
      .from("weekly_reflection_summaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (we) console.error("[WeekReflectionPanel] week summary:", we.message);
    setWeekSummary((ws as { summary?: string } | null)?.summary ?? "");
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  function shiftWeek(delta: number) {
    const d = parseDateKey(weekStart);
    setWeekStart(formatDateKey(addDays(d, delta * 7)));
  }

  async function generateWeekSummary() {
    const withContent = entries.filter(
      (e) => e.transcript.trim() || e.summary.trim()
    );
    if (withContent.length === 0) {
      setError("Brak refleksji w tym tygodniu.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/reflection/week-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: withContent.map((e) => ({
            date: e.date,
            transcript: e.transcript,
            summary: e.summary,
          })),
        }),
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok || !data.summary) {
        setError(data.error ?? "Nie udało się wygenerować podsumowania tygodnia.");
        setGenerating(false);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("weekly_reflection_summaries").upsert(
          {
            user_id: user.id,
            week_start: weekStart,
            summary: data.summary,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,week_start" }
        );
      }
      setWeekSummary(data.summary);
    } catch {
      setError("Błąd sieci.");
    } finally {
      setGenerating(false);
    }
  }

  const weekLabel = `${parseDateKey(weekStart).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  })} – ${parseDateKey(dayKeys[6]).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  const entryByDate = new Map(entries.map((e) => [e.date, e]));

  if (loading) {
    return <p className="text-center text-xs text-white/45">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          className="rounded-lg border border-[#333] px-3 py-1.5 text-sm"
        >
          ←
        </button>
        <span className="text-sm font-medium text-white/85">{weekLabel}</span>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          className="rounded-lg border border-[#333] px-3 py-1.5 text-sm"
        >
          →
        </button>
      </div>

      <ul className="space-y-2">
        {dayKeys.map((dk) => {
          const entry = entryByDate.get(dk);
          const hasContent =
            !!entry && (entry.transcript.trim() || entry.summary.trim());
          const preview = entry?.summary?.trim() || entry?.transcript?.trim() || "";
          const dayName = parseDateKey(dk).toLocaleDateString("pl-PL", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });

          return (
            <li key={dk}>
              <button
                type="button"
                onClick={() => onOpenDay(dk)}
                className={`${cardCls} w-full text-left transition active:opacity-90`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize text-white">{dayName}</span>
                  {hasContent ? (
                    <span className="size-2 rounded-full bg-[#EF9F27]" aria-hidden />
                  ) : null}
                </div>
                {preview ? (
                  <p className="mt-1 line-clamp-2 text-xs text-white/55">
                    {preview.slice(0, 120)}
                    {preview.length > 120 ? "…" : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-white/30">Brak wpisu</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={cardCls}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Podsumowanie tygodnia
        </p>
        <div className="min-h-[80px] whitespace-pre-wrap text-sm text-white/85">
          {weekSummary || (
            <span className="text-white/35">
              Wygeneruj syntezę siedmiu dni.
            </span>
          )}
        </div>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        <button
          type="button"
          disabled={generating}
          onClick={() => void generateWeekSummary()}
          className="mt-3 w-full rounded-xl bg-[#EF9F27] py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {generating ? "Generuję…" : "Generuj podsumowanie tygodnia"}
        </button>
      </div>
    </div>
  );
}
