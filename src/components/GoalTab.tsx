"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { GoalStorage } from "@/lib/fueled-storage";
import { DEFAULT_GOAL_LS } from "@/lib/fueled-storage";

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3 text-lg text-white outline-none focus:border-[#3B6D11]"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
          {suffix}
        </span>
      </div>
    </label>
  );
}

export default function GoalTab() {
  const [form, setForm] = useState<GoalStorage>(DEFAULT_GOAL_LS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setForm(DEFAULT_GOAL_LS);
        return;
      }
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[GoalTab] goals:", error.message);
      }

      const row = (data ?? null) as Record<string, unknown> | null;
      if (!row || typeof row.kcal !== "number") {
        setForm(DEFAULT_GOAL_LS);
      } else {
        setForm({
          calories: Math.round(Number(row.kcal)),
          protein: Math.round(Number(row.protein ?? 0)),
          carbs: Math.round(Number(row.carbs ?? 0)),
          fats: Math.round(Number(row.fat ?? 0)),
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(false), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  function patch<K extends keyof GoalStorage>(key: K, raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setForm((f) => ({ ...f, [key]: 0 }));
      return;
    }
    setForm((f) => ({ ...f, [key]: Math.max(0, Math.round(n)) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    const { error } = await supabase.from("goals").upsert(
      {
        user_id: user.id,
        kcal: form.calories,
        protein: form.protein,
        carbs: form.carbs,
        fat: form.fats,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[GoalTab] upsert:", error.message);
      return;
    }

    setToast(true);
    void hydrate();
  }

  return (
    <div className="relative flex flex-col gap-5 pb-24 text-white">
      {toast ? (
        <div className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+16px))] left-1/2 z-[100] flex -translate-x-1/2 items-center rounded-full bg-[#3B6D11] px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ Zapisano
        </div>
      ) : null}

      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/85">
        Cel dzienny
      </h2>

      {loading ? (
        <p className="text-center text-xs text-white/45">Ładowanie...</p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <Field
            label="Kalorie"
            suffix="kcal"
            value={String(form.calories)}
            onChange={(raw) => patch("calories", raw)}
          />
          <Field
            label="Białko"
            suffix="g"
            value={String(form.protein)}
            onChange={(raw) => patch("protein", raw)}
          />
          <Field
            label="Węglowodany"
            suffix="g"
            value={String(form.carbs)}
            onChange={(raw) => patch("carbs", raw)}
          />
          <Field
            label="Tłuszcze"
            suffix="g"
            value={String(form.fats)}
            onChange={(raw) => patch("fats", raw)}
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[#3B6D11] py-3 text-sm font-bold text-white hover:brightness-110 active:brightness-95"
          >
            Zapisz cel
          </button>
        </form>
      )}
    </div>
  );
}
