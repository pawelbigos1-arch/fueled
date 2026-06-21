"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatDateKey } from "@/lib/fueled-storage";
import {
  frequencyLabel,
  periodBounds,
  type HabitFrequencyType,
} from "@/lib/habit-period";
import type { HabitRow } from "@/lib/growth-types";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

const inputCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60";

export default function HabitsSection() {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [completionDates, setCompletionDates] = useState<Set<string>>(new Set());
  const [habitCompletionMap, setHabitCompletionMap] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [freqType, setFreqType] = useState<HabitFrequencyType>("daily");
  const [target, setTarget] = useState("1");
  const today = formatDateKey(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setHabits([]);
      setLoading(false);
      return;
    }

    const { data: hRows, error: he } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (he) console.error("[HabitsSection] habits:", he.message);
    const list = (hRows ?? []) as HabitRow[];
    setHabits(list);

    const monthBounds = periodBounds("monthly");
    const { data: cRows, error: ce } = await supabase
      .from("habit_completions")
      .select("habit_id, date")
      .eq("user_id", user.id)
      .gte("date", monthBounds.start)
      .lte("date", monthBounds.end);
    if (ce) console.error("[HabitsSection] completions:", ce.message);

    const todaySet = new Set<string>();
    const byHabit = new Map<string, Set<string>>();
    ((cRows ?? []) as { habit_id: string; date: string }[]).forEach((r) => {
      if (r.date === today) todaySet.add(r.habit_id);
      if (!byHabit.has(r.habit_id)) byHabit.set(r.habit_id, new Set());
      byHabit.get(r.habit_id)!.add(r.date);
    });
    setCompletionDates(todaySet);
    setHabitCompletionMap(byHabit);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const targetNum = Math.max(1, Math.round(Number(target) || 1));

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const sort_order =
      habits.length > 0 ? Math.max(...habits.map((h) => h.sort_order)) + 1 : 0;

    const { error } = await supabase.from("habits").insert({
      user_id: user.id,
      name: n,
      frequency_type: freqType,
      target_count: freqType === "daily" ? 1 : targetNum,
      sort_order,
    });
    if (error) console.error("[HabitsSection] insert:", error.message);
    setName("");
    setTarget("1");
    void load();
  }

  async function removeHabit(id: string) {
    const supabase = createClient();
    await supabase.from("habits").update({ active: false }).eq("id", id);
    void load();
  }

  function periodCount(habit: HabitRow): number {
    const dates = habitCompletionMap.get(habit.id);
    if (!dates) return 0;
    const { start, end } = periodBounds(habit.frequency_type);
    let n = 0;
    dates.forEach((d) => {
      if (d >= start && d <= end) n += 1;
    });
    return n;
  }

  async function toggleToday(habit: HabitRow) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const doneToday = completionDates.has(habit.id);
    if (doneToday) {
      await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", habit.id)
        .eq("date", today);
    } else {
      const count = periodCount(habit);
      const limit =
        habit.frequency_type === "daily" ? 1 : habit.target_count;
      if (count >= limit) return;

      await supabase.from("habit_completions").insert({
        habit_id: habit.id,
        user_id: user.id,
        date: today,
      });
    }
    void load();
  }

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    []
  );

  if (loading) {
    return <p className="text-center text-xs text-white/45">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/85">
        Nawyki
      </h2>

      <form onSubmit={(e) => void addHabit(e)} className={`${cardCls} space-y-3`}>
        <input
          className={inputCls}
          placeholder="Nazwa nawyku"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="flex gap-2">
          <select
            className={`${inputCls} flex-1`}
            value={freqType}
            onChange={(e) =>
              setFreqType(e.target.value as HabitFrequencyType)
            }
          >
            <option value="daily">Codziennie</option>
            <option value="weekly">X razy w tygodniu</option>
            <option value="monthly">X razy w miesiącu</option>
          </select>
          {freqType !== "daily" ? (
            <input
              type="number"
              min={1}
              max={31}
              className={`${inputCls} w-20`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          ) : null}
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-[#EF9F27] py-2.5 text-sm font-bold text-black"
        >
          Dodaj nawyk
        </button>
      </form>

      <div className={cardCls}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Dziś — {todayLabel}
        </p>
        {habits.length === 0 ? (
          <p className="mt-3 text-xs text-white/40">Brak nawyków w słowniku.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {habits.map((habit) => {
              const done = completionDates.has(habit.id);
              const count = periodCount(habit);
              const limit =
                habit.frequency_type === "daily" ? 1 : habit.target_count;
              const atLimit = !done && count >= limit;

              return (
                <li
                  key={habit.id}
                  className="flex items-start gap-3 border-t border-[#2A2A2A] pt-3 first:border-0 first:pt-0"
                >
                  <button
                    type="button"
                    disabled={atLimit}
                    onClick={() => void toggleToday(habit)}
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-sm ${
                      done
                        ? "border-[#3B6D11] bg-[#3B6D11] text-white"
                        : "border-[#444] bg-transparent text-white/30"
                    } disabled:opacity-40`}
                    aria-pressed={done}
                  >
                    {done ? "✓" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{habit.name}</p>
                    <p className="text-[11px] text-white/45">
                      {frequencyLabel(habit.frequency_type, habit.target_count)}
                      {habit.frequency_type !== "daily"
                        ? ` · ${count}/${limit}`
                        : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeHabit(habit.id)}
                    className="text-[11px] text-red-400/80"
                  >
                    Usuń
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
