import type { LogSet } from "@/lib/fueled-storage";
import type { DictStore } from "@/lib/exercise-catalog";

export type MeasurementProfile =
  | "strength_standard"
  | "running"
  | "farmer_carry"
  | "bodyweight"
  | "isometric"
  | "negative";

export const MEASUREMENT_PROFILE_LABELS: Record<MeasurementProfile, string> = {
  strength_standard: "Siłowe (kg + powt. + serie)",
  running: "Bieganie (km + czas)",
  farmer_carry: "Noszenie / farmer walk",
  bodyweight: "Masa własna (+ opcj. kg)",
  isometric: "Izometria / trzymanie",
  negative: "Negatywy / opuszczanie",
};

export const DEFAULT_EXERCISE_PROFILES: Record<string, MeasurementProfile> = {
  Bieganie: "running",
  Pompki: "bodyweight",
  Podciąganie: "bodyweight",
  Plank: "isometric",
  "Deska boczna": "isometric",
  "Spięcia brzucha": "bodyweight",
  Nożyce: "bodyweight",
  "Unoszenie nóg": "bodyweight",
};

export function defaultProfileForExercise(name: string): MeasurementProfile {
  return DEFAULT_EXERCISE_PROFILES[name] ?? "strength_standard";
}

export function resolveExerciseProfile(
  dict: DictStore,
  cat: string,
  name: string
): MeasurementProfile {
  const row = dict[cat as keyof DictStore]?.find((e) => e.name === name);
  return row?.measurementProfile ?? defaultProfileForExercise(name);
}

export function profileHint(profile: MeasurementProfile): string | null {
  switch (profile) {
    case "strength_standard":
      return "Ciężar [kg], powtórzenia i liczba serii.";
    case "bodyweight":
      return "Powtórzenia i serie; opcjonalnie dodatkowy ciężar [kg].";
    case "farmer_carry":
      return "Czas trzymania, ciężar [kg] i liczba serii.";
    case "isometric":
      return "Czas trzymania i serie; opcjonalnie dodatkowy ciężar [kg].";
    case "negative":
      return "Powtórzenia, serie, czas pojedynczego opuszczania [s]; opcjonalnie kg.";
    default:
      return null;
  }
}

