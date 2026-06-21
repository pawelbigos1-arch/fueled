import { formatDateKey, parseDateKey } from "@/lib/fueled-storage";

export type HabitFrequencyType = "daily" | "weekly" | "monthly";

/** Poniedziałek bieżącego tygodnia (ISO). */
export function weekStartMonday(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return formatDateKey(x);
}

/** Pierwszy dzień bieżącego miesiąca. */
export function monthStart(d: Date = new Date()): string {
  return formatDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function weekEndSunday(weekStartKey: string): string {
  const start = parseDateKey(weekStartKey);
  start.setDate(start.getDate() + 6);
  return formatDateKey(start);
}

export function monthEnd(monthStartKey: string): string {
  const start = parseDateKey(monthStartKey);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return formatDateKey(end);
}

export function periodBounds(
  frequency: HabitFrequencyType,
  ref: Date = new Date()
): { start: string; end: string } {
  if (frequency === "daily") {
    const dk = formatDateKey(ref);
    return { start: dk, end: dk };
  }
  if (frequency === "weekly") {
    const start = weekStartMonday(ref);
    return { start, end: weekEndSunday(start) };
  }
  const start = monthStart(ref);
  return { start, end: monthEnd(start) };
}

export function frequencyLabel(
  type: HabitFrequencyType,
  target: number
): string {
  if (type === "daily") return "Codziennie";
  if (type === "weekly") return `${target}× w tygodniu`;
  return `${target}× w miesiącu`;
}
