"use client";

import { useEffect, useMemo, useState } from "react";
import { weekDayKeys } from "@/components/reflection/DayReflectionView";
import SupplementsDayChecklist from "@/components/supplements/SupplementsDayChecklist";
import { useSupplementsData } from "@/hooks/useSupplementsData";
import { getTodayKey } from "@/lib/fueled-storage";
import {
  buildIntakeSet,
  buildTrainingPlanMap,
  dayProgress,
  hasConfiguredSupplements,
  resolveExpectedDoses,
  weekSupplementProgress,
} from "@/lib/supplement-schedule";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

const pill =
  "touch-manipulation min-h-[44px] flex-1 rounded-full border px-2 py-2 text-[11px] font-medium leading-tight transition active:opacity-90";

type Props = {
  weekStart: string;
};

export default function SupplementsWeekPanel({ weekStart }: Props) {
  const todayKey = getTodayKey();
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart]);
  const rangeStart = dayKeys[0];
  const rangeEnd = dayKeys[6];

  const { bundle, strengthDates, loading, reload } = useSupplementsData(
    rangeStart,
    rangeEnd
  );

  const defaultDay =
    dayKeys.includes(todayKey) ? todayKey : dayKeys[0];
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  useEffect(() => {
    setSelectedDay(dayKeys.includes(todayKey) ? todayKey : dayKeys[0]);
  }, [weekStart, dayKeys, todayKey]);

  const trainingPlans = useMemo(
    () => buildTrainingPlanMap(bundle.trainingPlans),
    [bundle.trainingPlans]
  );

  const weekProgress = useMemo(
    () => weekSupplementProgress(bundle, dayKeys, trainingPlans, bundle.intakes),
    [bundle, dayKeys, trainingPlans]
  );

  const dayShortLabels = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

  if (loading) {
    return <p className="text-center text-xs text-white/45">Ładowanie…</p>;
  }

  if (!hasConfiguredSupplements(bundle)) {
    return (
      <div className={cardCls}>
        <p className="text-sm text-white/50">
          Dodaj suplementy i harmonogram w Słowniku, aby śledzić dawki.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Podsumowanie tygodnia
        </p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-white">
          {weekProgress.taken}/{weekProgress.expected} dawek
        </p>
      </div>

      <div className="flex gap-1.5">
        {dayKeys.map((dk, i) => {
          const doses = resolveExpectedDoses(bundle, dk, trainingPlans);
          const takenSet = buildIntakeSet(bundle.intakes, dk);
          const p = dayProgress(doses, takenSet);
          const isToday = dk === todayKey;
          const isSelected = dk === selectedDay;
          return (
            <button
              key={dk}
              type="button"
              onClick={() => setSelectedDay(dk)}
              className={`${pill} flex flex-col items-center justify-center ${
                isSelected
                  ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                  : "border-[#333] text-white/70"
              } ${isToday ? "ring-1 ring-[#EF9F27]/40" : ""}`}
            >
              <span>{dayShortLabels[i]}</span>
              <span className="tabular-nums text-[10px] opacity-80">
                {p.taken}/{p.expected}
              </span>
            </button>
          );
        })}
      </div>

      <SupplementsDayChecklist
        dateKey={selectedDay}
        bundle={bundle}
        strengthDates={strengthDates}
        showTrainingToggle
        onChanged={() => void reload()}
      />
    </div>
  );
}
