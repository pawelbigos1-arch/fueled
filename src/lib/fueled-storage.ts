/** Helpers + localStorage keys for FUELED (bez Supabase) */

export const LS_PLAN_PREFIX = "fueled_plan_";
export const LS_MEALS_PREFIX = "fueled_meals_";
export const LS_BURN_PREFIX = "fueled_burn_";
export const LS_GOAL = "fueled_goal";
export const LS_LOG = "fueled_log";
export const LS_DICT = "fueled_dict";
export const LS_WEIGHT = "fueled_weight";
export const LS_WORKOUTS_PREFIX = "fueled_workouts_";

export type StoredMeal = {
  id: string;
  text: string;
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type PlanMeal = StoredMeal & {
  eaten: boolean;
};

export type PlanDay = {
  meals: PlanMeal[];
};

export type GoalStorage = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readGoal(): GoalStorage | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LS_GOAL);
  if (!raw) return null;
  const x = safeParse(raw, null) as GoalStorage | null;
  if (!x || typeof x.calories !== "number") return null;
  return x;
}

export function writeGoal(g: GoalStorage): void {
  localStorage.setItem(LS_GOAL, JSON.stringify(g));
}

export const DEFAULT_GOAL_LS: GoalStorage = {
  calories: 2200,
  protein: 160,
  carbs: 220,
  fats: 70,
};

export function resolveGoal(): GoalStorage {
  return readGoal() ?? DEFAULT_GOAL_LS;
}

export function readMealsStored(dateKey: string): StoredMeal[] {
  const raw = localStorage.getItem(LS_MEALS_PREFIX + dateKey);
  const parsed = safeParse(raw, {}) as { meals?: StoredMeal[] };
  return Array.isArray(parsed.meals) ? parsed.meals : [];
}

export function writeMealsStored(dateKey: string, meals: StoredMeal[]): void {
  localStorage.setItem(LS_MEALS_PREFIX + dateKey, JSON.stringify({ meals }));
}

/** Append meal (duplicate by id omitted) */
export function appendMeal(dateKey: string, meal: StoredMeal): void {
  const cur = readMealsStored(dateKey);
  if (cur.some((m) => m.id === meal.id)) return;
  writeMealsStored(dateKey, [...cur, meal]);
}

export function readBurnTotal(dateKey: string): number {
  const raw = localStorage.getItem(LS_BURN_PREFIX + dateKey);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function writeBurnTotal(dateKey: string, total: number): void {
  localStorage.setItem(
    LS_BURN_PREFIX + dateKey,
    String(Math.max(0, Math.round(total)))
  );
}

export function readPlan(dateKey: string): PlanDay {
  const raw = localStorage.getItem(LS_PLAN_PREFIX + dateKey);
  const parsed = safeParse(raw, {}) as Partial<PlanDay>;
  const meals = Array.isArray(parsed.meals) ? parsed.meals : [];
  return {
    meals: meals.map((m) => ({
      ...m,
      eaten: Boolean((m as PlanMeal).eaten),
    })),
  };
}

export function writePlan(dateKey: string, plan: PlanDay): void {
  localStorage.setItem(LS_PLAN_PREFIX + dateKey, JSON.stringify(plan));
}

export type WeightDay = {
  weight?: number;
  fat?: number;
  muscle?: number;
};

export type WeightStorage = Record<string, WeightDay>;

export function readWeightStore(): WeightStorage {
  const raw = localStorage.getItem(LS_WEIGHT);
  return safeParse(raw, {}) as WeightStorage;
}

export function writeWeightStore(d: WeightStorage): void {
  localStorage.setItem(LS_WEIGHT, JSON.stringify(d));
}

export type LogSet = { weight: number; reps: number; series: number };

export type LogEntry = {
  id: string;
  date: string;
  exercise: string;
  category: string;
  sets: LogSet[];
};

export function readLogEntries(): LogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_LOG);
  const arr = safeParse(raw, []) as LogEntry[];
  return Array.isArray(arr) ? arr : [];
}

export function writeLogEntries(entries: LogEntry[]): void {
  localStorage.setItem(LS_LOG, JSON.stringify(entries));
}

export function appendLogEntry(entry: LogEntry): void {
  writeLogEntries([...readLogEntries(), entry]);
}

export type DailyWorkout = {
  id: string;
  description: string;
  caloriesBurned: number;
};

export function readWorkoutsStored(dateKey: string): DailyWorkout[] {
  const raw = localStorage.getItem(LS_WORKOUTS_PREFIX + dateKey);
  const p = safeParse(raw, {}) as { workouts?: DailyWorkout[] };
  return Array.isArray(p.workouts) ? p.workouts : [];
}

export function writeWorkoutsStored(
  dateKey: string,
  workouts: DailyWorkout[]
): void {
  localStorage.setItem(
    LS_WORKOUTS_PREFIX + dateKey,
    JSON.stringify({ workouts })
  );
}
