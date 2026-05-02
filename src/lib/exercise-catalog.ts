export type ExerciseCategory =
  | "Klatka"
  | "Plecy"
  | "Barki"
  | "Nogi"
  | "Biceps"
  | "Triceps"
  | "Brzuch"
  | "Cardio";

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  "Klatka",
  "Plecy",
  "Barki",
  "Nogi",
  "Biceps",
  "Triceps",
  "Brzuch",
  "Cardio",
];

/** Domyślnie ciężar (np. ławka); `reps` — np. podciąganie: progres po powtórzeniach, bez wymogu kg */
export type ExerciseProgressBy = "weight" | "reps";

export type DictExercise = {
  name: string;
  visible: boolean;
  progressBy?: ExerciseProgressBy;
};

export type DictStore = Partial<Record<ExerciseCategory, DictExercise[]>>;

export const DEFAULT_EXERCISES: Record<ExerciseCategory, string[]> = {
  Klatka: [
    "Wyciskanie sztangi",
    "Wyciskanie hantli",
    "Wyciskanie na skosie",
    "Rozpiętki hantlami",
    "Rozpiętki na wyciągu",
    "Pompki",
    "Dipy (klatka)",
  ],
  Plecy: [
    "Martwy ciąg",
    "Podciąganie",
    "Wiosłowanie sztangą",
    "Wiosłowanie hantlem",
    "Wiosłowanie wyciąg",
    "Ściąganie drążka",
    "Hiperekstensja",
  ],
  Barki: [
    "Wyciskanie żołnierskie",
    "Wyciskanie hantli siedząc",
    "Unoszenie bokiem",
    "Unoszenie przodem",
    "Wznosy ramion",
    "Odwrotne rozpiętki",
  ],
  Nogi: [
    "Przysiad ze sztangą",
    "Leg press",
    "Prostowanie nóg",
    "Zginanie nóg leżąc",
    "Wykroki",
    "Rum. martwy ciąg",
    "Wspięcia na palce",
  ],
  Biceps: [
    "Uginanie ze sztangą",
    "Uginanie z hantlami",
    "Modliszka",
    "Uginanie młotkowe",
    "Uginanie na wyciągu",
  ],
  Triceps: [
    "Wyciskanie wąskim",
    "Prostowanie z hantlem",
    "Dipy (triceps)",
    "Prostowanie wyciąg",
    "French press",
  ],
  Brzuch: [
    "Plank",
    "Spięcia brzucha",
    "Nożyce",
    "Rollout (kółko)",
    "Deska boczna",
    "Unoszenie nóg",
  ],
  Cardio: [
    "Bieganie",
    "Rower stacjonarny",
    "Orbitrek",
    "Skakanka",
    "Ergometr",
    "Pływanie",
  ],
};

export function mergeDictWithDefaults(stored: DictStore | null): DictStore {
  const out: DictStore = {};

  for (const cat of EXERCISE_CATEGORIES) {
    const defaults = DEFAULT_EXERCISES[cat].map((name) => ({
      name,
      visible: true,
    }));

    const fromStored = stored?.[cat];

    const byName = new Map<string, DictExercise>();
    defaults.forEach((d) => byName.set(d.name, { ...d }));

    function mergeItem(item: DictExercise): DictExercise {
      const out: DictExercise = {
        name: item.name,
        visible: item.visible !== false,
      };
      if (item.progressBy === "reps") out.progressBy = "reps";
      return out;
    }

    fromStored?.forEach((item) => {
      if (!item?.name) return;
      byName.set(item.name, mergeItem(item));
    });

    const extraFromStored =
      fromStored?.filter(
        (e) => !DEFAULT_EXERCISES[cat].includes(e.name)
      ) ?? [];
    extraFromStored.forEach((item) => byName.set(item.name, mergeItem(item)));

    out[cat] = Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    );
  }

  return out;
}
