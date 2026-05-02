/**Typy pomocnicze, klucze słownika ćwiczeń (`fueled_dict`) i funkcje daty.



 * Dane aplikacji trzymane są w Supabase (per user_id).
 */

export const LS_DICT = "fueled_dict";

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

export const DEFAULT_GOAL_LS: GoalStorage = {
  calories: 2200,
  protein: 160,
  carbs: 220,
  fats: 70,
};

export type WeightDay = {
  weight?: number;
  fat?: number;
  muscle?: number;
};

export type WeightStorage = Record<string, WeightDay>;

export type LogSet = { weight: number; reps: number; series: number };

export type LogEntry = {
  id: string;
  date: string;
  exercise: string;
  category: string;
  sets: LogSet[];
};

export type DailyWorkout = {
  id: string;
  description: string;
  caloriesBurned: number;
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
