export const DISCIPLINE_KINDS = [
  "diet",
  "no_sweets",
  "stretching",
  "strength",
  "cardio",
  "pool",
] as const;

export type DisciplineKind = (typeof DISCIPLINE_KINDS)[number];

export type DisciplinePeriod = "daily" | "weekly";

export type DisciplineKindMeta = {
  kind: DisciplineKind;
  label: string;
  shortLabel: string;
  period: DisciplinePeriod;
  hasAuto: boolean;
};

export const DISCIPLINE_KIND_META: Record<DisciplineKind, DisciplineKindMeta> = {
  diet: {
    kind: "diet",
    label: "Dieta",
    shortLabel: "Dieta",
    period: "daily",
    hasAuto: true,
  },
  no_sweets: {
    kind: "no_sweets",
    label: "Bez słodyczy",
    shortLabel: "Bez słod.",
    period: "daily",
    hasAuto: false,
  },
  stretching: {
    kind: "stretching",
    label: "Rozciąganie",
    shortLabel: "Rozciąg.",
    period: "daily",
    hasAuto: true,
  },
  strength: {
    kind: "strength",
    label: "Trening siłowy",
    shortLabel: "Siła",
    period: "weekly",
    hasAuto: true,
  },
  cardio: {
    kind: "cardio",
    label: "Cardio",
    shortLabel: "Cardio",
    period: "weekly",
    hasAuto: true,
  },
  pool: {
    kind: "pool",
    label: "Basen",
    shortLabel: "Basen",
    period: "weekly",
    hasAuto: true,
  },
};

export type DisciplineTargetsRow = {
  user_id: string;
  diet_weekly: number;
  no_sweets_weekly: number;
  stretching_weekly: number;
  strength_weekly: number;
  cardio_weekly: number;
  pool_weekly: number;
  updated_at: string;
};

export const DEFAULT_DISCIPLINE_TARGETS: Omit<
  DisciplineTargetsRow,
  "user_id" | "updated_at"
> = {
  diet_weekly: 7,
  no_sweets_weekly: 7,
  stretching_weekly: 7,
  strength_weekly: 2,
  cardio_weekly: 2,
  pool_weekly: 1,
};

export type DisciplineOverrideRow = {
  user_id: string;
  date: string;
  kind: DisciplineKind;
  done: boolean;
  updated_at: string;
};

export type DisciplineCellState = {
  effective: boolean;
  auto: boolean;
  override: boolean | null;
};

export type DisciplineKindSummary = {
  kind: DisciplineKind;
  count: number;
  target: number;
  met: boolean;
};

export function targetFieldForKind(
  kind: DisciplineKind
): keyof Omit<DisciplineTargetsRow, "user_id" | "updated_at"> {
  switch (kind) {
    case "diet":
      return "diet_weekly";
    case "no_sweets":
      return "no_sweets_weekly";
    case "stretching":
      return "stretching_weekly";
    case "strength":
      return "strength_weekly";
    case "cardio":
      return "cardio_weekly";
    case "pool":
      return "pool_weekly";
  }
}

export function getTargetForKind(
  targets: Omit<DisciplineTargetsRow, "user_id" | "updated_at">,
  kind: DisciplineKind
): number {
  return targets[targetFieldForKind(kind)];
}
