export type DailyReflection = {
  user_id: string;
  date: string;
  transcript: string;
  summary: string;
  updated_at: string;
};

export type WeeklyReflectionSummary = {
  user_id: string;
  week_start: string;
  summary: string;
  generated_at: string;
};

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  frequency_type: "daily" | "weekly" | "monthly";
  target_count: number;
  sort_order: number;
  active: boolean;
};

export type PersonalRuleRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  sort_order: number;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type DatedGoalRow = {
  id: string;
  user_id: string;
  date: string;
  project_id: string | null;
  title: string;
  description: string;
  sort_order: number;
};

export type NewThingRow = {
  id: string;
  user_id: string;
  status: "planned" | "done";
  title: string;
  description: string;
  planned_date: string | null;
  done_date: string | null;
  sort_order: number;
};

export type ReflectionViewMode = "day" | "week" | "export";
