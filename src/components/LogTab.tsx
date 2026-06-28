"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EXERCISE_CATEGORIES,
  mergeDictWithDefaults,
  type DictStore,
  type ExerciseCategory,
} from "@/lib/exercise-catalog";
import { LS_DICT } from "@/lib/fueled-storage";
import type { LogEntry, LogSet } from "@/lib/fueled-storage";
import { addDays, formatDateKey, parseDateKey } from "@/lib/fueled-storage";
import { createClient } from "@/lib/supabase";
import {
  parseKey,
  type StatsRange,
  isDateKeyInRange,
} from "@/lib/date-range";
import ExerciseMaxChart from "@/components/ExerciseMaxChart";
import RunEntryForm, { type RunEntryValues } from "@/components/RunEntryForm";
import ExerciseEntryForm from "@/components/ExerciseEntryForm";
import {
  MEASUREMENT_PROFILE_LABELS,
  chartLabelForProfile,
  chartUnitForProfile,
  formatSetLabelForProfile,
  inferProfileFromSet,
  maxChartValueForSets,
  resolveExerciseProfile,
  type MeasurementProfile,
} from "@/lib/measurement-profiles";

const RANGES: StatsRange[] = [
  "7d",
  "14d",
  "1m",
  "2m",
  "3m",
  "6m",
  "1r",
];

const sectionLabel =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52";

const panelBtn =
  "touch-manipulation inline-flex min-h-[48px] items-center justify-center rounded-[14px] border px-4 py-3 text-[15px] font-medium transition active:opacity-90";

const pill =
  "touch-manipulation inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#333] px-4 py-2.5 text-[14px] font-medium leading-tight transition active:opacity-90";

function loadDict(): DictStore {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(LS_DICT);
  const stored = raw
    ? (JSON.parse(raw) as DictStore | null)
    : null;
  return mergeDictWithDefaults(stored);
}

function saveDict(d: DictStore) {
  localStorage.setItem(LS_DICT, JSON.stringify(d));
}

function setsToJsonDb(sets: LogSet[]): Record<string, unknown>[] {
  return sets.map((s) => {
    const out: Record<string, unknown> = {
      series: s.series ?? 1,
    };
    if (s.reps != null) out.reps = s.reps;
    if (s.weight != null) out.weight = s.weight;
    if (s.distance_km != null) out.distance_km = s.distance_km;
    if (s.duration_sec != null) out.duration_sec = s.duration_sec;
    if (s.pace_min_per_km != null) out.pace_min_per_km = s.pace_min_per_km;
    if (s.steps != null) out.steps = s.steps;
    if (s.kcal_burned != null) out.kcal_burned = s.kcal_burned;
    if (s.negative_duration_sec != null) {
      out.negative_duration_sec = s.negative_duration_sec;
    }
    return out;
  });
}

function setsFromJsonDb(raw: unknown): LogSet[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const x = item as Record<string, unknown>;
    const series = Math.max(1, Math.round(Number(x.series) || 1));
    const set: LogSet = { series };
    if (Number.isFinite(Number(x.reps))) set.reps = Math.round(Number(x.reps));
    if (Number.isFinite(Number(x.weight))) set.weight = Number(x.weight);
    if (Number.isFinite(Number(x.distance_km))) set.distance_km = Number(x.distance_km);
    if (Number.isFinite(Number(x.duration_sec))) set.duration_sec = Math.round(Number(x.duration_sec));
    if (Number.isFinite(Number(x.pace_min_per_km))) set.pace_min_per_km = Number(x.pace_min_per_km);
    if (Number.isFinite(Number(x.steps))) set.steps = Math.round(Number(x.steps));
    if (Number.isFinite(Number(x.kcal_burned))) set.kcal_burned = Math.round(Number(x.kcal_burned));
    if (Number.isFinite(Number(x.negative_duration_sec))) {
      set.negative_duration_sec = Math.round(Number(x.negative_duration_sec));
    }
    return set;
  });
}

