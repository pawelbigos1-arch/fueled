"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { weekDayKeys } from "@/components/reflection/DayReflectionView";
import SupplementsDictionary from "@/components/supplements/SupplementsDictionary";
import SupplementsWeekPanel from "@/components/supplements/SupplementsWeekPanel";
import { useSupplementsData } from "@/hooks/useSupplementsData";
import {
  computeAutoDetected,
  type ActivityRow,
  type MealRow,
  type WorkoutRow,
} from "@/lib/discipline-auto";
import {
  buildOverrideMap,
  getCellState,
  monthDayKeys,
  monthStartForDate,
  summarizeAll,
} from "@/lib/discipline-summary";
import {
  DEFAULT_DISCIPLINE_TARGETS,
  DISCIPLINE_KINDS,
  DISCIPLINE_KIND_META,
  targetFieldForKind,
  type DisciplineCellState,
  type DisciplineKind,
  type DisciplineTargetsRow,
} from "@/lib/discipline-types";
import {
  addDays,
  formatDateKey,
  getTodayKey,
  parseDateKey,
} from "@/lib/fueled-storage";
import { weekStartMonday } from "@/lib/habit-period";
import { createClient } from "@/lib/supabase";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

const inputCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60";

const DAY_HEADERS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"] as const;

const viewPill =
  "touch-manipulation inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-[#333] px-3 py-2.5 text-[13px] font-medium leading-tight transition active:opacity-90";

function weekLabel(weekStart: string, dayKeys: string[]): string {
  return `${parseDateKey(weekStart).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  })} – ${parseDateKey(dayKeys[6]).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function monthLabel(monthStartKey: string): string {
  return parseDateKey(monthStartKey).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });
}

function cellClass(state: DisciplineCellState): string {
  const base =
    "flex size-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition active:opacity-80";
  if (state.effective && state.override === null && state.auto) {
    return `${base} border-[#3B6D11]/70 bg-[#3B6D11]/80 text-white`;
  }
  if (state.effective && state.override === true) {
    return `${base} border-[#3B6D11] bg-[#3B6D11] text-white`;
  }
  if (!state.effective && state.override === false && state.auto) {
    return `${base} border-red-500/70 bg-transparent text-red-400/90 line-through`;
  }
  if (state.effective) {
    return `${base} border-[#3B6D11] bg-[#3B6D11] text-white`;
  }
  return `${base} border-[#444] bg-[#151515] text-white/25`;
}

function cellSymbol(state: DisciplineCellState): string {
  if (!state.effective) return "";
  if (state.override === null && state.auto) return "⚡";
  return "✓";
}

