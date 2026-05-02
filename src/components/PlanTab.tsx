"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanMeal } from "@/lib/fueled-storage";
import { addDays, formatDateKey, parseDateKey } from "@/lib/fueled-storage";
import { DEFAULT_GOAL_LS } from "@/lib/fueled-storage";
import { createClient } from "@/lib/supabase";
import VoiceDictationButton from "@/components/VoiceDictationButton";

function parseGramInput(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function cardCls() {
  return "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-3";
}

/** Zgodnie ze schematem JSON w meal_plans */
type PlanMealJson = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confirmed: boolean;
};

function planMealsToJson(meals: PlanMeal[]): PlanMealJson[] {
  return meals.map((pm) => ({
    id: pm.id,
    name: pm.label || pm.text,
    kcal: pm.calories,
    protein: pm.protein_g,
    carbs: pm.carbs_g,
    fat: pm.fat_g,
    confirmed: pm.eaten,
  }));
}

function jsonToPlanMeals(raw: unknown): PlanMeal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const row = x as Partial<PlanMealJson>;
    const name =
      typeof row.name === "string" ? row.name : "Plan";
    return {
      id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
      text: name,
      label: name,
      calories: Math.round(Number(row.kcal) || 0),
      protein_g: Math.round(Number(row.protein) || 0),
      carbs_g: Math.round(Number(row.carbs) || 0),
      fat_g: Math.round(Number(row.fat) || 0),
      eaten: Boolean(row.confirmed),
    };
  });
}

