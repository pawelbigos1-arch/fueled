"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_GOAL_LS,
  readGoal,
  writeGoal,
  type GoalStorage,
} from "@/lib/fueled-storage";

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
  const init = (): GoalStorage => readGoal() ?? DEFAULT_GOAL_LS;
  const [form, setForm] = useState<GoalStorage>(init);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    try {
      setForm(readGoal() ?? DEFAULT_GOAL_LS);
    } catch {}
  }, []);

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    writeGoal(form);
    setToast(true);
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

      <form onSubmit={submit} className="space-y-4">
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
    </div>
  );
}
