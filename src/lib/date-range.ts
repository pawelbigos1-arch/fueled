export type StatsRange =
  | "7d"
  | "14d"
  | "1m"
  | "2m"
  | "3m"
  | "6m"
  | "1r";

export function startDateForRange(
  range: StatsRange,
  end: Date = new Date()
): Date {
  const d = new Date(end);
  switch (range) {
    case "7d":
      d.setDate(d.getDate() - 7);
      return d;
    case "14d":
      d.setDate(d.getDate() - 14);
      return d;
    case "1m":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "2m":
      d.setMonth(d.getMonth() - 2);
      return d;
    case "3m":
      d.setMonth(d.getMonth() - 3);
      return d;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "1r":
      d.setFullYear(d.getFullYear() - 1);
      return d;
    default:
      return d;
  }
}

export function isDateKeyInRange(
  dateKey: string,
  range: StatsRange,
  end: Date = new Date()
): boolean {
  const start = startDateForRange(range, end);
  const dt = parseKey(dateKey);
  return dt >= stripTime(start) && dt <= stripTime(end);
}

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive iteration from startDay to endDay (local midnight). */
export function enumerateDays(start: Date, end: Date): string[] {
  const s = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const out: string[] = [];
  const cur = new Date(s);

  while (cur <= e) {
    out.push(formatLocalKey(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return out;
}