export function formatDurationSec(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}:${String(sec).padStart(2, "0")}`;
  return `${sec}s`;
}

export function parseDurationFields(minStr: string, secStr: string): number | null {
  const min = Number.parseInt(minStr.trim(), 10);
  const sec = Number.parseInt(secStr.trim(), 10);
  if (!Number.isFinite(min) || min < 0) return null;
  if (!Number.isFinite(sec) || sec < 0 || sec >= 60) return null;
  const total = min * 60 + sec;
  return total > 0 ? total : null;
}

function parseOptionalWeight(raw: string): number | undefined {
  const t = raw.replace(",", ".").trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseRequiredWeight(raw: string): number | null {
  const n = parseOptionalWeight(raw);
  return n === undefined ? null : n;
}

export type ProfileFormInput = {
  weightStr: string;
  repStr: string;
  serieStr: string;
  durMinStr: string;
  durSecStr: string;
  negSecStr: string;
};

export function buildSetFromProfile(
  profile: MeasurementProfile,
  input: ProfileFormInput
): { set: LogSet | null; error?: string } {
  const series = Number.parseInt(input.serieStr.trim(), 10);
  if (!Number.isFinite(series) || series < 1) {
    return { set: null, error: "Podaj liczbę serii (≥ 1)." };
  }

  switch (profile) {
    case "strength_standard": {
      const reps = Number.parseInt(input.repStr.trim(), 10);
      const weight = parseRequiredWeight(input.weightStr);
      if (!Number.isFinite(reps) || reps < 1) {
        return { set: null, error: "Podaj powtórzenia." };
      }
      if (weight === null) return { set: null, error: "Podaj ciężar [kg]." };
      return { set: { weight, reps, series } };
    }
    case "bodyweight": {
      const reps = Number.parseInt(input.repStr.trim(), 10);
      if (!Number.isFinite(reps) || reps < 1) {
        return { set: null, error: "Podaj powtórzenia." };
      }
      const weight = parseOptionalWeight(input.weightStr);
      const set: LogSet = { reps, series };
      if (weight != null && weight > 0) set.weight = weight;
      return { set };
    }
    case "farmer_carry": {
      const duration_sec = parseDurationFields(input.durMinStr, input.durSecStr);
      const weight = parseRequiredWeight(input.weightStr);
      if (!duration_sec) return { set: null, error: "Podaj czas (min + sek)." };
      if (weight === null) return { set: null, error: "Podaj ciężar [kg]." };
      return { set: { duration_sec, weight, series } };
    }
    case "isometric": {
      const duration_sec = parseDurationFields(input.durMinStr, input.durSecStr);
      if (!duration_sec) return { set: null, error: "Podaj czas trzymania." };
      const weight = parseOptionalWeight(input.weightStr);
      const set: LogSet = { duration_sec, series };
      if (weight != null && weight > 0) set.weight = weight;
      return { set };
    }
    case "negative": {
      const reps = Number.parseInt(input.repStr.trim(), 10);
      const neg = Number.parseInt(input.negSecStr.trim(), 10);
      if (!Number.isFinite(reps) || reps < 1) {
        return { set: null, error: "Podaj powtórzenia." };
      }
      if (!Number.isFinite(neg) || neg < 1) {
        return { set: null, error: "Podaj czas opuszczania [s]." };
      }
      const weight = parseOptionalWeight(input.weightStr);
      const set: LogSet = { reps, series, negative_duration_sec: neg };
      if (weight != null && weight > 0) set.weight = weight;
      return { set };
    }
    default:
      return { set: null, error: "Nieobsługiwany profil." };
  }
}

export function formatSetLabelForProfile(
  s: LogSet,
  profile: MeasurementProfile
): string {
  if (s.distance_km != null && s.duration_sec != null) {
    const pace = s.pace_min_per_km ?? s.duration_sec / 60 / s.distance_km;
    const minP = Math.floor(pace);
    const secP = Math.round((pace - minP) * 60);
    return `${s.distance_km.toFixed(2)} km · ${minP}:${String(secP).padStart(2, "0")} min/km`;
  }
  if (s.steps != null) return `${s.steps} kroków · ${s.kcal_burned ?? 0} kcal`;
  if (s.kcal_burned != null && profile === "running") {
    return `${s.kcal_burned} kcal`;
  }

  const se = s.series ?? 1;

  switch (profile) {
    case "farmer_carry": {
      const dur = s.duration_sec != null ? formatDurationSec(s.duration_sec) : "?";
      const w = s.weight != null ? `${s.weight} kg` : "? kg";
      return `${se}× ${dur} / ${w}`;
    }
    case "isometric": {
      const dur = s.duration_sec != null ? formatDurationSec(s.duration_sec) : "?";
      const w =
        s.weight != null && s.weight > 0 ? ` + ${s.weight} kg` : "";
      return `${se}× ${dur}${w}`;
    }
    case "bodyweight": {
      const r = s.reps ?? 0;
      const w =
        s.weight != null && s.weight > 0 ? ` / ${s.weight} kg` : "";
      return `${se}×${r} powt.${w}`;
    }
    case "negative": {
      const r = s.reps ?? 0;
      const w =
        s.weight != null && s.weight > 0 ? ` / ${s.weight} kg` : "";
      const neg =
        s.negative_duration_sec != null ? ` · opuszczanie ${s.negative_duration_sec}s` : "";
      return `${se}×${r} powt.${w}${neg}`;
    }
    case "strength_standard":
    default: {
      const r = s.reps ?? 0;
      const w = s.weight ?? 0;
      if (!w) return `${se}×${r} powt.`;
      return `${se}×${r} / ${w} kg`;
    }
  }
}

export type ChartUnit = "kg" | "reps" | "sec" | "km";

export function chartUnitForProfile(profile: MeasurementProfile): ChartUnit {
  switch (profile) {
    case "running":
      return "km";
    case "isometric":
    case "farmer_carry":
      return "sec";
    case "bodyweight":
    case "negative":
      return "reps";
    default:
      return "kg";
  }
}

export function chartLabelForProfile(profile: MeasurementProfile): string {
  switch (profile) {
    case "running":
      return "Progres — max dystans (km)";
    case "isometric":
    case "farmer_carry":
      return "Progres — max czas (s)";
    case "bodyweight":
    case "negative":
      return "Progres — max powtórzeń (w serii)";
    default:
      return "Progres — max ciężaru (kg)";
  }
}

export function maxChartValueForSets(
  sets: LogSet[],
  profile: MeasurementProfile
): number {
  let m = 0;
  for (const s of sets) {
    let v = 0;
    switch (profile) {
      case "running":
        v = s.distance_km ?? 0;
        break;
      case "isometric":
      case "farmer_carry":
        v = s.duration_sec ?? 0;
        break;
      case "bodyweight":
      case "negative":
        v = s.reps ?? 0;
        break;
      default:
        v = s.weight ?? 0;
    }
    m = Math.max(m, v);
  }
  return m;
}

/** Profil wpisu na podstawie kształtu danych (wpisy historyczne bez kolumny profile) */
export function inferProfileFromSet(s: LogSet): MeasurementProfile | null {
  if (s.distance_km != null && s.duration_sec != null) return "running";
  if (s.negative_duration_sec != null) return "negative";
  if (s.duration_sec != null && s.reps == null) {
    if (s.weight != null && s.weight > 0) return "farmer_carry";
    return "isometric";
  }
  if (s.steps != null) return null;
  if ((s.weight == null || s.weight === 0) && s.reps != null) return "bodyweight";
  if (s.weight != null && s.reps != null) return "strength_standard";
  return null;
}
