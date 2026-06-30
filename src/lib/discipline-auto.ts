import type { DisciplineKind } from "@/lib/discipline-types";
import { DISCIPLINE_KINDS } from "@/lib/discipline-types";

export type MealRow = { date: string; kcal: number | null };
export type WorkoutRow = {
  date: string;
  exercise: string;
  category: string;
  measurement_profile?: string | null;
};
export type ActivityRow = {
  date: string;
  name: string;
  metadata?: Record<string, unknown> | null;
};

const POOL_PATTERN = /pływan|plywan|basen|pool/i;
const STRETCH_PATTERN = /rozciąg|rozciag|stretch|mobil/i;
const NON_STRENGTH_CATEGORIES = new Set(["Cardio", "Aktywność"]);

function matchesPool(text: string): boolean {
  return POOL_PATTERN.test(text);
}

function matchesStretch(text: string): boolean {
  return STRETCH_PATTERN.test(text);
}

function isPoolWorkout(row: WorkoutRow): boolean {
  return (
    matchesPool(row.exercise) ||
    matchesPool(row.category) ||
    (row.category === "Cardio" && row.exercise === "Pływanie")
  );
}

function isStretchWorkout(row: WorkoutRow): boolean {
  return matchesStretch(row.exercise) || matchesStretch(row.category);
}

function isStrengthWorkout(row: WorkoutRow): boolean {
  if (isPoolWorkout(row) || isStretchWorkout(row)) return false;
  if (row.measurement_profile === "strength_standard") return true;
  return !NON_STRENGTH_CATEGORIES.has(row.category);
}

function isCardioWorkout(row: WorkoutRow): boolean {
  if (isPoolWorkout(row)) return false;
  if (row.measurement_profile === "running") return true;
  if (row.category === "Cardio" && row.exercise !== "Pływanie") return true;
  return false;
}

function isCardioActivity(row: ActivityRow): boolean {
  const meta = row.metadata ?? {};
  const type = typeof meta.type === "string" ? meta.type : "";
  if (type === "run" || type === "steps") return true;
  if (matchesPool(row.name)) return false;
  return /bieg|run|krok|cardio|rower|orbitrek/i.test(row.name);
}

function isPoolActivity(row: ActivityRow): boolean {
  return matchesPool(row.name);
}

function detectDietForDay(
  date: string,
  meals: MealRow[],
  calorieGoal: number
): boolean {
  if (!Number.isFinite(calorieGoal) || calorieGoal <= 0) return false;
  const dayMeals = meals.filter((m) => m.date === date);
  if (dayMeals.length === 0) return false;
  const total = dayMeals.reduce((sum, m) => sum + Math.max(0, Number(m.kcal) || 0), 0);
  const min = calorieGoal * 0.85;
  const max = calorieGoal * 1.1;
  return total >= min && total <= max;
}

/** Map date -> kind -> auto detected */
export function computeAutoDetected(
  dates: string[],
  meals: MealRow[],
  calorieGoal: number,
  workouts: WorkoutRow[],
  activities: ActivityRow[]
): Map<string, Set<DisciplineKind>> {
  const result = new Map<string, Set<DisciplineKind>>();
  for (const date of dates) {
    result.set(date, new Set());
  }

  for (const date of dates) {
    const set = result.get(date)!;
    if (detectDietForDay(date, meals, calorieGoal)) {
      set.add("diet");
    }
  }

  for (const row of workouts) {
    if (!result.has(row.date)) continue;
    const set = result.get(row.date)!;
    if (isPoolWorkout(row)) {
      set.add("pool");
      continue;
    }
    if (isStretchWorkout(row)) {
      set.add("stretching");
    }
    if (isStrengthWorkout(row)) {
      set.add("strength");
    }
    if (isCardioWorkout(row)) {
      set.add("cardio");
    }
  }

  for (const row of activities) {
    if (!result.has(row.date)) continue;
    const set = result.get(row.date)!;
    if (isPoolActivity(row)) {
      set.add("pool");
      continue;
    }
    if (isCardioActivity(row)) {
      set.add("cardio");
    }
  }

  return result;
}

export function isAutoDetected(
  autoMap: Map<string, Set<DisciplineKind>>,
  date: string,
  kind: DisciplineKind
): boolean {
  return autoMap.get(date)?.has(kind) ?? false;
}

export function emptyAutoMap(dates: string[]): Map<string, Set<DisciplineKind>> {
  const map = new Map<string, Set<DisciplineKind>>();
  for (const date of dates) {
    map.set(date, new Set());
  }
  return map;
}

export function allDatesFromKeys(...dateLists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of dateLists) {
    for (const d of list) set.add(d);
  }
  return [...set].sort();
}

/** Daty z treningiem siłowym w dzienniku (podpowiedź UI suplementów). */
export function strengthDatesFromWorkouts(workouts: WorkoutRow[]): Set<string> {
  const dates = new Set<string>();
  for (const row of workouts) {
    if (isStrengthWorkout(row)) dates.add(row.date);
  }
  return dates;
}

export { DISCIPLINE_KINDS };
