"use client";

import { useMemo, useState } from "react";

export type RunEntryValues = {
  distanceKm: number;
  durationMin: number;
  durationSec: number;
  kcalBurned: number;
  paceMinPerKm: number;
};

function parseDuration(minStr: string, secStr: string): number | null {
  const min = Number.parseInt(minStr.trim(), 10);
  const sec = Number.parseInt(secStr.trim(), 10);
  if (!Number.isFinite(min) || min < 0) return null;
  if (!Number.isFinite(sec) || sec < 0 || sec >= 60) return null;
  const total = min * 60 + sec;
  return total > 0 ? total : null;
}

export function computePaceMinPerKm(
  distanceKm: number,
  durationSec: number
): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return durationSec / 60 / distanceKm;
}

export default function RunEntryForm({
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  onSubmit: (values: RunEntryValues) => void | Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  const [distanceStr, setDistanceStr] = useState("");
  const [minStr, setMinStr] = useState("");
  const [secStr, setSecStr] = useState("");
  const [kcalStr, setKcalStr] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const distanceKm = Number.parseFloat(distanceStr.replace(",", "."));
    const durationSec = parseDuration(minStr, secStr);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !durationSec) {
      return null;
    }
    const pace = computePaceMinPerKm(distanceKm, durationSec);
    if (pace === null) return null;
    const minP = Math.floor(pace);
    const secP = Math.round((pace - minP) * 60);
    return {
      distanceKm,
      durationSec,
      paceLabel: `${minP}:${String(secP).padStart(2, "0")} min/km`,
    };
  }, [distanceStr, minStr, secStr]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const distanceKm = Number.parseFloat(distanceStr.replace(",", "."));
    const durationTotalSec = parseDuration(minStr, secStr);
    const kcalRaw = Number.parseInt(kcalStr.trim(), 10);

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      setLocalError("Podaj dystans w km.");
      return;
    }
    if (!durationTotalSec) {
      setLocalError("Podaj czas (min i sek, sek < 60).");
      return;
    }
    if (!Number.isFinite(kcalRaw) || kcalRaw <= 0) {
      setLocalError("Podaj spalone kcal.");
      return;
    }

    const paceMinPerKm = computePaceMinPerKm(distanceKm, durationTotalSec);
    if (paceMinPerKm === null) {
      setLocalError("Nie udało się obliczyć tempa.");
      return;
    }

    void onSubmit({
      distanceKm,
      durationMin: Math.floor(durationTotalSec / 60),
      durationSec: durationTotalSec % 60,
      kcalBurned: kcalRaw,
      paceMinPerKm,
    });
  }

  const err = error ?? localError;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-[#333] bg-[#151515] p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-white/55">
        Bieganie
      </p>
      <label className="block text-[11px] text-white/50">
        Dystans (km)
        <input
          type="text"
          inputMode="decimal"
          value={distanceStr}
          onChange={(e) => setDistanceStr(e.target.value)}
          placeholder="np. 5.2"
          className="mt-1 w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-white/50">
          Czas — min
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minStr}
            onChange={(e) => setMinStr(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60"
          />
        </label>
        <label className="block text-[11px] text-white/50">
          Czas — sek
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={secStr}
            onChange={(e) => setSecStr(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60"
          />
        </label>
      </div>
      {preview ? (
        <p className="text-xs text-[#BA7517]">Tempo: {preview.paceLabel}</p>
      ) : null}
      <label className="block text-[11px] text-white/50">
        Spalone kcal
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={kcalStr}
          onChange={(e) => setKcalStr(e.target.value)}
          placeholder="kcal"
          className="mt-1 w-full rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60"
        />
      </label>
      {err ? <p className="text-xs text-red-400">{err}</p> : null}
      <div className="flex gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-white/20 py-2.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            Anuluj
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl border border-[#EF9F27]/55 bg-[#EF9F27]/15 py-2.5 text-xs font-semibold text-[#EF9F27] disabled:opacity-45"
        >
          {saving ? "Zapisuję…" : "Zapisz bieg"}
        </button>
      </div>
    </form>
  );
}
