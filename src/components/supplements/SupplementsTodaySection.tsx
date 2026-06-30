"use client";

import SupplementsDayChecklist from "@/components/supplements/SupplementsDayChecklist";
import { useSupplementsData } from "@/hooks/useSupplementsData";
import { hasConfiguredSupplements } from "@/lib/supplement-schedule";

type Props = {
  dateKey: string;
};

export default function SupplementsTodaySection({ dateKey }: Props) {
  const { bundle, strengthDates, loading, reload } = useSupplementsData(
    dateKey,
    dateKey
  );

  if (loading) return null;
  if (!hasConfiguredSupplements(bundle)) return null;

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/80">
        Suplementy
      </h2>
      <SupplementsDayChecklist
        dateKey={dateKey}
        bundle={bundle}
        strengthDates={strengthDates}
        showTrainingToggle={false}
        onChanged={() => void reload()}
      />
    </section>
  );
}
