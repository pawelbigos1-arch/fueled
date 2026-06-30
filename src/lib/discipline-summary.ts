import { addDays, formatDateKey, parseDateKey } from "@/lib/fueled-storage";
import { monthEnd, monthStart } from "@/lib/habit-period";
import {
  DISCIPLINE_KINDS,
  DISCIPLINE_KIND_META,
  getTargetForKind,
  type DisciplineCellState,
  type DisciplineKind,
  type DisciplineKindSummary,
  type DisciplineOverrideRow,
  type DisciplineTargetsRow,
} from "@/lib/discipline-types";
import { isAutoDetected } from "@/lib/discipline-auto";

export type OverrideMap = Map<string, Map<DisciplineKind, boolean>>;

export function buildOverrideMap(
  rows: Pick<DisciplineOverrideRow, "date" | "kind" | "done">[]
): OverrideMap {
  const map: OverrideMap = new Map();
  for (const row of rows) {
    if (!map.has(row.date)) map.set(row.date, new Map());
    map.get(row.date)!.set(row.kind, row.done);
  }
  return map;
}

export function getCellState(
  autoMap: Map<string, Set<DisciplineKind>>,
  overrideMap: OverrideMap,
  date: string,
  kind: DisciplineKind
): DisciplineCellState {
  const auto = isAutoDetected(autoMap, date, kind);
  const override = overrideMap.get(date)?.get(kind) ?? null;
  const effective = override ?? auto;
  return { effective, auto, override: override ?? null };
}

export function countEffectiveInRange(
  autoMap: Map<string, Set<DisciplineKind>>,
  overrideMap: OverrideMap,
  dates: string[],
  kind: DisciplineKind
): number {
  let n = 0;
  for (const date of dates) {
    if (getCellState(autoMap, overrideMap, date, kind).effective) n += 1;
  }
  return n;
}

export function weeksInMonth(monthStartKey: string): number {
  const start = parseDateKey(monthStartKey);
  const end = parseDateKey(monthEnd(monthStartKey));
  const days =
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, Math.ceil(days / 7));
}

export function daysInMonth(monthStartKey: string): number {
  const start = parseDateKey(monthStartKey);
  const end = parseDateKey(monthEnd(monthStartKey));
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function monthDayKeys(monthStartKey: string): string[] {
  const start = parseDateKey(monthStartKey);
  const total = daysInMonth(monthStartKey);
  const keys: string[] = [];
  for (let i = 0; i < total; i += 1) {
    keys.push(formatDateKey(addDays(start, i)));
  }
  return keys;
}

function periodTarget(
  targets: Omit<DisciplineTargetsRow, "user_id" | "updated_at">,
  kind: DisciplineKind,
  scope: "week" | "month",
  monthStartKey: string
): number {
  const weeklyTarget = getTargetForKind(targets, kind);
  if (scope === "week") {
    return DISCIPLINE_KIND_META[kind].period === "daily" ? weeklyTarget : weeklyTarget;
  }
  if (DISCIPLINE_KIND_META[kind].period === "daily") {
    return daysInMonth(monthStartKey);
  }
  return weeklyTarget * weeksInMonth(monthStartKey);
}

export function summarizeKind(
  autoMap: Map<string, Set<DisciplineKind>>,
  overrideMap: OverrideMap,
  dates: string[],
  kind: DisciplineKind,
  targets: Omit<DisciplineTargetsRow, "user_id" | "updated_at">,
  scope: "week" | "month",
  monthStartKey: string
): DisciplineKindSummary {
  const count = countEffectiveInRange(autoMap, overrideMap, dates, kind);
  const target = periodTarget(targets, kind, scope, monthStartKey);
  return {
    kind,
    count,
    target,
    met: count >= target,
  };
}

export function summarizeAll(
  autoMap: Map<string, Set<DisciplineKind>>,
  overrideMap: OverrideMap,
  dates: string[],
  targets: Omit<DisciplineTargetsRow, "user_id" | "updated_at">,
  scope: "week" | "month",
  monthStartKey: string
): DisciplineKindSummary[] {
  return DISCIPLINE_KINDS.map((kind) =>
    summarizeKind(autoMap, overrideMap, dates, kind, targets, scope, monthStartKey)
  );
}

export function monthStartForDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return monthStart(d);
}
