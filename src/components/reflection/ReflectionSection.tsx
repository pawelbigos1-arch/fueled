"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { addDays, formatDateKey } from "@/lib/fueled-storage";
import type { StatsRange } from "@/lib/date-range";
import { startDateForRange } from "@/lib/date-range";
import type { DailyReflection, ReflectionViewMode } from "@/lib/growth-types";
import DayReflectionView from "@/components/reflection/DayReflectionView";
import WeekReflectionPanel from "@/components/reflection/WeekReflectionPanel";

const RANGES: StatsRange[] = ["7d", "14d", "1m", "2m", "3m", "6m", "1r"];

const pill =
  "rounded-[10px] border border-[#333] px-3 py-1.5 text-xs font-medium transition bg-[#151515]";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

function buildExportText(rows: DailyReflection[]): string {
  return rows
    .map((r) => {
      const header = `=== ${r.date} ===`;
      const body = r.transcript.trim() || "(brak transkrypcji)";
      return `${header}\n${body}`;
    })
    .join("\n\n");
}

export default function ReflectionSection() {
  const today = formatDateKey(new Date());
  const [viewMode, setViewMode] = useState<ReflectionViewMode>("day");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportRange, setExportRange] = useState<StatsRange>("1m");
  const [exporting, setExporting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setReflections([]);
      setLoading(false);
      return;
    }

    const start = formatDateKey(startDateForRange("1r"));
    const { data, error } = await supabase
      .from("daily_reflections")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start)
      .order("date", { ascending: false });
    if (error) console.error("[ReflectionSection] load:", error.message);
    setReflections((data ?? []) as DailyReflection[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const reflectionDates = useMemo(
    () => new Set(reflections.map((r) => r.date)),
    [reflections]
  );

  const dayList = useMemo(() => {
    const keys: string[] = [];
    let d = new Date();
    for (let i = 0; i < 90; i += 1) {
      keys.push(formatDateKey(d));
      d = addDays(d, -1);
    }
    keys.sort((a, b) => (a < b ? 1 : -1));
    if (keys[0] !== today) {
      const withoutToday = keys.filter((k) => k !== today);
      return [today, ...withoutToday];
    }
    return keys;
  }, [today]);

  async function exportTranscripts() {
    setExporting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setExporting(false);
      return;
    }

    const start = formatDateKey(startDateForRange(exportRange));
    const end = today;
    const { data, error } = await supabase
      .from("daily_reflections")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (error) {
      console.error("[ReflectionSection] export:", error.message);
      setExporting(false);
      return;
    }

    const rows = ((data ?? []) as DailyReflection[]).filter((r) =>
      r.transcript.trim()
    );
    if (rows.length === 0) {
      alert("Brak transkrypcji w wybranym zakresie.");
      setExporting(false);
      return;
    }

    const text = buildExportText(rows);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fueled-refleksje-${start}_${end}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  if (selectedDay) {
    return (
      <DayReflectionView
        dateKey={selectedDay}
        onBack={() => {
          setSelectedDay(null);
          void loadList();
        }}
        onSaved={() => void loadList()}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/85">
        Refleksje
      </h2>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["day", "Dzień"],
            ["week", "Tydzień"],
            ["export", "Eksport"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`${pill} ${
              viewMode === mode
                ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                : "text-white/72"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === "week" ? (
        <WeekReflectionPanel onOpenDay={setSelectedDay} />
      ) : null}

      {viewMode === "export" ? (
        <div className={`${cardCls} space-y-3`}>
          <p className="text-sm text-white/75">
            Pobierz plik .txt ze wszystkimi transkrypcjami z wybranego okresu.
          </p>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setExportRange(r)}
                className={`${pill} ${
                  exportRange === r
                    ? "border-[#EF9F27]/55 bg-[#EF9F27]/14"
                    : "text-white/60"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportTranscripts()}
            className="w-full rounded-xl bg-[#EF9F27] py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {exporting ? "Przygotowuję…" : "Pobierz transkrypcje (.txt)"}
          </button>
        </div>
      ) : null}

      {viewMode === "day" ? (
        loading ? (
          <p className="text-center text-xs text-white/45">Ładowanie…</p>
        ) : (
          <ul className="space-y-2">
            {dayList.map((dk) => {
              const isToday = dk === today;
              const hasEntry = reflectionDates.has(dk);
              const label = new Date(dk + "T12:00:00").toLocaleDateString(
                "pl-PL",
                {
                  weekday: isToday ? "long" : "short",
                  day: "numeric",
                  month: "short",
                }
              );

              return (
                <li key={dk}>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(dk)}
                    className={`${cardCls} flex w-full items-center justify-between gap-2 text-left`}
                  >
                    <span className="font-medium capitalize text-white">
                      {isToday ? `Dziś · ${label}` : label}
                    </span>
                    {hasEntry ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-[#EF9F27]"
                        title="Jest wpis"
                      />
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
