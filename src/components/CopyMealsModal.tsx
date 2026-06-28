"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  addDays,
  addDaysToKey,
  formatDateKey,
  parseDateKey,
} from "@/lib/fueled-storage";

type SourceMeal = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export default function CopyMealsModal({
  targetDay,
  onClose,
  onCopied,
}: {
  targetDay: string;
  onClose: () => void;
  onCopied: () => void;
}) {
  const [sourceDay, setSourceDay] = useState(() =>
    addDaysToKey(targetDay, -1)
  );
  const [meals, setMeals] = useState<SourceMeal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSourceMeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMeals([]);
        return;
      }

      const { data, error: qErr } = await supabase
        .from("meals")
        .select("id,name,kcal,protein,carbs,fat")
        .eq("user_id", user.id)
        .eq("date", sourceDay)
        .order("created_at", { ascending: true });

      if (qErr) {
        setError(qErr.message);
        setMeals([]);
        return;
      }

      const rows = (data ?? []) as SourceMeal[];
      setMeals(rows);
      setSelected(new Set(rows.map((m) => m.id)));
    } finally {
      setLoading(false);
    }
  }, [sourceDay]);

  useEffect(() => {
    void loadSourceMeals();
  }, [loadSourceMeals]);

  const sourceLabel = useMemo(() => {
    try {
      return parseDateKey(sourceDay).toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return sourceDay;
    }
  }, [sourceDay]);

  const targetLabel = useMemo(() => {
    try {
      return parseDateKey(targetDay).toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return targetDay;
    }
  }, [targetDay]);

  function shiftSource(delta: number) {
    setSourceDay(formatDateKey(addDays(parseDateKey(sourceDay), delta)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopy() {
    const picked = meals.filter((m) => selected.has(m.id));
    if (picked.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const rows = picked.map((m) => ({
        user_id: user.id,
        date: targetDay,
        name: m.name,
        kcal: m.kcal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
      }));

      const { error: insErr } = await supabase.from("meals").insert(rows);
      if (insErr) {
        setError(insErr.message);
        return;
      }

      onCopied();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-meals-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#333] bg-[#151515] p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="copy-meals-title" className="text-base font-semibold text-white">
              Kopiuj posiłki
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Do: {targetLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-white/50 hover:text-white"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftSource(-1)}
            className="rounded-lg border border-[#333] px-3 py-1.5 text-sm hover:bg-white/5"
          >
            ‹
          </button>
          <p className="text-center text-xs capitalize text-white/70">{sourceLabel}</p>
          <button
            type="button"
            onClick={() => shiftSource(1)}
            className="rounded-lg border border-[#333] px-3 py-1.5 text-sm hover:bg-white/5"
          >
            ›
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-white/45">Ładowanie…</p>
        ) : meals.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/45">
            Brak posiłków w tym dniu.
          </p>
        ) : (
          <ul className="space-y-2">
            {meals.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4 accent-[#EF9F27]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{m.name}</span>
                    <span className="text-[11px] text-white/45">
                      {m.kcal} kcal · B {m.protein} · W {m.carbs} · T {m.fat}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/80 hover:bg-white/5"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={() => void handleCopy()}
            className="flex-1 rounded-xl border border-[#EF9F27]/55 bg-[#EF9F27]/15 py-2.5 text-sm font-semibold text-[#EF9F27] disabled:opacity-45"
          >
            {saving ? "Kopiuję…" : `Kopiuj (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
