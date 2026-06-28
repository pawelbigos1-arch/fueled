"use client";

import { useEffect, useState } from "react";
import type { LogSet } from "@/lib/fueled-storage";
import {
  buildSetFromProfile,
  formatSetLabelForProfile,
  profileHint,
  type MeasurementProfile,
  type ProfileFormInput,
} from "@/lib/measurement-profiles";

const fieldCls =
  "mt-1 w-full rounded-[10px] border border-[#333] bg-[#121212] py-3 text-center text-[18px] font-semibold outline-none focus:border-[#EF9F27]/35";

const labelCls = "text-[10px] uppercase tracking-wide text-white/45";

export default function ExerciseEntryForm({
  profile,
  chips,
  onAddSet,
  onSave,
  formError,
  setFormError,
}: {
  profile: MeasurementProfile;
  chips: string[];
  onAddSet: (set: LogSet, label: string) => void;
  onSave: () => void;
  formError: string | null;
  setFormError: (msg: string | null) => void;
}) {
  const [weightStr, setWeightStr] = useState("");
  const [repStr, setRepStr] = useState("");
  const [serieStr, setSerieStr] = useState("1");
  const [durMinStr, setDurMinStr] = useState("");
  const [durSecStr, setDurSecStr] = useState("");
  const [negSecStr, setNegSecStr] = useState("");

  useEffect(() => {
    setWeightStr("");
    setRepStr("");
    setSerieStr("1");
    setDurMinStr("");
    setDurSecStr("");
    setNegSecStr("");
    setFormError(null);
  }, [profile, setFormError]);

  function currentInput(): ProfileFormInput {
    return {
      weightStr,
      repStr,
      serieStr,
      durMinStr,
      durSecStr,
      negSecStr,
    };
  }

  function handleAddChip() {
    const { set, error } = buildSetFromProfile(profile, currentInput());
    if (error || !set) {
      setFormError(error ?? "Nie udało się dodać serii.");
      return;
    }
    setFormError(null);
    onAddSet(set, formatSetLabelForProfile(set, profile));
  }

  const hint = profileHint(profile);
  const showWeight = profile === "strength_standard" || profile === "farmer_carry";
  const showOptionalWeight =
    profile === "bodyweight" || profile === "isometric" || profile === "negative";
  const showReps =
    profile === "strength_standard" ||
    profile === "bodyweight" ||
    profile === "negative";
  const showDuration = profile === "farmer_carry" || profile === "isometric";
  const showNegSec = profile === "negative";

  const gridCols =
    profile === "strength_standard"
      ? "grid-cols-3"
      : profile === "farmer_carry"
        ? "grid-cols-2 sm:grid-cols-4"
        : profile === "isometric"
          ? "grid-cols-2 sm:grid-cols-3"
          : profile === "negative"
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="space-y-3">
      {hint ? (
        <p className="text-[11px] leading-snug text-white/48">{hint}</p>
      ) : null}

      <div className={`grid gap-2 ${gridCols}`}>
        {showWeight ? (
          <label className="block">
            <span className={labelCls}>Ciężar [kg]</span>
            <input
              value={weightStr}
              inputMode="decimal"
              onChange={(e) => setWeightStr(e.target.value)}
              placeholder="kg"
              className={fieldCls}
            />
          </label>
        ) : null}

        {showOptionalWeight ? (
          <label className="block">
            <span className={labelCls}>Dod. kg (opc.)</span>
            <input
              value={weightStr}
              inputMode="decimal"
              onChange={(e) => setWeightStr(e.target.value)}
              placeholder="—"
              className={fieldCls}
            />
          </label>
        ) : null}

        {showDuration ? (
          <>
            <label className="block">
              <span className={labelCls}>Czas — min</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={durMinStr}
                onChange={(e) => setDurMinStr(e.target.value)}
                placeholder="0"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Czas — sek</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={durSecStr}
                onChange={(e) => setDurSecStr(e.target.value)}
                placeholder="0"
                className={fieldCls}
              />
            </label>
          </>
        ) : null}

        {showReps ? (
          <label className="block">
            <span className={labelCls}>Powt.</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={repStr}
              onChange={(e) => setRepStr(e.target.value)}
              className={fieldCls}
            />
          </label>
        ) : null}

        {showNegSec ? (
          <label className="block">
            <span className={labelCls}>Opuszcz. [s]</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={negSecStr}
              onChange={(e) => setNegSecStr(e.target.value)}
              placeholder="s"
              className={fieldCls}
            />
          </label>
        ) : null}

        <label className="block">
          <span className={labelCls}>Serie</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={serieStr}
            onChange={(e) => setSerieStr(e.target.value)}
            className={fieldCls}
          />
        </label>
      </div>

      {formError ? <p className="text-xs text-red-400">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="rounded-full border border-[#333] bg-[#121212] px-3 py-1 text-xs font-medium text-[#EF9F27]"
          >
            {c}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddChip}
        className="touch-manipulation min-h-[52px] w-full rounded-[12px] border border-[#444] bg-[#1a1a1a] py-3 text-[15px] font-semibold text-white/92 active:opacity-90 hover:border-[#EF9F27]/35"
      >
        + Dodaj serię
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={chips.length === 0}
        className="touch-manipulation min-h-[52px] w-full rounded-[12px] border border-[#EF9F27]/55 bg-[#EF9F27]/20 py-3 text-[15px] font-bold text-[#fff2e8] active:opacity-90 hover:bg-[#EF9F27]/30 disabled:opacity-45"
      >
        Zapisz ćwiczenie
      </button>
    </div>
  );
}