type WorkoutRowDb = {
  id: string;
  date: string;
  exercise: string;
  category: string;
  sets: unknown;
  measurement_profile?: string | null;
};

function rowToEntry(r: WorkoutRowDb): LogEntry {
  return {
    id: r.id,
    date: r.date,
    exercise: r.exercise,
    category: r.category,
    sets: setsFromJsonDb(r.sets),
  };
}

function displayProfileForEntry(
  dict: DictStore,
  category: string,
  exercise: string,
  sets: LogSet[]
): MeasurementProfile {
  const fromDict = resolveExerciseProfile(dict, category, exercise);
  if (sets.length > 0) {
    const inferred = inferProfileFromSet(sets[0]);
    if (inferred === "running" || inferred === "farmer_carry") return inferred;
  }
  return fromDict;
}

export default function LogTab() {
  const [mounted, setMounted] = useState(false);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);

  /** daily | calendar shell */
  const [shellMode, setShellMode] = useState<"daily" | "calendar">("daily");
  const [dailyDateKey, setDailyDateKey] = useState(() =>
    formatDateKey(new Date())
  );

  /** calendar browsing */
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [dict, setDict] = useState<DictStore>({});

  const [category, setCategory] = useState<ExerciseCategory>("Klatka");
  const [exerciseSel, setExerciseSel] = useState<string>("");
  const [chips, setChips] = useState<string[]>([]);
  const [chipSets, setChipSets] = useState<LogSet[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<StatsRange>("14d");
  const [runSaving, setRunSaving] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [dictNewName, setDictNewName] = useState("");
  const [dictCategory, setDictCategory] = useState<ExerciseCategory>("Klatka");

  /** Ostatnie 56 dni: liczba posiłków wg daty — do podglądu historii */
  const [mealCountByDate, setMealCountByDate] = useState<
    Record<string, number>
  >({});
  /** Ostatnie 90 dni: podpowiedź kalendarza */
  const [datesWithWorkouts, setDatesWithWorkouts] = useState<Set<string>>(
    () => new Set()
  );
  const [datesWithMeals, setDatesWithMeals] = useState<Set<string>>(
    () => new Set()
  );
  const [datesWithPlan, setDatesWithPlan] = useState<Set<string>>(
    () => new Set()
  );
  const [dataReady, setDataReady] = useState(false);

  const reloadWorkoutLogs = useCallback(async () => {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setLogs([]);
      return;
    }
    const cutoff = formatDateKey(addDays(new Date(), -800));
    const { data, error } = await sb
      .from("workout_log")
      .select("id,date,exercise,category,sets")
      .eq("user_id", user.id)
      .gte("date", cutoff)
      .order("date", { ascending: false })
      .limit(2000);

    if (error) {
      console.error("[LogTab] workout_log:", error.message);
      setLogs([]);
      return;
    }
    setLogs(((data ?? []) as WorkoutRowDb[]).map(rowToEntry));
  }, []);

  const reloadCalendarMarks = useCallback(async () => {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;

    const start = formatDateKey(addDays(new Date(), -90));
    const end = formatDateKey(new Date());

    const [{ data: wDates, error: ew }, { data: mDates, error: em }, { data: planRows, error: ep }] =
      await Promise.all([
        sb
          .from("workout_log")
          .select("date")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
        sb
          .from("meals")
          .select("date")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
        sb
          .from("meal_plans")
          .select("date,meals")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
      ]);

    if (ew) console.error("[LogTab] calendar workouts:", ew.message);
    if (em) console.error("[LogTab] calendar meals:", em.message);
    if (ep) console.error("[LogTab] calendar plans:", ep.message);

    setDatesWithWorkouts(
      new Set((wDates ?? []).map((r: { date: string }) => r.date).filter(Boolean))
    );
    setDatesWithMeals(
      new Set((mDates ?? []).map((r: { date: string }) => r.date).filter(Boolean))
    );

    const planDates = new Set<string>();
    for (const row of planRows ?? []) {
      const r = row as { date?: string; meals?: unknown };
      if (!r.date) continue;
      const meals = Array.isArray(r.meals) ? r.meals : [];
      if (meals.length > 0) planDates.add(r.date);
    }
    setDatesWithPlan(planDates);
  }, []);

  const reloadMealCountsForHistory = useCallback(async () => {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setMealCountByDate({});
      return;
    }
    const start = formatDateKey(addDays(new Date(), -56));
    const end = formatDateKey(new Date());
    const { data, error } = await sb
      .from("meals")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end);

    if (error) {
      console.error("[LogTab] meal counts:", error.message);
      return;
    }

    const tally: Record<string, number> = {};
    ((data ?? []) as { date: string }[]).forEach(({ date }) => {
      if (!date) return;
      tally[date] = (tally[date] ?? 0) + 1;
    });
    setMealCountByDate(tally);
  }, []);

  useEffect(() => {
    setMounted(true);
    setDict(loadDict());

    async function hydrate() {
      setDataReady(false);
      await Promise.all([
        reloadWorkoutLogs(),
        reloadCalendarMarks(),
        reloadMealCountsForHistory(),
      ]);
      setDataReady(true);
    }
    void hydrate();
  }, [reloadWorkoutLogs, reloadCalendarMarks, reloadMealCountsForHistory]);

  const persistDict = (next: DictStore) => {
    const merged = mergeDictWithDefaults(next);
    setDict(merged);
    saveDict(merged);
  };

  const visibleExercises = useMemo(() => {
    const list = dict[category] ?? [];
    return list.filter((e) => e.visible !== false).map((e) => e.name);
  }, [dict, category]);

  const exercisesForCategories = dict;

  /** --- dictionary editor --- */

  function toggleExerciseVisible(cat: ExerciseCategory, name: string) {
    const next: DictStore = { ...dict, [cat]: [...(dict[cat] ?? [])] };
    const arr = [...(next[cat] ?? [])];
    const i = arr.findIndex((x) => x.name === name);
    if (i >= 0) {
      arr[i] = { ...arr[i], visible: !arr[i].visible };
    }
    next[cat] = arr;
    persistDict(next);
  }

  function setExerciseProfile(
    cat: ExerciseCategory,
    name: string,
    profile: MeasurementProfile
  ) {
    const next: DictStore = { ...dict, [cat]: [...(dict[cat] ?? [])] };
    const arr = [...(next[cat] ?? [])];
    const i = arr.findIndex((x) => x.name === name);
    if (i < 0) return;
    arr[i] = {
      ...arr[i],
      measurementProfile: profile,
      progressBy: profile === "bodyweight" ? "reps" : undefined,
    };
    next[cat] = arr;
    persistDict(next);
  }

  function deleteExercise(cat: ExerciseCategory, name: string) {
    const next: DictStore = { ...dict, [cat]: [...(dict[cat] ?? [])] };
    next[cat] = (next[cat] ?? []).filter((x) => x.name !== name);
    persistDict(next);
  }

  function addCustomExercise(cat: ExerciseCategory) {
    const n = dictNewName.trim();
    if (!n) return;
    const exists = dict[cat]?.some((x) => x.name === n);
    if (exists) return;
    persistDict({
      ...dict,
      [cat]: [
        ...(dict[cat] ?? []),
        { name: n, visible: true, measurementProfile: "strength_standard" },
      ],
    });
    setDictNewName("");
  }

  function sessionsFor(cat: ExerciseCategory, name: string): number {
    return logs.filter(
      (x) =>
        x.category === cat &&
        x.exercise === name &&
        x.sets.length > 0
    ).length;
  }

  /** --- daily helpers --- */

  function shiftDaily(delta: number) {
    const d = addDays(parseDateKey(dailyDateKey), delta);
    setDailyDateKey(formatDateKey(d));
  }

  const dayLogs = useMemo(
    () => logs.filter((l) => l.date === dailyDateKey),
    [logs, dailyDateKey]
  );

  const last7summaries = useMemo(() => {
    const rows: string[] = [];
    for (let offset = 0; offset < 56 && rows.length < 7; offset += 1) {
      const dk = formatDateKey(addDays(new Date(), -offset));
      const workCount = logs.filter((l) => l.date === dk).length;
      const mealsCount = mealCountByDate[dk] ?? 0;
      if (!workCount && !mealsCount) continue;

      rows.push(
        `${dk}: treningów ${workCount} · posiłków ${mealsCount}`
      );
    }
    return rows;
  }, [logs, mealCountByDate]);

  const activeProfile = useMemo(
    () =>
      exerciseSel
        ? resolveExerciseProfile(dict, category, exerciseSel)
        : "strength_standard",
    [dict, category, exerciseSel]
  );

  const isRunningExercise = activeProfile === "running";

  const chartPoints = useMemo(() => {
    if (!exerciseSel || !mounted) return [];
    const end = new Date();
    const profile = activeProfile;

    type Bucket = Record<string, number>;
    const byDayMax: Bucket = {};

    logs
      .filter(
        (e) =>
          e.exercise === exerciseSel &&
          e.category === category &&
          isDateKeyInRange(e.date, chartRange, end)
      )
      .forEach((e) => {
        const mx = maxChartValueForSets(e.sets, profile);
        byDayMax[e.date] = Math.max(byDayMax[e.date] ?? 0, mx);
      });

    return Object.entries(byDayMax)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, v]) => ({
        dateLabel: parseKey(dateKey).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "short",
        }),
        value: profile === "running" ? Math.round(v * 100) / 100 : Math.round(v),
      }));
  }, [logs, exerciseSel, category, chartRange, mounted, activeProfile]);

  /** --- persist series --- */

  function handleAddSet(set: LogSet, label: string) {
    setChipSets((c) => [...c, set]);
    setChips((c) => [...c, label]);
  }

  async function saveExerciseDay() {
    if (!exerciseSel || chipSets.length === 0) return;

    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;

    const { data, error } = await sb
      .from("workout_log")
      .insert({
        user_id: user.id,
        date: dailyDateKey,
        exercise: exerciseSel,
        category,
        sets: setsToJsonDb(chipSets),
        measurement_profile: activeProfile,
      })
      .select("id,date,exercise,category,sets,measurement_profile")
      .maybeSingle();

    if (error) {
      const { data: fallback, error: fbErr } = await sb
        .from("workout_log")
        .insert({
          user_id: user.id,
          date: dailyDateKey,
          exercise: exerciseSel,
          category,
          sets: setsToJsonDb(chipSets),
        })
        .select("id,date,exercise,category,sets")
        .maybeSingle();
      if (fbErr) {
        console.error("[LogTab] workout insert:", fbErr.message);
        return;
      }
      const row = fallback as WorkoutRowDb | null;
      if (row) setLogs((prev) => [rowToEntry(row), ...prev]);
    } else {
      const row = data as WorkoutRowDb | null;
      if (row) setLogs((prev) => [rowToEntry(row), ...prev]);
    }

    setChips([]);
    setChipSets([]);
    setFormError(null);

    await reloadCalendarMarks();
  }

  async function handleSaveRunFromLog(values: RunEntryValues) {
    setRunError(null);
    setRunSaving(true);
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;

      const totalDurationSec = values.durationMin * 60 + values.durationSec;

      const { error } = await sb.rpc("log_run_dual", {
        p_date: dailyDateKey,
        p_kcal_burned: values.kcalBurned,
        p_distance_km: values.distanceKm,
        p_duration_sec: totalDurationSec,
        p_pace_min_per_km: values.paceMinPerKm,
      });

      if (error) {
        console.error("[LogTab] log_run_dual:", error.message);
        setRunError(error.message);
        return;
      }

      await reloadWorkoutLogs();
      await reloadCalendarMarks();
      setExerciseSel("");
    } finally {
      setRunSaving(false);
    }
  }

  /** --- calendar cell styles --- */

  function cellMeta(dk: string) {
    const hasWork = datesWithWorkouts.has(dk) || logs.some((l) => l.date === dk);
    const hasPlan = datesWithPlan.has(dk);
    const hasEat = datesWithMeals.has(dk);
    return { hasWork, hasPlan, hasEat };
  }

  const todayKey = formatDateKey(new Date());

  /** --- renders --- */

  if (!mounted || !dataReady) {
    return (
      <p className="py-8 text-center text-sm text-white/45">Ładowanie…</p>
    );
  }

  const catActive =
    "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e4]";
  const catIdle = "border-[#333] bg-[#151515] text-white/58 hover:border-white/22";

  const shellInactive =
    "border-[#333] bg-[#151515] text-white/75 hover:border-white/22";
  const shellActive =
    "border-white/28 bg-white/[0.06] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

  if (dictionaryOpen) {
    return (
      <div className="flex flex-col gap-4 text-white">
        <button
          type="button"
          onClick={() => setDictionaryOpen(false)}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-white/55 underline-offset-4 hover:text-[#EF9F27]"
        >
          ← Wróć
        </button>

        <div className="flex flex-wrap gap-2.5">
          {EXERCISE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setDictCategory(cat)}
              className={`${pill} ${
                dictCategory === cat ? catActive : catIdle
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={dictNewName}
            onChange={(e) => setDictNewName(e.target.value)}
            placeholder="Nowe ćwiczenie"
            className="min-w-0 flex-1 rounded-[10px] border border-[#333] bg-[#151515] px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-[#EF9F27]/45"
          />
          <button
            type="button"
            onClick={() => addCustomExercise(dictCategory)}
            className="touch-manipulation shrink-0 rounded-[14px] border border-[#EF9F27]/55 bg-[#EF9F27]/18 px-5 py-3 text-[15px] font-semibold text-[#fff0de] active:opacity-90 hover:bg-[#EF9F27]/28"
          >
            Dodaj
          </button>
        </div>

        <ul className="space-y-2">
          {(exercisesForCategories[dictCategory] ?? []).map((exItem) => {
            const sess = sessionsFor(dictCategory, exItem.name);

            return (
              <li
                key={`${dictCategory}_${exItem.name}`}
                className="flex flex-col gap-3 rounded-[10px] border border-[#333] bg-[#151515] px-3 py-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggleExerciseVisible(dictCategory, exItem.name)
                    }
                    className={`${pill} border-[#333] !text-[11px] ${
                      exItem.visible !== false
                        ? "border-emerald-900/70 bg-emerald-950/40 text-emerald-300/95"
                        : "bg-transparent text-white/45"
                    }`}
                  >
                    {exItem.visible !== false ? "Widoczne" : "Ukryte"}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {exItem.name}
                  </span>
                </div>
                <select
                  value={exItem.measurementProfile ?? "strength_standard"}
                  onChange={(e) =>
                    setExerciseProfile(
                      dictCategory,
                      exItem.name,
                      e.target.value as MeasurementProfile
                    )
                  }
                  className="max-w-[140px] shrink-0 rounded-lg border border-[#333] bg-[#121212] px-2 py-1.5 text-[10px] text-white/80"
                  title="Profil pomiaru"
                >
                  {(Object.keys(MEASUREMENT_PROFILE_LABELS) as MeasurementProfile[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {MEASUREMENT_PROFILE_LABELS[key]}
                      </option>
                    )
                  )}
                </select>
                {sess === 0 ? (
                  <button
                    type="button"
                    onClick={() => deleteExercise(dictCategory, exItem.name)}
                    className="self-start text-xs font-bold text-red-400 hover:underline sm:self-center"
                  >
                    Usuń
                  </button>
                ) : (
                  <span className="text-[11px] text-white/40 sm:shrink-0">
                    Sesje: {sess}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (shellMode === "calendar") {
    const y = monthCursor.getFullYear();
    const mo = monthCursor.getMonth();

    const first = new Date(y, mo, 1);
    const last = new Date(y, mo + 1, 0);
    const lead = (first.getDay() + 6) % 7; /* Monday-first */
    const totalCells = Math.ceil((lead + last.getDate()) / 7) * 7;

    const cells = Array.from({ length: totalCells }, (_, idx) => {
      const dom = idx - lead + 1;
      return dom >= 1 && dom <= last.getDate()
        ? formatDateKey(new Date(y, mo, dom))
        : null;
    });

    function shiftMonth(d: number) {
      const x = new Date(monthCursor);
      x.setMonth(x.getMonth() + d);
      setMonthCursor(x);
    }

    return (
      <div className="flex flex-col gap-4 text-white">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShellMode("daily")}
            className={`${panelBtn} flex-1 ${shellInactive}`}
          >
            Dzienny
          </button>
          <button
            type="button"
            className={`${panelBtn} flex-1 ${shellActive}`}
          >
            Kalendarz
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className={`${panelBtn} size-[52px] border-[#333] bg-[#151515] p-0 text-lg text-white hover:border-white/28`}
          >
            ‹
          </button>
          <p className="text-sm font-semibold capitalize text-white">
            {monthCursor.toLocaleDateString("pl-PL", {
              month: "long",
              year: "numeric",
            })}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className={`${panelBtn} size-[52px] border-[#333] bg-[#151515] p-0 text-lg text-white hover:border-white/28`}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase text-white/45">
          <span className="text-center py-2">Pn</span>
          <span className="text-center py-2">Wt</span>
          <span className="text-center py-2">Śr</span>
          <span className="text-center py-2">Cz</span>
          <span className="text-center py-2">Pt</span>
          <span className="text-center py-2">Sb</span>
          <span className="text-center py-2">Nd</span>
          {cells.map((dk, i) =>
            dk ? (
              <button
                key={`${dk}-${i}`}
                type="button"
                onClick={() => {
                  setDailyDateKey(dk);
                  setShellMode("daily");
                }}
                className={`relative flex min-h-[46px] flex-col items-center justify-center rounded-[10px] border px-1 py-2 text-center text-[13px] font-medium ${(() => {
                  const { hasWork, hasPlan, hasEat } = cellMeta(dk);
                  if (hasWork)
                    return "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#ffe8c9]";
                  if (hasPlan)
                    return "border-[#444] bg-[#1a1a1a] text-white/92";
                  return "border-[#333] bg-[#151515] text-white/75";
                })()} ${todayKey === dk ? "ring-1 ring-[#EF9F27] ring-offset-2 ring-offset-[#121212]" : ""}`}
              >
                {Number(dk.split("-")[2])}
                {cellMeta(dk).hasEat ? (
                  <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#EF9F27]" />
                ) : null}
              </button>
            ) : (
              <span key={`e-${i}`} />
            )
          )}
        </div>
      </div>
    );
  }

  /** ---------- DAILY SHELL --------- */

  return (
    <div className="flex flex-col gap-5 pb-20 text-white">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShellMode("daily")}
          className={`${panelBtn} flex-1 ${shellActive}`}
        >
          Dzienny
        </button>
        <button
          type="button"
          onClick={() => setShellMode("calendar")}
          className={`${panelBtn} flex-1 ${shellInactive}`}
        >
          Kalendarz
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftDaily(-1)}
          aria-label="Poprzedni dzień"
          className={`${panelBtn} size-[52px] shrink-0 border-[#333] bg-[#151515] p-0 text-lg hover:border-white/25`}
        >
          &lt;
        </button>
        <p className="min-w-0 flex-1 text-center text-[14px] font-semibold capitalize leading-snug">
          {parseDateKey(dailyDateKey).toLocaleDateString("pl-PL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <button
          type="button"
          onClick={() => shiftDaily(1)}
          aria-label="Następny dzień"
          className={`${panelBtn} size-[52px] shrink-0 border-[#333] bg-[#151515] p-0 text-lg hover:border-white/25`}
        >
          &gt;
        </button>
      </div>

      <section>
        <p className={`${sectionLabel} mb-3`}>Ćwiczenie</p>
        <div className="flex flex-wrap gap-2.5">
          {EXERCISE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setExerciseSel("");
              }}
              className={`${pill} ${
                category === cat ? catActive : catIdle
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {!exerciseSel ? (
        <div className="grid grid-cols-2 gap-2.5">
          {visibleExercises.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setExerciseSel(name)}
              className="touch-manipulation flex min-h-[52px] items-center rounded-[12px] border border-[#333] bg-[#151515] px-3 py-3 text-left text-[15px] font-medium leading-snug text-white/92 active:opacity-90 hover:border-[#EF9F27]/35"
            >
              {name}
            </button>
          ))}
        </div>
      ) : (
        <section className="space-y-3 rounded-[10px] border border-[#333] bg-[#151515]/90 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold">{exerciseSel}</p>
            <button
              type="button"
              onClick={() => {
                setExerciseSel("");
                setChips([]);
                setChipSets([]);
                setFormError(null);
              }}
              className="touch-manipulation min-h-[44px] shrink-0 rounded-[10px] px-3 text-[13px] font-medium text-white/55 active:bg-white/[0.06] hover:text-[#EF9F27]"
            >
              Zamknij
            </button>
          </div>

          {isRunningExercise ? (
            <>
              <RunEntryForm
                saving={runSaving}
                error={runError}
                onSubmit={(v) => void handleSaveRunFromLog(v)}
              />
              <div className="border-t border-[#333] pt-3">
                <p className={`${sectionLabel} mb-3`}>
                  {chartLabelForProfile("running")}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setChartRange(r)}
                      className={`${pill} ${
                        chartRange === r ? catActive : catIdle
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <ExerciseMaxChart
                  data={chartPoints}
                  unit={chartUnitForProfile("running")}
                />
              </div>
            </>
          ) : (
            <>
              <ExerciseEntryForm
                profile={activeProfile}
                chips={chips}
                onAddSet={handleAddSet}
                onSave={() => void saveExerciseDay()}
                formError={formError}
                setFormError={setFormError}
              />

              <div className="border-t border-[#333] pt-3">
                <p className={`${sectionLabel} mb-3`}>
                  {chartLabelForProfile(activeProfile)}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setChartRange(r)}
                      className={`${pill} ${
                        chartRange === r ? catActive : catIdle
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <ExerciseMaxChart
                  data={chartPoints}
                  unit={chartUnitForProfile(activeProfile)}
                />
              </div>
            </>
          )}
        </section>
      )}

      <section className="border-t border-b border-[#333] py-5">
        <p className={`${sectionLabel} mb-3`}>Zalogowane dziś</p>
        {dayLogs.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/42">
            Brak ćwiczeń w tym dniu
          </p>
        ) : (
          <ul className="space-y-2">
            {dayLogs.map((e) => (
              <li
                key={e.id}
                className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-2"
              >
                <p className="text-sm font-semibold">{e.exercise}</p>
                <p className="text-[11px] text-white/38">{e.category}</p>
                <p className="mt-1 text-xs text-white/82">
                  {e.sets.map((s, i2) => {
                    const prof = displayProfileForEntry(
                      dict,
                      e.category,
                      e.exercise,
                      e.sets
                    );
                    return `${formatSetLabelForProfile(s, prof)}${i2 < e.sets.length - 1 ? ", " : ""}`;
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className={`${sectionLabel} mb-3`}>Historia</p>
        {last7summaries.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/42">
            Historia jest pusta
          </p>
        ) : (
          <ul className="space-y-2 text-[12px] text-white/62">
            {last7summaries.map((ln) => (
              <li key={ln}>{ln}</li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => setDictionaryOpen(true)}
        className="touch-manipulation flex min-h-[56px] w-full items-center justify-center rounded-[14px] border border-[#333] bg-[#151515] px-4 py-4 text-[16px] font-semibold text-[#EF9F27] active:opacity-90 hover:border-[#EF9F27]/35"
      >
        📚 Słownik ćwiczeń
      </button>
    </div>
  );
}
