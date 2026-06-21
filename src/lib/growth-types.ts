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

export type ReflectionViewMode = "day" | "week" | "export";
