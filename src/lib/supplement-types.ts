export const SUPPLEMENT_RULE_CONDITIONS = ["always", "training", "rest"] as const;

export type SupplementRuleCondition = (typeof SUPPLEMENT_RULE_CONDITIONS)[number];

export const RULE_CONDITION_LABELS: Record<SupplementRuleCondition, string> = {
  always: "Zawsze",
  training: "Dzień treningowy",
  rest: "Dzień odpoczynku",
};

export type SupplementTimingRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export type SupplementRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export type SupplementRuleRow = {
  id: string;
  supplement_id: string;
  user_id: string;
  condition: SupplementRuleCondition;
  sort_order: number;
};

export type SupplementRuleDoseRow = {
  id: string;
  rule_id: string;
  user_id: string;
  timing_id: string;
  sort_order: number;
};

export type SupplementIntakeRow = {
  user_id: string;
  date: string;
  supplement_id: string;
  timing_id: string;
  dose_index: number;
  taken: boolean;
  updated_at: string;
};

export type TrainingDayPlanRow = {
  user_id: string;
  date: string;
  is_training: boolean;
  updated_at: string;
};

export type ExpectedDose = {
  supplementId: string;
  supplementName: string;
  timingId: string;
  timingName: string;
  doseIndex: number;
  key: string;
};

export type DaySupplementProgress = {
  taken: number;
  expected: number;
  met: boolean;
};

export const DEFAULT_SUPPLEMENT_TIMINGS = [
  "Po przebudzeniu",
  "Do śniadania",
  "Po śniadaniu",
  "Między posiłkami (rano)",
  "30 min przed obiadem",
  "Przed obiadem",
  "Po obiedzie",
  "Przed treningiem",
  "Po treningu",
  "Przed snem",
] as const;

export type SupplementBundle = {
  timings: SupplementTimingRow[];
  supplements: SupplementRow[];
  rules: SupplementRuleRow[];
  doses: SupplementRuleDoseRow[];
  intakes: SupplementIntakeRow[];
  trainingPlans: TrainingDayPlanRow[];
};