export default function PlanTab() {
  const [goal, setGoal] = useState({ calories: DEFAULT_GOAL_LS.calories });
  const [goalLoading, setGoalLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);

  const [day, setDay] = useState(() =>
    formatDateKey(addDays(new Date(), 1))
  );

  const [plan, setPlan] = useState<PlanMeal[]>([]);
  const [planEntryMode, setPlanEntryMode] = useState<"ai" | "manual">("ai");

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [manualLabel, setManualLabel] = useState("");
  const [manualKcalStr, setManualKcalStr] = useState("");
  const [manualPStr, setManualPStr] = useState("");
  const [manualCStr, setManualCStr] = useState("");
  const [manualFStr, setManualFStr] = useState("");

  const hydrateGoal = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGoal({ calories: DEFAULT_GOAL_LS.calories });
      setGoalLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("goals")
      .select("kcal")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) console.error("[PlanTab] goals:", error.message);

    const k = Number((data as { kcal?: number } | null)?.kcal);
    setGoal({
      calories: Number.isFinite(k) && k > 0 ? Math.round(k) : DEFAULT_GOAL_LS.calories,
    });
    setGoalLoading(false);
  }, []);

  const loadPlanForDay = useCallback(async () => {
    setPlanLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPlan([]);
      setPlanLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("meal_plans")
      .select("meals,status")
      .eq("user_id", user.id)
      .eq("date", day)
      .maybeSingle();

    if (error) {
      console.error("[PlanTab] meal_plans load:", error.message);
      setPlan([]);
    } else {
      setPlan(jsonToPlanMeals((data as { meals?: unknown })?.meals));
    }

    setPlanLoading(false);
  }, [day]);

  useEffect(() => {
    void hydrateGoal();
  }, [hydrateGoal]);

  useEffect(() => {
    void loadPlanForDay();
  }, [loadPlanForDay]);

  useEffect(() => {
    function onFocus() {
      void hydrateGoal();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrateGoal]);

  async function persistToSupabase(next: PlanMeal[]) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const allDone =
      next.length > 0 && next.every((m) => m.eaten);

    const { error } = await supabase.from("meal_plans").upsert(
      {
        user_id: user.id,
        date: day,
        meals: planMealsToJson(next),
        status: allDone ? "confirmed" : "draft",
      },
      { onConflict: "user_id,date" }
    );

    if (error) {
      console.error("[PlanTab] meal_plans upsert:", error.message);
    }
  }

  async function persist(next: PlanMeal[]) {
    setPlan(next);
    await persistToSupabase(next);
  }

  const totals = useMemo(() => {
    const planned = plan.reduce(
      (acc, m) => ({
        kcal: acc.kcal + m.calories,
        p: acc.p + m.protein_g,
        c: acc.c + m.carbs_g,
        f: acc.f + m.fat_g,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );

    const confirmed = plan.reduce(
      (acc, m) =>
        !m.eaten
          ? acc
          : {
              kcal: acc.kcal + m.calories,
              p: acc.p + m.protein_g,
              c: acc.c + m.carbs_g,
              f: acc.f + m.fat_g,
            },
      { kcal: 0, p: 0, c: 0, f: 0 }
    );

    const balance = goal.calories - planned.kcal;

    let barPct = 0;
    if (goal.calories > 0) {
      barPct = Math.min(100, (planned.kcal / goal.calories) * 100);
    }

    const allConfirmed =
      plan.length > 0 && plan.every((m) => m.eaten);

    return { planned, confirmed, balance, barPct, allConfirmed };
  }, [plan, goal.calories]);

  function shift(delta: number) {
    setDay(formatDateKey(addDays(parseDateKey(day), delta)));
    setParseError(null);
  }

  async function addFromParse(e: React.FormEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    setParseError(null);

    try {
      const res = await fetch("/api/parse-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setParseError(
          typeof j.error === "string" ? j.error : "nie udało się sparsować"
        );
        return;
      }

      const p = await res.json() as {
        name?: string;
        kcal?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      };

      const meal: PlanMeal = {
        id: crypto.randomUUID(),
        text,
        label: typeof p.name === "string" ? p.name : "Plan",
        calories: typeof p.kcal === "number" ? Math.round(p.kcal) : 0,
        protein_g:
          typeof p.protein === "number" ? Math.round(p.protein) : 0,
        carbs_g: typeof p.carbs === "number" ? Math.round(p.carbs) : 0,
        fat_g: typeof p.fat === "number" ? Math.round(p.fat) : 0,
        eaten: false,
      };

      const next = [...plan, meal];
      await persist(next);
      setInputText("");
    } catch {
      setParseError("Błąd sieci");
    } finally {
      setLoading(false);
    }
  }

  async function addManualToPlan(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);

    const label = manualLabel.trim();
    const kcal = Math.round(
      Number.parseFloat(manualKcalStr.replace(",", ".").trim())
    );

    if (!label) {
      setParseError("Podaj nazwę posiłku.");
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setParseError("Podaj dodatnią liczbę kalorii.");
      return;
    }

    const protein_g = parseGramInput(manualPStr);
    const carbs_g = parseGramInput(manualCStr);
    const fat_g = parseGramInput(manualFStr);

    const meal: PlanMeal = {
      id: crypto.randomUUID(),
      text: label,
      label,
      calories: kcal,
      protein_g,
      carbs_g,
      fat_g,
      eaten: false,
    };

    await persist([...plan, meal]);
    setManualLabel("");
    setManualKcalStr("");
    setManualPStr("");
    setManualCStr("");
    setManualFStr("");
  }

  async function markAte(mid: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const meal = plan.find((m) => m.id === mid);
    if (!meal || meal.eaten) return;

    const nextPlan = plan.map((m) =>
      m.id === mid ? { ...m, eaten: true } : m
    );

    const { error: insErr } = await supabase.from("meals").insert({
      user_id: user.id,
      date: day,
      name: meal.label || meal.text,
      kcal: meal.calories,
      protein: meal.protein_g,
      carbs: meal.carbs_g,
      fat: meal.fat_g,
    });

    if (insErr) {
      console.error("[PlanTab] confirm → meals:", insErr.message);
      return;
    }

    await persist(nextPlan);
  }

  const badge = totals.allConfirmed
    ? {
        bg: "#3B6D11",
        label: "Zatwierdzone",
      }
    : { bg: "#534AB7", label: "Szkic" };

  const dateLabel = useMemo(() => {
    try {
      return parseDateKey(day).toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return day;
    }
  }, [day]);

  return (
    <div className="flex flex-col gap-5 text-white">
      {goalLoading || planLoading ? (
        <p className="text-center text-xs text-white/45">Ładowanie...</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-lg hover:bg-[#252525]"
          aria-label="Poprzedni dzień"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] capitalize text-white/60">
            {dateLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-lg hover:bg-[#252525]"
          aria-label="Następny dzień"
        >
          ›
        </button>
      </div>

      <div className="flex justify-center">
        <span
          className="rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: badge.bg }}
        >
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`${cardCls()} text-center sm:col-span-1`}>
          <p className="text-[10px] uppercase text-white/45">Cel dzienny</p>
          <p className="mt-1 text-xl font-semibold text-[#EF9F27]">
            {goal.calories}{" "}
            <span className="text-xs font-normal text-white/40">kcal</span>
          </p>
        </div>
        <div className={`${cardCls()} text-center`}>
          <p className="text-[10px] uppercase text-white/45">Zaplanowane</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {totals.planned.kcal}
          </p>
        </div>
        <div className={`${cardCls()} text-center`}>
          <p className="text-[10px] uppercase text-white/45">Zatwierdzone</p>
          <p className="mt-1 text-xl font-semibold text-[#3B6D11]">
            {totals.confirmed.kcal}
          </p>
        </div>
        <div className={`${cardCls()} text-center`}>
          <p className="text-[10px] uppercase text-white/45">Bilans</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              totals.balance >= 0 ? "text-[#3B6D11]" : "text-red-500"
            }`}
          >
            {totals.balance > 0 ? "+" : ""}
            {Math.round(totals.balance)}{" "}
            <span className="text-xs font-normal text-white/40">kcal</span>
          </p>
        </div>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#534AB7] transition-all"
            style={{ width: `${totals.barPct}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[10px] text-white/40">
          postęp do celu: {Math.round(totals.barPct)}%
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className={`${cardCls()} text-center text-xs`}>
          <p className="text-[9px] font-semibold uppercase text-white/45">
            Białko
          </p>
          <p className="mt-2 font-semibold">{totals.planned.p}g</p>
        </div>
        <div className={`${cardCls()} text-center text-xs`}>
          <p className="text-[9px] font-semibold uppercase text-white/45">
            Węgle
          </p>
          <p className="mt-2 font-semibold">{totals.planned.c}g</p>
        </div>
        <div className={`${cardCls()} text-center text-xs`}>
          <p className="text-[9px] font-semibold uppercase text-white/45">
            Tłuszcz
          </p>
          <p className="mt-2 font-semibold">{totals.planned.f}g</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/80">
          Plan posiłków
        </h2>
        {plan.length === 0 ? (
          <p className="text-center text-sm text-white/35">
            Jeszcze brak zaplanowanych posiłków
          </p>
        ) : (
          <ul className="space-y-2">
            {plan.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-sm sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.label}</p>
                  <p className="truncate text-[11px] text-white/40">{m.text}</p>
                  <p className="mt-1 text-xs text-[#EF9F27]">
                    {m.calories} kcal · B {m.protein_g} · W {m.carbs_g} · T{" "}
                    {m.fat_g}
                  </p>
                  {m.eaten ? (
                    <p className="mt-1 text-[11px] font-medium text-[#3B6D11]">
                      ✓ zatwierdzono do dziennika
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={m.eaten}
                  onClick={() => void markAte(m.id)}
                  className="shrink-0 rounded-xl border border-white/25 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ✓ Zjadłem
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className="mb-3 flex rounded-xl border border-[#2A2A2A] bg-black/20 p-0.5"
        role="tablist"
        aria-label="Sposób dodania do planu"
      >
        <button
          type="button"
          role="tab"
          aria-selected={planEntryMode === "ai"}
          onClick={() => {
            setPlanEntryMode("ai");
            setParseError(null);
          }}
          className={`min-h-[44px] flex-1 rounded-[10px] px-3 text-xs font-semibold transition ${
            planEntryMode === "ai"
              ? "bg-[#534AB7] text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          Z opisu (AI)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={planEntryMode === "manual"}
          onClick={() => {
            setPlanEntryMode("manual");
            setParseError(null);
          }}
          className={`min-h-[44px] flex-1 rounded-[10px] px-3 text-xs font-semibold transition ${
            planEntryMode === "manual"
              ? "bg-[#534AB7] text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          Własne kcal
        </button>
      </div>
      {planEntryMode === "ai" ? (
        <form onSubmit={(e) => void addFromParse(e)} className="space-y-3">
          <p className="text-[11px] leading-snug text-white/40">
            <strong className="text-white/55">Mów</strong> podpowie tekst; potem Dodaj do planu —
            makra z AI.
          </p>
          <div className="flex gap-2">
            <input
              value={inputText}
              disabled={loading}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Opisz potrawę do dodania…"
              className="min-w-0 flex-1 rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#534AB7]/60 disabled:opacity-60"
            />
            <VoiceDictationButton
              disabled={loading}
              onAppendTranscript={(t) =>
                setInputText((prev) =>
                  prev.trim() ? `${prev.trim()} ${t}` : t
                )
              }
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-white/25 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Parsowanie…" : "Dodaj do planu"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void addManualToPlan(e)} className="space-y-3">
          <p className="text-[11px] leading-snug text-white/40">
            Wpisz kalorie z etykiety lub własnych notatek; makra opcjonalne.
          </p>
          <input
            type="text"
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
            placeholder="Nazwa posiłku"
            className="w-full rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#534AB7]/60"
          />
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={manualKcalStr}
            onChange={(e) => setManualKcalStr(e.target.value)}
            placeholder="Kalorie (kcal) *"
            className="w-full rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#534AB7]/60"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={manualPStr}
              onChange={(e) => setManualPStr(e.target.value)}
              placeholder="B (g)"
              className="rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/35 focus:border-[#534AB7]/60"
            />
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={manualCStr}
              onChange={(e) => setManualCStr(e.target.value)}
              placeholder="W (g)"
              className="rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/35 focus:border-[#534AB7]/60"
            />
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={manualFStr}
              onChange={(e) => setManualFStr(e.target.value)}
              placeholder="T (g)"
              className="rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/35 focus:border-[#534AB7]/60"
            />
          </div>
          <p className="text-[10px] text-white/35">Makra opcjonalne — puste zostanie 0 g.</p>
          <button
            type="submit"
            className="w-full rounded-xl border border-white/25 py-3 text-sm font-semibold hover:bg-white/10"
          >
            Dodaj do planu
          </button>
        </form>
      )}
      {parseError ? (
        <p className="text-center text-sm text-red-400">{parseError}</p>
      ) : null}
    </div>
  );
}
