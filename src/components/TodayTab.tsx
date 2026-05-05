"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  DEFAULT_GOAL_LS,
  addDays,
  formatDateKey,
  parseDateKey,
} from "@/lib/fueled-storage";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import VoiceDictationButton from "@/components/VoiceDictationButton";

const TODAY_FALLBACK = {
  calorieGoal: DEFAULT_GOAL_LS.calories,
  proteinGoal: DEFAULT_GOAL_LS.protein,
  carbsGoal: DEFAULT_GOAL_LS.carbs,
  fatGoal: DEFAULT_GOAL_LS.fats,
} as const;

/** Odpowiedź z `/api/parse-food` lub `/api/parse-food-image` */
type AiParsedNutrition = {
  name?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

/** Wartości na 100 g ze zdjęcia (`/api/parse-food-image`) */
type ImageNutritionPer100g = {
  name: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
};

function nutritionPer100gFromImageApi(
  parsed: Record<string, unknown>
): ImageNutritionPer100g {
  const nameRaw = parsed.name;
  const name =
    typeof nameRaw === "string" && nameRaw.trim()
      ? nameRaw.trim()
      : "Ze zdjęcia";

  const pick = (prefer: string, alt: string): number => {
    const a = parsed[prefer];
    const b = parsed[alt];
    const v =
      typeof a === "number" && Number.isFinite(a)
        ? a
        : typeof b === "number" && Number.isFinite(b)
          ? b
          : NaN;
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  };

  return {
    name,
    kcal100: pick("kcal_per_100g", "kcal"),
    protein100: pick("protein_per_100g", "protein"),
    carbs100: pick("carbs_per_100g", "carbs"),
    fat100: pick("fat_per_100g", "fat"),
  };
}

export type Meal = {
  id: string;
  text: string;
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type Workout = {
  id: string;
  description: string;
  caloriesBurned: number;
};

type MealRowDb = {
  id: string;
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

function mapMealsDb(rows: MealRowDb[]): Meal[] {
  return rows.map((r) => {
    const name = typeof r.name === "string" ? r.name : "Posiłek";
    return {
      id: r.id,
      text: name,
      label: name,
      calories: Math.max(0, Math.round(Number(r.kcal) || 0)),
      protein_g: Math.max(0, Math.round(Number(r.protein) || 0)),
      carbs_g: Math.max(0, Math.round(Number(r.carbs) || 0)),
      fat_g: Math.max(0, Math.round(Number(r.fat) || 0)),
    };
  });
}

function goalsFromRow(
  row: Record<string, unknown> | null
): {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
} {
  if (
    !row ||
    typeof row.kcal !== "number" ||
    !Number.isFinite(row.kcal)
  ) {
    return {
      calorieGoal: TODAY_FALLBACK.calorieGoal,
      proteinGoal: TODAY_FALLBACK.proteinGoal,
      carbsGoal: TODAY_FALLBACK.carbsGoal,
      fatGoal: TODAY_FALLBACK.fatGoal,
    };
  }
  return {
    calorieGoal: Math.round(row.kcal),
    proteinGoal: Math.round(Number(row.protein) || TODAY_FALLBACK.proteinGoal),
    carbsGoal: Math.round(Number(row.carbs) || TODAY_FALLBACK.carbsGoal),
    fatGoal: Math.round(Number(row.fat) || TODAY_FALLBACK.fatGoal),
  };
}

function parseGramInput(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function caloriesFromSteps(steps: number, weightKg: number): number {
  return Math.round((steps / 1000) * (weightKg * 0.5));
}

/** YYYY-MM-DD (UTC) + delta dni — spójnie z `toISOString().slice(0, 10)` */
function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const t = Date.UTC(y, m - 1, d + deltaDays);
  return new Date(t).toISOString().slice(0, 10);
}

const LEGACY_MEAL_ACTIVITY_LS_KEYS = [
  "fueled_today_meals",
  "fueled_today_workouts",
  "fueled_meals",
  "fueled_workouts",
  "fueled_activities",
];

export default function TodayTab() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [mealEntryMode, setMealEntryMode] = useState<"ai" | "manual">("ai");

  const [mealInput, setMealInput] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  const [mealImageLoading, setMealImageLoading] = useState(false);
  const [imageMealDraft, setImageMealDraft] = useState<ImageNutritionPer100g | null>(
    null
  );
  const [imageMealGramsStr, setImageMealGramsStr] = useState("100");
  const [imageMealSaving, setImageMealSaving] = useState(false);
  const [mealError, setMealError] = useState<string | null>(null);
  const mealPhotoInputRef = useRef<HTMLInputElement>(null);

  const [manualLabel, setManualLabel] = useState("");
  const [manualKcalStr, setManualKcalStr] = useState("");
  const [manualPStr, setManualPStr] = useState("");
  const [manualCStr, setManualCStr] = useState("");
  const [manualFStr, setManualFStr] = useState("");

  const [activityText, setActivityText] = useState("");
  const [activityKcal, setActivityKcal] = useState("");
  const [stepsStr, setStepsStr] = useState("");
  const [stepsWeightManualStr, setStepsWeightManualStr] = useState("");
  const [stepsSaving, setStepsSaving] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);

  const [todayKey, setTodayKey] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [calorieGoal, setCalorieGoal] = useState<number>(
    TODAY_FALLBACK.calorieGoal
  );
  const [proteinGoal, setProteinGoal] = useState<number>(
    TODAY_FALLBACK.proteinGoal
  );
  const [carbsGoal, setCarbsGoal] = useState<number>(
    TODAY_FALLBACK.carbsGoal
  );
  const [fatGoal, setFatGoal] = useState<number>(TODAY_FALLBACK.fatGoal);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  /** Suma dzienna spożyte / spalone wg daty dla wykresu 7 dni */
  const [weekAgg, setWeekAgg] = useState<
    Record<string, { consumed: number; burned: number }>
  >({});

  const applyGoals = useCallback((row: Record<string, unknown> | null) => {
    const g = goalsFromRow(row);
    setCalorieGoal(g.calorieGoal);
    setProteinGoal(g.proteinGoal);
    setCarbsGoal(g.carbsGoal);
    setFatGoal(g.fatGoal);
  }, []);

  const loadGoalsOnly = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] goals auth:", authErr.message);
      if (!user) {
        applyGoals(null);
        return;
      }
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) {
        console.error("[TodayTab] goals fetch:", error.message);
        applyGoals(null);
        return;
      }
      applyGoals((data ?? null) as Record<string, unknown> | null);
    } catch (e) {
      console.error("[TodayTab] goals fetch:", e);
      applyGoals(null);
    }
  }, [applyGoals, supabase]);

  const fetchWeekTotals = useCallback(
    async (userId: string, endYmd: string) => {
      try {
        const start = addDaysUtcYmd(endYmd, -6);
        const [{ data: mt, error: em }, { data: at, error: ea }] =
          await Promise.all([
            supabase
              .from("meals")
              .select("date,kcal")
              .eq("user_id", userId)
              .gte("date", start)
              .lte("date", endYmd),
            supabase
              .from("activities")
              .select("date,kcal_burned")
              .eq("user_id", userId)
              .gte("date", start)
              .lte("date", endYmd),
          ]);

        if (em) console.error("[TodayTab] week meals:", em.message);
        if (ea) console.error("[TodayTab] week activities:", ea.message);

        const agg: Record<string, { consumed: number; burned: number }> = {};

        type M = { date: string; kcal: number | null };
        type A = { date: string; kcal_burned: number | null };
        ((mt ?? []) as M[]).forEach(({ date, kcal }) => {
          if (!date) return;
          if (!agg[date]) agg[date] = { consumed: 0, burned: 0 };
          agg[date].consumed += Math.max(0, Math.round(Number(kcal) || 0));
        });
        ((at ?? []) as A[]).forEach(({ date, kcal_burned }) => {
          if (!date) return;
          if (!agg[date]) agg[date] = { consumed: 0, burned: 0 };
          agg[date].burned += Math.max(
            0,
            Math.round(Number(kcal_burned) || 0)
          );
        });

        setWeekAgg(agg);
      } catch (e) {
        console.error("[TodayTab] fetchWeekTotals:", e);
      }
    },
    [supabase]
  );

  const insertAiParsedMealToSupabase = useCallback(
    async (parsed: AiParsedNutrition, transcriptText: string): Promise<boolean> => {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();
        if (authErr) console.error("[TodayTab] meal insert auth:", authErr.message);
        if (!user) return false;

        const today = new Date().toISOString().slice(0, 10);
        setTodayKey(today);

        const { data: inserted, error } = await supabase
          .from("meals")
          .insert({
            user_id: user.id,
            date: today,
            name: typeof parsed.name === "string" ? parsed.name : "Posiłek",
            kcal: typeof parsed.kcal === "number" ? Math.round(parsed.kcal) : 0,
            protein:
              typeof parsed.protein === "number" ? Math.round(parsed.protein) : 0,
            carbs:
              typeof parsed.carbs === "number" ? Math.round(parsed.carbs) : 0,
            fat: typeof parsed.fat === "number" ? Math.round(parsed.fat) : 0,
          })
          .select("*")
          .single();

        if (error) {
          console.error("[TodayTab] meal insert:", error.message);
          setMealError(error.message);
          return false;
        }

        const row = inserted as MealRowDb | null;
        if (row) {
          const [mapped] = mapMealsDb([row]);
          if (mapped) {
            mapped.text = transcriptText;
          }
          setMeals((prev) => (mapped ? [...prev, mapped] : prev));
        }

        await fetchWeekTotals(user.id, today);
        return true;
      } catch (err) {
        console.error("[TodayTab] meal insert:", err);
        setMealError("Brak połączenia lub błąd sieci.");
        return false;
      }
    },
    [supabase, fetchWeekTotals]
  );

  const hydrate = useCallback(async () => {
    setGoalsLoading(true);
    setDataLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] hydrate auth:", authErr.message);

      if (!user) {
        setMeals([]);
        setWorkouts([]);
        setWeekAgg({});
        setLatestWeightKg(null);
        applyGoals(null);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      setTodayKey(today);

      const { data: gRow, error: eg } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (eg) {
        console.error("[TodayTab] goals:", eg.message);
        applyGoals(null);
      } else {
        applyGoals((gRow ?? null) as Record<string, unknown> | null);
      }

      const { data: mRows, error: em } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today);
      if (em) {
        console.error("[TodayTab] meals:", em.message);
        setMeals([]);
      } else {
        setMeals(mapMealsDb((mRows ?? []) as MealRowDb[]));
      }

      const { data: aRows, error: ea } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today);
      if (ea) {
        console.error("[TodayTab] activities:", ea.message);
        setWorkouts([]);
      } else {
        type ActRowDb = {
          id: string;
          name: string;
          kcal_burned: number | null;
        };
        setWorkouts(
          ((aRows ?? []) as ActRowDb[]).map((r) => ({
            id: r.id,
            description: typeof r.name === "string" ? r.name : "",
            caloriesBurned: Math.max(0, Math.round(Number(r.kcal_burned) || 0)),
          }))
        );
      }

      const { data: metrics, error: emetrics } = await supabase
        .from("body_metrics")
        .select("weight_kg")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .single();
      if (emetrics) {
        console.error("[TodayTab] body_metrics:", emetrics.message);
        setLatestWeightKg(null);
      } else {
        const w = Number((metrics as { weight_kg?: number } | null)?.weight_kg);
        setLatestWeightKg(Number.isFinite(w) && w > 0 ? w : null);
      }

      await fetchWeekTotals(user.id, today);
    } catch (e) {
      console.error("[TodayTab] hydrate:", e);
      setMeals([]);
      setWorkouts([]);
      setWeekAgg({});
      setLatestWeightKg(null);
      applyGoals(null);
    } finally {
      setGoalsLoading(false);
      setDataLoading(false);
    }
  }, [applyGoals, fetchWeekTotals, supabase]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    try {
      for (const k of LEGACY_MEAL_ACTIVITY_LS_KEYS) {
        localStorage.removeItem(k);
      }
    } catch (e) {
      console.error("[TodayTab] localStorage cleanup:", e);
    }
  }, []);

  useEffect(() => {
    function onFocus() {
      void loadGoalsOnly();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadGoalsOnly]);

  const totals = useMemo(() => {
    const consumed = meals.reduce((s, m) => s + m.calories, 0);
    const burned = workouts.reduce((s, w) => s + Math.max(0, w.caloriesBurned), 0);
    const proteinConsumed = meals.reduce((s, m) => s + m.protein_g, 0);
    const carbsConsumed = meals.reduce((s, m) => s + m.carbs_g, 0);
    const fatConsumed = meals.reduce((s, m) => s + m.fat_g, 0);

    const budget = calorieGoal + burned;
    const remaining = calorieGoal - consumed + burned;

    const overBudget = consumed > budget;

    let barPct: number;
    if (budget > 0) {
      barPct = Math.min(100, (consumed / budget) * 100);
    } else {
      barPct = 100;
    }
    if (overBudget) barPct = 100;

    return {
      consumed,
      burned,
      proteinConsumed,
      carbsConsumed,
      fatConsumed,
      budget,
      remaining,
      overBudget,
      barPct,
    };
  }, [meals, workouts, calorieGoal]);

  const weekSeries = useMemo(() => {
    const rows: Array<{
      dk: string;
      label: string;
      weekShort: string;
      consumed: number;
      budget: number;
      delta: number;
    }> = [];

    for (let offset = -6; offset <= 0; offset += 1) {
      const dk = addDaysUtcYmd(todayKey, offset);
      const isToday = dk === todayKey;

      let consumed = 0;
      let burned = 0;

      if (isToday) {
        consumed = meals.reduce((s, m) => s + Math.max(0, m.calories), 0);
        burned = workouts.reduce(
          (s, w) => s + Math.max(0, w.caloriesBurned),
          0
        );
      } else if (weekAgg[dk]) {
        consumed = weekAgg[dk].consumed;
        burned = weekAgg[dk].burned;
      }

      const budget = calorieGoal + burned;
      rows.push({
        dk,
        label: parseDateKey(dk).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "short",
        }),
        weekShort: parseDateKey(dk).toLocaleDateString("pl-PL", {
          weekday: "short",
        }),
        consumed: Math.round(consumed),
        budget: Math.round(budget),
        delta: Math.round(consumed - budget),
      });
    }

    return rows;
  }, [todayKey, meals, workouts, calorieGoal, weekAgg]);

  const imagePortionPreview = useMemo(() => {
    if (!imageMealDraft) return null;
    const raw = Number.parseFloat(imageMealGramsStr.replace(",", ".").trim());
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const gramsRounded = Math.max(1, Math.round(raw));
    const f = gramsRounded / 100;
    return {
      grams: gramsRounded,
      kcal: Math.round(imageMealDraft.kcal100 * f),
      p: Math.round(imageMealDraft.protein100 * f),
      c: Math.round(imageMealDraft.carbs100 * f),
      fat: Math.round(imageMealDraft.fat100 * f),
    };
  }, [imageMealDraft, imageMealGramsStr]);

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    setMealError(null);

    const text = mealInput.trim();
    if (!text) return;

    setMealLoading(true);

    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] meal add auth:", authErr.message);
      if (!user) return;

      const res = await fetch("/api/parse-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          typeof errJson === "object" && errJson !== null && "message" in errJson
            ? String((errJson as { message?: string }).message)
            : typeof errJson === "object" && errJson !== null && "error" in errJson
              ? String((errJson as { error?: string }).error)
              : `Błąd ${res.status}`;
        setMealError(msg || "Nie udało się dodać posiłku");
        return;
      }

      const parsed = (await res.json()) as AiParsedNutrition;
      const ok = await insertAiParsedMealToSupabase(parsed, text);
      if (ok) setMealInput("");
    } catch (err) {
      console.error("[TodayTab] meal add:", err);
      setMealError("Brak połączenia lub błąd sieci.");
    } finally {
      setMealLoading(false);
    }
  }

  function handleMealPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMealError(null);
    setMealImageLoading(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      void (async () => {
        try {
          const dataUrl = ev.target?.result as string | undefined;
          const base64 = dataUrl?.split(",")[1];
          if (!base64) {
            setMealError("Nie udało się odczytać zdjęcia.");
            return;
          }

          const res = await fetch("/api/parse-food-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: base64,
              media_type: file.type || "image/jpeg",
            }),
          });

          const parsed = (await res.json()) as AiParsedNutrition & { error?: string };

          if (!res.ok || typeof parsed.error === "string") {
            console.error("[TodayTab] parse-food-image:", parsed.error ?? res.status);
            setMealError(
              typeof parsed.error === "string"
                ? parsed.error
                : "Nie udało przeanalizować zdjęcia."
            );
            return;
          }

          setImageMealDraft(
            nutritionPer100gFromImageApi(parsed as Record<string, unknown>)
          );
          setImageMealGramsStr("100");
        } catch (err) {
          console.error("[TodayTab] parse-food-image:", err);
          setMealError("Błąd sieci przy analizie zdjęcia.");
        } finally {
          setMealImageLoading(false);
        }
      })();
    };
    reader.onerror = () => {
      console.error("[TodayTab] FileReader error");
      setMealImageLoading(false);
      setMealError("Nie udało się wczytać pliku.");
    };
    reader.readAsDataURL(file);
  }

  async function confirmImageMealDraft() {
    if (!imageMealDraft) return;
    const g = Number.parseFloat(imageMealGramsStr.replace(",", ".").trim());
    if (!Number.isFinite(g) || g <= 0) {
      setMealError("Podaj ile gramów zjadłeś (liczba większa od 0).");
      return;
    }
    setMealError(null);
    setImageMealSaving(true);
    try {
      const gramsRounded = Math.max(1, Math.round(g));
      const f = gramsRounded / 100;
      const portionName = `${imageMealDraft.name} (${gramsRounded} g)`;
      const ok = await insertAiParsedMealToSupabase(
        {
          name: portionName,
          kcal: Math.round(imageMealDraft.kcal100 * f),
          protein: Math.round(imageMealDraft.protein100 * f),
          carbs: Math.round(imageMealDraft.carbs100 * f),
          fat: Math.round(imageMealDraft.fat100 * f),
        },
        `[zdjęcie] ${imageMealDraft.name}, ${gramsRounded} g`
      );
      if (ok) {
        setImageMealDraft(null);
        setImageMealGramsStr("100");
      }
    } finally {
      setImageMealSaving(false);
    }
  }

  async function handleAddMealManual(e: React.FormEvent) {
    e.preventDefault();
    setMealError(null);

    const label = manualLabel.trim();
    const kcal = Math.round(
      Number.parseFloat(manualKcalStr.replace(",", ".").trim())
    );

    if (!label) {
      setMealError("Podaj nazwę posiłku.");
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setMealError("Podaj dodatnią liczbę kalorii.");
      return;
    }

    const protein_g = parseGramInput(manualPStr);
    const carbs_g = parseGramInput(manualCStr);
    const fat_g = parseGramInput(manualFStr);

    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] meal manual auth:", authErr.message);
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);
      setTodayKey(today);

      const { data: inserted, error } = await supabase
        .from("meals")
        .insert({
          user_id: user.id,
          date: today,
          name: label,
          kcal,
          protein: protein_g,
          carbs: carbs_g,
          fat: fat_g,
        })
        .select("*")
        .single();

      if (error) {
        console.error("[TodayTab] meal manual:", error.message);
        setMealError(error.message);
        return;
      }

      const row = inserted as MealRowDb | null;
      if (row) setMeals((prev) => [...prev, ...mapMealsDb([row])]);

      setManualLabel("");
      setManualKcalStr("");
      setManualPStr("");
      setManualCStr("");
      setManualFStr("");
      await fetchWeekTotals(user.id, today);
    } catch (err) {
      console.error("[TodayTab] meal manual:", err);
    }
  }

  async function removeMeal(id: string) {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] meal delete auth:", authErr.message);
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);
      setTodayKey(today);

      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) {
        console.error("[TodayTab] meal delete:", error.message);
        return;
      }
      setMeals((prev) => prev.filter((m) => m.id !== id));
      await fetchWeekTotals(user.id, today);
    } catch (err) {
      console.error("[TodayTab] meal delete:", err);
    }
  }

  async function handleAddSteps(e: React.FormEvent) {
    e.preventDefault();
    setStepsError(null);

    const steps = Number.parseInt(stepsStr.trim(), 10);
    if (!Number.isFinite(steps) || steps <= 0) return;

    const manualWeight = Number.parseFloat(
      stepsWeightManualStr.replace(",", ".").trim()
    );
    const weightKg =
      latestWeightKg && latestWeightKg > 0
        ? latestWeightKg
        : Number.isFinite(manualWeight) && manualWeight > 0
          ? manualWeight
          : null;

    if (!weightKg) {
      setStepsError("Podaj wagę aby przeliczyć kroki.");
      return;
    }

    setStepsSaving(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] steps auth:", authErr.message);
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);
      setTodayKey(today);

      const kcalBurned = caloriesFromSteps(steps, weightKg);
      const weightLabel = Number.isInteger(weightKg)
        ? String(weightKg)
        : weightKg.toFixed(1);
      const activityName = `Kroki — ${steps} kroków (${weightLabel} kg)`;

      const { data: inserted, error } = await supabase
        .from("activities")
        .insert({
          user_id: user.id,
          date: today,
          name: activityName,
          kcal_burned: kcalBurned,
        })
        .select("*")
        .single();

      if (error) {
        console.error("[TodayTab] steps insert:", error.message);
        setStepsError(error.message);
        return;
      }

      const r = inserted as { id: string; name: string; kcal_burned: number | null } | null;
      if (r) {
        setWorkouts((prev) => [
          ...prev,
          {
            id: r.id,
            description: r.name,
            caloriesBurned: Math.max(0, Math.round(Number(r.kcal_burned) || 0)),
          },
        ]);
      }
      setStepsStr("");
      await fetchWeekTotals(user.id, today);
    } catch (err) {
      console.error("[TodayTab] steps insert:", err);
      setStepsError("Nie udało się dodać kroków.");
    } finally {
      setStepsSaving(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();

    const kcalRaw = Number.parseInt(activityKcal, 10);
    const caloriesBurned = Number.isFinite(kcalRaw) && kcalRaw > 0 ? kcalRaw : 0;
    const description = activityText.trim();

    if (!description || caloriesBurned <= 0) return;

    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] activity add auth:", authErr.message);
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);
      setTodayKey(today);

      const { data: inserted, error } = await supabase
        .from("activities")
        .insert({
          user_id: user.id,
          date: today,
          name: description,
          kcal_burned: caloriesBurned,
        })
        .select("*")
        .single();

      if (error) {
        console.error("[TodayTab] activity insert:", error.message);
        return;
      }

      const r = inserted as { id: string; name: string; kcal_burned: number | null } | null;
      if (r) {
        setWorkouts((prev) => [
          ...prev,
          {
            id: r.id,
            description: r.name,
            caloriesBurned: Math.max(0, Math.round(Number(r.kcal_burned) || 0)),
          },
        ]);
      }
      setActivityText("");
      setActivityKcal("");
      await fetchWeekTotals(user.id, today);
    } catch (err) {
      console.error("[TodayTab] activity insert:", err);
    }
  }

  async function removeActivity(id: string) {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) console.error("[TodayTab] activity delete auth:", authErr.message);
      if (!user) return;
      const today = new Date().toISOString().slice(0, 10);
      setTodayKey(today);

      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) {
        console.error("[TodayTab] activity delete:", error.message);
        return;
      }
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
      await fetchWeekTotals(user.id, today);
    } catch (err) {
      console.error("[TodayTab] activity delete:", err);
    }
  }

  const remainingLabel =
    totals.remaining >= 0
      ? `${Math.round(totals.remaining)} pozostało`
      : `${Math.round(Math.abs(totals.remaining))} przekroczone`;

  const remainingColorClass =
    totals.remaining >= 0 ? "text-[#3B6D11]" : "text-red-500";

  return (
    <div className="flex flex-col gap-5 text-white">
      {goalsLoading || dataLoading ? (
        <p className="text-center text-xs text-white/45">Ładowanie...</p>
      ) : null}

      <section>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#1E1E1E] p-3 text-center shadow-sm ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Spożyte</p>
            <p className="mt-1 text-2xl font-semibold text-[#BA7517]" tabIndex={0}>
              {Math.round(totals.consumed)}
            </p>
            <p className="text-[11px] text-white/35">kcal</p>
          </div>

          <div className="rounded-xl bg-[#1E1E1E] p-3 text-center shadow-sm ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Cel</p>
            <p className="mt-1 text-2xl font-semibold">{calorieGoal}</p>
            <p className={`text-[11px] font-medium ${remainingColorClass}`}>{remainingLabel}</p>
          </div>

          <div className="rounded-xl bg-[#1E1E1E] p-3 text-center shadow-sm ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Spalone</p>
            <p className="mt-1 text-2xl font-semibold text-[#3B6D11]" tabIndex={0}>
              {Math.round(totals.burned)}
            </p>
            <p className="text-[11px] text-white/35">kcal</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              role="progressbar"
              aria-valuenow={Math.round(totals.barPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Postęp kalorii"
              className={`h-full rounded-full transition-all ${
                totals.overBudget ? "bg-red-500" : "bg-[#EF9F27]"
              }`}
              style={{ width: `${totals.barPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/35">
            <span>spożyte / budżet</span>
            <span>{Math.round(totals.consumed)} / {Math.round(totals.budget)}</span>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#1E1E1E] p-3 text-center text-sm ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Białko</p>
            <p className="mt-2 font-semibold">
              {Math.round(totals.proteinConsumed)}g / <span className="text-white/70">{proteinGoal}g</span>
            </p>
          </div>
          <div className="rounded-xl bg-[#1E1E1E] p-3 text-center text-sm ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Węgle</p>
            <p className="mt-2 font-semibold">
              {Math.round(totals.carbsConsumed)}g / <span className="text-white/70">{carbsGoal}g</span>
            </p>
          </div>
          <div className="rounded-xl bg-[#1E1E1E] p-3 text-center text-sm ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Tłuszcz</p>
            <p className="mt-2 font-semibold">
              {Math.round(totals.fatConsumed)}g / <span className="text-white/70">{fatGoal}g</span>
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/80">
          POSIŁKI
        </h2>
        <p className="mb-2 text-[11px] leading-snug text-white/40">
          <strong className="text-white/55">AI</strong> szacuje makra z opisu;{" "}
          <strong className="text-white/55">własne kcal</strong> — gdy znasz wartość z opakowania
          lub innego źródła. <strong className="text-white/55">Mów</strong> przy polu opisu zamienia
          mowę na tekst. <strong className="text-white/55">Aparat</strong> 📷 odczytuje{" "}
          <strong className="text-white/55">wartości na 100 g</strong>, potem podajesz{" "}
          <strong className="text-white/55">ile gramów zjadłeś</strong> — kalorie i makra są
          przeliczane proporcjonalnie.
        </p>
        <div
          className="mb-3 flex rounded-xl border border-white/12 bg-black/25 p-0.5"
          role="tablist"
          aria-label="Sposób dodania posiłku"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mealEntryMode === "ai"}
            onClick={() => {
              setMealEntryMode("ai");
              setMealError(null);
            }}
            className={`min-h-[44px] flex-1 rounded-[10px] px-3 text-xs font-semibold transition ${
              mealEntryMode === "ai"
                ? "bg-[#EF9F27] text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Z opisu (AI)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mealEntryMode === "manual"}
            onClick={() => {
              setMealEntryMode("manual");
              setMealError(null);
              setImageMealDraft(null);
            }}
            className={`min-h-[44px] flex-1 rounded-[10px] px-3 text-xs font-semibold transition ${
              mealEntryMode === "manual"
                ? "bg-[#EF9F27] text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Własne kcal
          </button>
        </div>
        {mealEntryMode === "ai" ? (
          <form onSubmit={(e) => void handleAddMeal(e)} className="space-y-3">
            <input
              ref={mealPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only hidden"
              onChange={handleMealPhotoChange}
              aria-hidden
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={mealInput}
                onChange={(e) => setMealInput(e.target.value)}
                placeholder="np. owsianka z bananem, 2 jajka, jogurt..."
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
                disabled={
                  mealLoading ||
                  mealImageLoading ||
                  imageMealSaving ||
                  !!imageMealDraft
                }
              />
              <button
                type="button"
                disabled={
                  mealLoading ||
                  mealImageLoading ||
                  imageMealSaving ||
                  !!imageMealDraft
                }
                onClick={() => mealPhotoInputRef.current?.click()}
                aria-label="Dodaj zdjęcie posiłku"
                title="Zdjęcie → szacunek na 100 g"
                className="touch-manipulation shrink-0 whitespace-nowrap rounded-xl border border-white/25 bg-transparent px-4 py-3 text-lg transition hover:border-[#EF9F27]/50 hover:bg-white/5 disabled:opacity-45"
              >
                📷
              </button>
              <VoiceDictationButton
                disabled={
                  mealLoading ||
                  mealImageLoading ||
                  imageMealSaving ||
                  !!imageMealDraft
                }
                onAppendTranscript={(t) =>
                  setMealInput((prev) =>
                    prev.trim() ? `${prev.trim()} ${t}` : t
                  )
                }
              />
            </div>
            {mealImageLoading ? (
              <p className="text-center text-xs text-white/50">Analizuję zdjęcie...</p>
            ) : null}

            {imageMealDraft ? (
              <div className="space-y-3 rounded-xl border border-[#BA7517]/45 bg-black/25 p-3">
                <p className="text-[11px] font-semibold text-[#BA7517]">
                  Zdjęcie — wartości referencyjne na 100 g
                </p>
                <p className="text-sm font-medium text-white">{imageMealDraft.name}</p>
                <p className="text-xs text-white/55">
                  {Math.round(imageMealDraft.kcal100)} kcal · B{" "}
                  {Math.round(imageMealDraft.protein100)} g · W{" "}
                  {Math.round(imageMealDraft.carbs100)} g · T{" "}
                  {Math.round(imageMealDraft.fat100)} g{" "}
                  <span className="text-white/35">/ 100 g</span>
                </p>
                <label className="block text-[11px] text-white/50">
                  Ile gramów zjadłeś?
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={1}
                    value={imageMealGramsStr}
                    onChange={(e) => setImageMealGramsStr(e.target.value)}
                    disabled={imageMealSaving}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60 disabled:opacity-50"
                  />
                </label>
                {imagePortionPreview ? (
                  <p className="text-xs text-[#BA7517]">
                    Twoja porcja ({imagePortionPreview.grams} g):{" "}
                    {imagePortionPreview.kcal} kcal · B {imagePortionPreview.p} · W{" "}
                    {imagePortionPreview.c} · T {imagePortionPreview.fat}
                  </p>
                ) : (
                  <p className="text-[11px] text-white/35">
                    Wpisz gramaturę porcji, żeby zobaczyć podsumowanie.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={imageMealSaving}
                    onClick={() => {
                      setImageMealDraft(null);
                      setImageMealGramsStr("100");
                      setMealError(null);
                    }}
                    className="flex-1 rounded-xl border border-white/20 py-2.5 text-xs font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    disabled={imageMealSaving || !imagePortionPreview}
                    onClick={() => void confirmImageMealDraft()}
                    className="flex-1 rounded-xl border border-[#EF9F27]/55 bg-[#EF9F27]/15 py-2.5 text-xs font-semibold text-[#EF9F27] hover:bg-[#EF9F27]/25 disabled:opacity-45"
                  >
                    {imageMealSaving ? "Zapisuję…" : "Dodaj posiłek"}
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                mealLoading ||
                mealImageLoading ||
                imageMealSaving ||
                !!imageMealDraft
              }
              className="w-full rounded-xl border border-white/25 bg-transparent py-3 text-sm font-medium text-white transition hover:border-white hover:bg-white/5 disabled:opacity-55"
            >
              {mealLoading ? "Parsowanie…" : "Dodaj posiłek"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleAddMealManual(e)} className="space-y-3">
            <input
              type="text"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              placeholder="Nazwa posiłku"
              className="w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
            />
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={manualKcalStr}
              onChange={(e) => setManualKcalStr(e.target.value)}
              placeholder="Kalorie (kcal) *"
              className="w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={manualPStr}
                onChange={(e) => setManualPStr(e.target.value)}
                placeholder="B (g)"
                className="rounded-xl border border-white/15 bg-[#1E1E1E] px-2 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={manualCStr}
                onChange={(e) => setManualCStr(e.target.value)}
                placeholder="W (g)"
                className="rounded-xl border border-white/15 bg-[#1E1E1E] px-2 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={manualFStr}
                onChange={(e) => setManualFStr(e.target.value)}
                placeholder="T (g)"
                className="rounded-xl border border-white/15 bg-[#1E1E1E] px-2 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
              />
            </div>
            <p className="text-[10px] text-white/35">Makra opcjonalne — puste zostanie 0 g.</p>
            <button
              type="submit"
              className="w-full rounded-xl border border-white/25 bg-transparent py-3 text-sm font-medium text-white transition hover:border-white hover:bg-white/5"
            >
              Dodaj posiłek
            </button>
          </form>
        )}
        {mealError ? <p className="mt-2 text-xs text-red-400">{mealError}</p> : null}

        {meals.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/35">Brak posiłków na dziś</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {meals.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-xl bg-[#1E1E1E] px-3 py-2.5 text-sm ring-1 ring-white/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{m.label}</p>
                  <p className="truncate text-[11px] text-white/40">{m.text}</p>
                  <p className="mt-1 text-xs text-[#BA7517]">{m.calories} kcal · B {m.protein_g} · W {m.carbs_g} · T {m.fat_g}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeMeal(m.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400 hover:bg-white/10"
                  aria-label="Usuń posiłek"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/80">
          KROKI
        </h2>
        <form onSubmit={(e) => void handleAddSteps(e)} className="space-y-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={stepsStr}
            onChange={(e) => setStepsStr(e.target.value)}
            placeholder="Liczba kroków (np. 8500)"
            className="w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-lg font-semibold text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
            disabled={stepsSaving}
          />
          <p className="text-[11px] leading-snug text-white/45">
            Kalorie liczone na podstawie Twojej wagi.
          </p>
          {latestWeightKg === null ? (
            <div className="space-y-1">
              <p className="text-[11px] text-amber-300">Podaj wagę aby przeliczyć kroki.</p>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={stepsWeightManualStr}
                onChange={(e) => setStepsWeightManualStr(e.target.value)}
                placeholder="Waga (kg)"
                className="w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
                disabled={stepsSaving}
              />
            </div>
          ) : (
            <p className="text-[11px] text-white/50">
              Aktualna waga do przeliczeń: {latestWeightKg} kg
            </p>
          )}
          <button
            type="submit"
            disabled={stepsSaving}
            className="w-full rounded-xl border border-white/25 bg-transparent py-3 text-sm font-medium text-white transition hover:border-white hover:bg-white/5 disabled:opacity-55"
          >
            {stepsSaving ? "Dodawanie…" : "Dodaj kroki"}
          </button>
          {stepsError ? <p className="text-xs text-red-400">{stepsError}</p> : null}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/80">
          AKTYWNOŚĆ
        </h2>
        <form onSubmit={(e) => void handleAddActivity(e)} className="space-y-3">
          <div className="flex items-start gap-2">
            <textarea
              rows={5}
              value={activityText}
              onChange={(e) => setActivityText(e.target.value)}
              placeholder="Opisz aktywność — np. bieganie 5 km, tempo 5:30, siłownia..."
              className="min-w-0 flex-1 resize-y rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
            />
            <VoiceDictationButton
              onAppendTranscript={(t) =>
                setActivityText((prev) =>
                  prev.trim() ? `${prev.trim()} ${t}` : t
                )
              }
            />
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={activityKcal}
            onChange={(e) => setActivityKcal(e.target.value)}
            placeholder="Spalone kcal"
            className="w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#EF9F27]/60"
          />
          <button
            type="submit"
            className="w-full rounded-xl border border-white/25 bg-transparent py-3 text-sm font-medium text-white transition hover:border-white hover:bg-white/5"
          >
            Dodaj aktywność
          </button>
        </form>

        {workouts.length === 0 ? (
          <p className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-white/35">
            <span aria-hidden className="text-lg">
              ⌄
            </span>
            Brak aktywności na dziś
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {workouts.map((w) => (
              <li
                key={w.id}
                className="flex items-start gap-3 rounded-xl bg-[#1E1E1E] px-3 py-2.5 text-sm ring-1 ring-white/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="leading-snug text-white">{w.description}</p>
                  <p className="mt-1 text-xs font-medium text-[#3B6D11]">−{Math.round(w.caloriesBurned)} kcal</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeActivity(w.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400 hover:bg-white/10"
                  aria-label="Usuń aktywność"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="touch-manipulation pb-2">
        <h2 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/80">
          Ostatnie 7 dni — kcal
        </h2>
        <p className="mb-3 text-[11px] leading-snug text-white/45">
          Pomarańczowa linia: spożyte. Jasna linia: budżet (cel {Math.round(calorieGoal)} kcal + spalone tego dnia).
          Liczba nad słupkiem: bilans spożyte − budżet (+nadwyżka / −zapas).
        </p>

        <div className="mb-2 grid grid-cols-7 gap-1 text-[9px] leading-tight sm:text-[10px]">
          {weekSeries.map((row) => (
            <div key={row.dk} className="flex flex-col items-center text-center">
              <span className="font-semibold capitalize text-white/88">
                {row.weekShort.replace(/\.$/, "")}
              </span>
              <span className="mt-0.5 text-white/50">
                {row.consumed}/{row.budget}
              </span>
              <span
                className={`mt-0.5 font-semibold tabular-nums ${
                  row.delta === 0
                    ? "text-white/40"
                    : row.delta > 0
                      ? "text-red-400"
                      : "text-emerald-400"
                }`}
              >
                {row.delta === 0
                  ? "0"
                  : row.delta > 0
                    ? `+${row.delta}`
                    : `${row.delta}`}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/15 bg-[#1E1E1E] p-2 ring-1 ring-white/10">
          <div className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={weekSeries}
                margin={{ top: 8, right: 4, left: -16, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="#333"
                  strokeDasharray="3 6"
                  opacity={0.85}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#9ca3af", fontSize: 9 }}
                  tickLine={false}
                  axisLine={{ stroke: "#333" }}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  width={36}
                  tickLine={false}
                  axisLine={{ stroke: "#333" }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #333",
                    background: "#151515",
                    borderRadius: "10px",
                  }}
                  labelStyle={{ color: "#fafafa", fontWeight: 600 }}
                  formatter={(value, name) => {
                    const n =
                      typeof value === "number" && Number.isFinite(value)
                        ? value
                        : Number(value);
                    const v = Number.isFinite(n) ? Math.round(n) : 0;
                    const nm = String(name);
                    const label =
                      nm === "consumed"
                        ? "Spożyte"
                        : nm === "budget"
                          ? "Budżet (cel + spalone)"
                          : nm;
                    return [`${v} kcal`, label];
                  }}
                  labelFormatter={(_, payload) => {
                    const raw = payload?.[0]?.payload as
                      | (typeof weekSeries)[0]
                      | undefined;
                    if (!raw) return "";
                    const bal =
                      raw.delta === 0
                        ? "równo z budżetem"
                        : raw.delta > 0
                          ? `nad budżetem o ${raw.delta} kcal`
                          : `pod budżetem o ${Math.abs(raw.delta)} kcal`;
                    return `${raw.weekShort.replace(/\.$/, "")} · ${bal}`;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  formatter={(v) => (
                    <span style={{ color: "#d4d4d4" }}>
                      {v === "consumed"
                        ? "Spożyte"
                        : v === "budget"
                          ? "Budżet"
                          : v}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="consumed"
                  name="consumed"
                  stroke="#BA7517"
                  strokeWidth={2}
                  dot={{ r: 3, stroke: "#fafafa", strokeWidth: 1, fill: "#121212" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="budget"
                  name="budget"
                  stroke="#e5e5e5"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 2.5, fill: "#e5e5e5" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
