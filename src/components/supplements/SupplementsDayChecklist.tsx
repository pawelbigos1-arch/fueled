"use client";

import { useMemo, useState } from "react";
import { parseDateKey } from "@/lib/fueled-storage";
import {
  buildIntakeSet,
  buildTrainingPlanMap,
  dayProgress,
  groupDosesByTiming,
  resolveExpectedDoses,
} from "@/lib/supplement-schedule";
import type { SupplementBundle } from "@/lib/supplement-types";
import { createClient } from "@/lib/supabase";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

type Props = {
  dateKey: string;
  bundle: SupplementBundle;
  strengthDates: Set<string>;
  showTrainingToggle?: boolean;
  onChanged: () => void;
};

export default function SupplementsDayChecklist({
  dateKey,
  bundle,
  strengthDates,
  showTrainingToggle = true,
  onChanged,
}: Props) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [trainingBusy, setTrainingBusy] = useState(false);

  const trainingPlans = useMemo(
    () => buildTrainingPlanMap(bundle.trainingPlans),
    [bundle.trainingPlans]
  );

  const isTraining = trainingPlans.get(dateKey) ?? false;
  const hasStrengthLog = strengthDates.has(dateKey);

  const expected = useMemo(
    () => resolveExpectedDoses(bundle, dateKey, trainingPlans),
    [bundle, dateKey, trainingPlans]
  );

  const takenSet = useMemo(
    () => buildIntakeSet(bundle.intakes, dateKey),
    [bundle.intakes, dateKey]
  );

  const progress = dayProgress(expected, takenSet);
  const groups = groupDosesByTiming(expected);

  const dateLabel = parseDateKey(dateKey).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function toggleTraining() {
    if (!showTrainingToggle) return;
    setTrainingBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTrainingBusy(false);
      return;
    }
    const next = !isTraining;
    const { error } = await supabase.from("training_day_plans").upsert(
      {
        user_id: user.id,
        date: dateKey,
        is_training: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );
    if (error) console.error("[SupplementsDayChecklist] training:", error.message);
    else onChanged();
    setTrainingBusy(false);
  }

  async function toggleDose(
    supplementId: string,
    timingId: string,
    doseIndex: number,
    key: string
  ) {
    if (toggling === key) return;
    setToggling(key);
    const taken = takenSet.has(key);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setToggling(null);
      return;
    }

    if (taken) {
      const { error } = await supabase
        .from("supplement_intakes")
        .delete()
        .eq("user_id", user.id)
        .eq("date", dateKey)
        .eq("supplement_id", supplementId)
        .eq("timing_id", timingId)
        .eq("dose_index", doseIndex);
      if (error) console.error("[SupplementsDayChecklist] delete:", error.message);
    } else {
      const { error } = await supabase.from("supplement_intakes").upsert(
        {
          user_id: user.id,
          date: dateKey,
          supplement_id: supplementId,
          timing_id: timingId,
          dose_index: doseIndex,
          taken: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,date,supplement_id,timing_id,dose_index",
        }
      );
      if (error) console.error("[SupplementsDayChecklist] upsert:", error.message);
    }
    onChanged();
    setToggling(null);
  }

  if (expected.length === 0) {
    return (
      <div className={cardCls}>
        <p className="text-sm text-white/45">
          Brak zaplanowanych dawek na ten dzień. Skonfiguruj suplementy w Słowniku.
        </p>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 capitalize">
            {dateLabel}
          </p>
          <p
            className={`mt-1 text-sm font-semibold tabular-nums ${
              progress.met ? "text-[#7BC44A]" : "text-white/85"
            }`}
          >
            {progress.taken}/{progress.expected} dawek
            {progress.met ? " ✓" : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {showTrainingToggle ? (
            <button
              type="button"
              disabled={trainingBusy}
              onClick={() => void toggleTraining()}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                isTraining
                  ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                  : "border-[#444] text-white/60"
              }`}
            >
              {isTraining ? "Dzień treningowy" : "Dzień odpoczynku"}
            </button>
          ) : (
            <span
              className={`rounded-full border px-3 py-1 text-[11px] ${
                isTraining
                  ? "border-[#EF9F27]/40 text-[#EF9F27]"
                  : "border-[#444] text-white/45"
              }`}
            >
              {isTraining ? "Dzień treningowy" : "Odpoczynek"}
            </span>
          )}
          {hasStrengthLog ? (
            <span className="text-[10px] text-white/40">Siłownia w dzienniku</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.timingId}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#EF9F27]/85">
              {group.timingName}
            </p>
            <ul className="mt-2 space-y-2">
              {group.doses.map((dose) => {
                const done = takenSet.has(dose.key);
                return (
                  <li key={dose.key}>
                    <button
                      type="button"
                      disabled={toggling === dose.key}
                      onClick={() =>
                        void toggleDose(
                          dose.supplementId,
                          dose.timingId,
                          dose.doseIndex,
                          dose.key
                        )
                      }
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-md border text-sm ${
                          done
                            ? "border-[#3B6D11] bg-[#3B6D11] text-white"
                            : "border-[#444] bg-transparent text-white/30"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className="text-sm text-white/90">{dose.supplementName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