function SummaryList({
  title,
  summaries,
}: {
  title: string;
  summaries: ReturnType<typeof summarizeAll>;
}) {
  return (
    <div className={cardCls}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {summaries.map((s) => {
          const meta = DISCIPLINE_KIND_META[s.kind];
          return (
            <li
              key={s.kind}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-white/85">{meta.label}</span>
              <span
                className={`tabular-nums font-semibold ${
                  s.met ? "text-[#7BC44A]" : "text-white/70"
                }`}
              >
                {s.count}/{s.target}
                {s.met ? " ✓" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function WeekTab() {
  const [weekStart, setWeekStart] = useState(() => weekStartMonday());
  const [weekView, setWeekView] = useState<"discipline" | "supplements">(
    "discipline"
  );
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [targets, setTargets] = useState<
    Omit<DisciplineTargetsRow, "user_id" | "updated_at">
  >(DEFAULT_DISCIPLINE_TARGETS);
  const [draftTargets, setDraftTargets] = useState(targets);
  const [overrideRows, setOverrideRows] = useState<
    { date: string; kind: DisciplineKind; done: boolean }[]
  >([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2200);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  const todayKey = getTodayKey();
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart]);
  const { bundle: supplementBundle, reload: reloadSupplements } =
    useSupplementsData(dayKeys[0], dayKeys[6]);
  const monthStartKey = useMemo(
    () => monthStartForDate(weekStart),
    [weekStart]
  );
  const monthKeys = useMemo(
    () => monthDayKeys(monthStartKey),
    [monthStartKey]
  );

  const loadRangeStart = useMemo(() => {
    return monthStartKey < weekStart ? monthStartKey : weekStart;
  }, [monthStartKey, weekStart]);

  const loadRangeEnd = useMemo(() => {
    const weekEnd = dayKeys[6];
    const monthEndKey = monthKeys[monthKeys.length - 1];
    return weekEnd > monthEndKey ? weekEnd : monthEndKey;
  }, [dayKeys, monthKeys]);

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

    const [
      targetsRes,
      overridesRes,
      goalsRes,
      mealsRes,
      workoutsRes,
      activitiesRes,
    ] = await Promise.all([
      supabase
        .from("discipline_targets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("discipline_overrides")
        .select("date, kind, done")
        .eq("user_id", user.id)
        .gte("date", loadRangeStart)
        .lte("date", loadRangeEnd),
      supabase.from("goals").select("kcal").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("meals")
        .select("date, kcal")
        .eq("user_id", user.id)
        .gte("date", loadRangeStart)
        .lte("date", loadRangeEnd),
      supabase
        .from("workout_log")
        .select("date, exercise, category, measurement_profile")
        .eq("user_id", user.id)
        .gte("date", loadRangeStart)
        .lte("date", loadRangeEnd),
      supabase
        .from("activities")
        .select("date, name, metadata")
        .eq("user_id", user.id)
        .gte("date", loadRangeStart)
        .lte("date", loadRangeEnd),
    ]);

    if (targetsRes.error) {
      console.error("[WeekTab] targets:", targetsRes.error.message);
    } else if (!targetsRes.data) {
      const { error: seedErr } = await supabase.from("discipline_targets").insert({
        user_id: user.id,
        ...DEFAULT_DISCIPLINE_TARGETS,
      });
      if (seedErr) console.error("[WeekTab] seed targets:", seedErr.message);
    } else {
      const row = targetsRes.data as DisciplineTargetsRow;
      const next = {
        diet_weekly: row.diet_weekly,
        no_sweets_weekly: row.no_sweets_weekly,
        stretching_weekly: row.stretching_weekly,
        strength_weekly: row.strength_weekly,
        cardio_weekly: row.cardio_weekly,
        pool_weekly: row.pool_weekly,
      };
      setTargets(next);
      setDraftTargets(next);
    }

    if (overridesRes.error) {
      console.error("[WeekTab] overrides:", overridesRes.error.message);
    } else {
      setOverrideRows(
        (overridesRes.data ?? []) as {
          date: string;
          kind: DisciplineKind;
          done: boolean;
        }[]
      );
    }

    if (goalsRes.error) {
      console.error("[WeekTab] goals:", goalsRes.error.message);
    } else {
      const kcal = Number((goalsRes.data as { kcal?: number } | null)?.kcal);
      if (Number.isFinite(kcal) && kcal > 0) setCalorieGoal(kcal);
    }

    if (mealsRes.error) {
      console.error("[WeekTab] meals:", mealsRes.error.message);
    } else {
      setMeals((mealsRes.data ?? []) as MealRow[]);
    }

    if (workoutsRes.error) {
      console.error("[WeekTab] workouts:", workoutsRes.error.message);
    } else {
      setWorkouts((workoutsRes.data ?? []) as WorkoutRow[]);
    }

    if (activitiesRes.error) {
      console.error("[WeekTab] activities:", activitiesRes.error.message);
    } else {
      setActivities((activitiesRes.data ?? []) as ActivityRow[]);
    }

    setLoading(false);
  }, [loadRangeEnd, loadRangeStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const allLoadDates = useMemo(() => {
    const set = new Set([...dayKeys, ...monthKeys]);
    return [...set];
  }, [dayKeys, monthKeys]);

  const autoMap = useMemo(
    () =>
      computeAutoDetected(
        allLoadDates,
        meals,
        calorieGoal,
        workouts,
        activities
      ),
    [allLoadDates, meals, calorieGoal, workouts, activities]
  );

  const overrideMap = useMemo(
    () => buildOverrideMap(overrideRows),
    [overrideRows]
  );

  const weekSummaries = useMemo(
    () =>
      summarizeAll(autoMap, overrideMap, dayKeys, targets, "week", monthStartKey),
    [autoMap, overrideMap, dayKeys, targets, monthStartKey]
  );

  const monthSummaries = useMemo(
    () =>
      summarizeAll(
        autoMap,
        overrideMap,
        monthKeys,
        targets,
        "month",
        monthStartKey
      ),
    [autoMap, overrideMap, monthKeys, targets, monthStartKey]
  );

  function shiftWeek(delta: number) {
    const d = parseDateKey(weekStart);
    setWeekStart(formatDateKey(addDays(d, delta * 7)));
  }

  async function toggleCell(date: string, kind: DisciplineKind) {
    const key = `${date}:${kind}`;
    if (toggling === key) return;
    setToggling(key);

    const state = getCellState(autoMap, overrideMap, date, kind);
    const newEffective = !state.effective;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setToggling(null);
      return;
    }

    if (newEffective === state.auto) {
      const { error } = await supabase
        .from("discipline_overrides")
        .delete()
        .eq("user_id", user.id)
        .eq("date", date)
        .eq("kind", kind);
      if (error) console.error("[WeekTab] delete override:", error.message);
      else {
        setOverrideRows((prev) =>
          prev.filter((r) => !(r.date === date && r.kind === kind))
        );
      }
    } else {
      const { error } = await supabase.from("discipline_overrides").upsert(
        {
          user_id: user.id,
          date,
          kind,
          done: newEffective,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date,kind" }
      );
      if (error) console.error("[WeekTab] upsert override:", error.message);
      else {
        setOverrideRows((prev) => {
          const rest = prev.filter((r) => !(r.date === date && r.kind === kind));
          return [...rest, { date, kind, done: newEffective }];
        });
      }
    }

    setToggling(null);
  }

  async function saveTargets(e: React.FormEvent) {
    e.preventDefault();
    setSavingTargets(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingTargets(false);
      return;
    }

    const payload = {
      user_id: user.id,
      ...draftTargets,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("discipline_targets")
      .upsert(payload, { onConflict: "user_id" });
    if (error) console.error("[WeekTab] save targets:", error.message);
    else {
      setTargets(draftTargets);
      setTargetsOpen(false);
    }
    setSavingTargets(false);
  }

  if (loading) {
    return <p className="text-center text-xs text-white/45">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4 pb-24 text-white">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/85">
          Tydzień
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDictionaryOpen(false);
              setDraftTargets(targets);
              setTargetsOpen((v) => !v);
            }}
            className="rounded-lg border border-[#333] px-3 py-1.5 text-[12px] text-white/75"
          >
            {targetsOpen ? "Zamknij cele" : "Cele"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetsOpen(false);
              setDictionaryOpen((v) => !v);
            }}
            className="rounded-lg border border-[#333] px-3 py-1.5 text-[12px] text-white/75"
          >
            {dictionaryOpen ? "Zamknij słownik" : "Słownik"}
          </button>
        </div>
      </div>

      {dictionaryOpen ? (
        <SupplementsDictionary
          bundle={supplementBundle}
          onChanged={() => void reloadSupplements()}
        />
      ) : null}

      {targetsOpen ? (
        <form onSubmit={(e) => void saveTargets(e)} className={`${cardCls} space-y-3`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Targety (tydzień)
          </p>
          {DISCIPLINE_KINDS.map((kind) => {
            const meta = DISCIPLINE_KIND_META[kind];
            const field = targetFieldForKind(kind);
            return (
              <label key={kind} className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/85">{meta.label}</span>
                <input
                  type="number"
                  min={0}
                  max={31}
                  className={`${inputCls} w-20 text-center tabular-nums`}
                  value={draftTargets[field]}
                  onChange={(e) =>
                    setDraftTargets((prev) => ({
                      ...prev,
                      [field]: Math.max(
                        0,
                        Math.min(31, Math.round(Number(e.target.value) || 0))
                      ),
                    }))
                  }
                />
              </label>
            );
          })}
          <button
            type="submit"
            disabled={savingTargets}
            className="w-full rounded-xl bg-[#EF9F27] py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {savingTargets ? "Zapisywanie…" : "Zapisz cele"}
          </button>
        </form>
      ) : null}

      {!targetsOpen && !dictionaryOpen ? (
        <>
          <nav className="flex gap-2" aria-label="Widok tygodnia">
            {(
              [
                ["discipline", "Dyscyplina"],
                ["supplements", "Suplementy"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWeekView(id)}
                className={`${viewPill} ${
                  weekView === id
                    ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                    : "text-white/72"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftWeek(-1)}
              className="rounded-lg border border-[#333] px-3 py-1.5 text-sm"
            >
              ←
            </button>
            <span className="text-center text-sm font-medium text-white/85">
              {weekLabel(weekStart, dayKeys)}
            </span>
            <button
              type="button"
              onClick={() => shiftWeek(1)}
              className="rounded-lg border border-[#333] px-3 py-1.5 text-sm"
            >
              →
            </button>
          </div>

          {weekView === "supplements" ? (
            <SupplementsWeekPanel weekStart={weekStart} />
          ) : (
            <>
              <SummaryList title="Podsumowanie tygodnia" summaries={weekSummaries} />

              <div className={`${cardCls} overflow-x-auto`}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Macierz tygodnia
        </p>
        <div className="min-w-[340px]">
          <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))_28px] gap-1 text-[10px]">
            <span />
            {DAY_HEADERS.map((h, i) => (
              <span
                key={h}
                className={`py-1 text-center font-semibold uppercase text-white/45 ${
                  dayKeys[i] === todayKey ? "text-[#EF9F27]" : ""
                }`}
              >
                {h}
              </span>
            ))}
            <span className="py-1 text-center font-semibold text-white/45">Σ</span>

            {DISCIPLINE_KINDS.map((kind) => {
              const meta = DISCIPLINE_KIND_META[kind];
              const rowSummary = weekSummaries.find((s) => s.kind === kind);
              return (
                <div key={kind} className="contents">
                  <span
                    className="flex items-center py-1 pr-1 text-[10px] leading-tight text-white/70"
                    title={meta.label}
                  >
                    {meta.shortLabel}
                  </span>
                  {dayKeys.map((dk) => {
                    const state = getCellState(autoMap, overrideMap, dk, kind);
                    const isToday = dk === todayKey;
                    return (
                      <div
                        key={`${kind}-${dk}`}
                        className="flex items-center justify-center py-0.5"
                      >
                        <button
                          type="button"
                          disabled={toggling === `${dk}:${kind}`}
                          onClick={() => void toggleCell(dk, kind)}
                          className={`${cellClass(state)} ${
                            isToday
                              ? "ring-1 ring-[#EF9F27] ring-offset-1 ring-offset-[#1E1E1E]"
                              : ""
                          }`}
                          aria-pressed={state.effective}
                          title={`${meta.label} — ${dk}`}
                        >
                          {cellSymbol(state)}
                        </button>
                      </div>
                    );
                  })}
                  <span className="flex items-center justify-center py-1 text-[10px] tabular-nums font-semibold text-white/60">
                    {rowSummary?.count ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/35">
          ⚡ auto · ✓ ręcznie · przekreślone = wyłączone mimo autowykrywania
        </p>
      </div>

      <SummaryList
        title={`Podsumowanie miesiąca — ${monthLabel(monthStartKey)}`}
        summaries={monthSummaries}
      />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
