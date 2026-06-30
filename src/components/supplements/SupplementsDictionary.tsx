"use client";

import { useMemo, useState } from "react";
import {
  RULE_CONDITION_LABELS,
  SUPPLEMENT_RULE_CONDITIONS,
  type SupplementBundle,
  type SupplementRuleCondition,
} from "@/lib/supplement-types";
import { rulePreviewLabel } from "@/lib/supplement-schedule";
import { createClient } from "@/lib/supabase";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";

const inputCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60";

type Props = {
  bundle: SupplementBundle;
  onChanged: () => void;
};

export default function SupplementsDictionary({ bundle, onChanged }: Props) {
  const [timingName, setTimingName] = useState("");
  const [supplementName, setSupplementName] = useState("");
  const [expandedSupplementId, setExpandedSupplementId] = useState<string | null>(
    null
  );
  const [newRuleCondition, setNewRuleCondition] =
    useState<SupplementRuleCondition>("always");
  const [selectedTimingIds, setSelectedTimingIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const activeTimings = useMemo(
    () =>
      [...bundle.timings]
        .filter((t) => t.active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [bundle.timings]
  );

  const activeSupplements = useMemo(
    () =>
      [...bundle.supplements]
        .filter((s) => s.active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [bundle.supplements]
  );

  const inactiveTimings = bundle.timings.filter((t) => !t.active);
  const inactiveSupplements = bundle.supplements.filter((s) => !s.active);

  async function addTiming(e: React.FormEvent) {
    e.preventDefault();
    const name = timingName.trim();
    if (!name) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const sort_order =
      bundle.timings.length > 0
        ? Math.max(...bundle.timings.map((t) => t.sort_order)) + 1
        : 0;
    const { error } = await supabase.from("supplement_timings").insert({
      user_id: user.id,
      name,
      sort_order,
    });
    if (error) console.error("[SupplementsDictionary] timing:", error.message);
    else {
      setTimingName("");
      onChanged();
    }
    setBusy(false);
  }

  async function addSupplement(e: React.FormEvent) {
    e.preventDefault();
    const name = supplementName.trim();
    if (!name) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const sort_order =
      bundle.supplements.length > 0
        ? Math.max(...bundle.supplements.map((s) => s.sort_order)) + 1
        : 0;
    const { error } = await supabase.from("supplements").insert({
      user_id: user.id,
      name,
      sort_order,
    });
    if (error) console.error("[SupplementsDictionary] supplement:", error.message);
    else {
      setSupplementName("");
      onChanged();
    }
    setBusy(false);
  }

  async function toggleTimingActive(id: string, active: boolean) {
    const supabase = createClient();
    await supabase
      .from("supplement_timings")
      .update({ active: !active, updated_at: new Date().toISOString() })
      .eq("id", id);
    onChanged();
  }

  async function toggleSupplementActive(id: string, active: boolean) {
    const supabase = createClient();
    await supabase
      .from("supplements")
      .update({ active: !active, updated_at: new Date().toISOString() })
      .eq("id", id);
    onChanged();
  }

  async function moveTiming(id: string, direction: -1 | 1) {
    const sorted = [...bundle.timings].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((t) => t.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const supabase = createClient();
    await Promise.all([
      supabase
        .from("supplement_timings")
        .update({ sort_order: sorted[swapIdx].sort_order })
        .eq("id", sorted[idx].id),
      supabase
        .from("supplement_timings")
        .update({ sort_order: sorted[idx].sort_order })
        .eq("id", sorted[swapIdx].id),
    ]);
    onChanged();
  }

  async function saveRule(supplementId: string) {
    if (selectedTimingIds.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }

    const existing = bundle.rules.find(
      (r) => r.supplement_id === supplementId && r.condition === newRuleCondition
    );

    let ruleId = existing?.id;
    if (!ruleId) {
      const { data: inserted, error } = await supabase
        .from("supplement_rules")
        .insert({
          user_id: user.id,
          supplement_id: supplementId,
          condition: newRuleCondition,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        console.error("[SupplementsDictionary] rule:", error?.message);
        setBusy(false);
        return;
      }
      ruleId = inserted.id as string;
    } else {
      await supabase
        .from("supplement_rule_doses")
        .delete()
        .eq("rule_id", ruleId);
    }

    const rows = selectedTimingIds.map((timing_id, i) => ({
      rule_id: ruleId!,
      user_id: user.id,
      timing_id,
      sort_order: i,
    }));
    const { error: de } = await supabase.from("supplement_rule_doses").insert(rows);
    if (de) console.error("[SupplementsDictionary] doses:", de.message);
    else {
      setSelectedTimingIds([]);
      onChanged();
    }
    setBusy(false);
  }

  async function deleteRule(ruleId: string) {
    const supabase = createClient();
    await supabase.from("supplement_rules").delete().eq("id", ruleId);
    onChanged();
  }

  function openRuleEditor(supplementId: string, condition: SupplementRuleCondition) {
    setExpandedSupplementId(supplementId);
    setNewRuleCondition(condition);
    const rule = bundle.rules.find(
      (r) => r.supplement_id === supplementId && r.condition === condition
    );
    if (rule) {
      const ids = bundle.doses
        .filter((d) => d.rule_id === rule.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => d.timing_id);
      setSelectedTimingIds(ids);
    } else {
      setSelectedTimingIds([]);
    }
  }

  function toggleTimingSelection(timingId: string) {
    setSelectedTimingIds((prev) =>
      prev.includes(timingId)
        ? prev.filter((id) => id !== timingId)
        : [...prev, timingId]
    );
  }

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Pory dnia
        </p>
        <form onSubmit={(e) => void addTiming(e)} className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="Np. 30 min przed obiadem"
            value={timingName}
            onChange={(e) => setTimingName(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-xl bg-[#EF9F27] px-4 text-sm font-bold text-black disabled:opacity-50"
          >
            Dodaj
          </button>
        </form>
        <ul className="mt-3 space-y-2">
          {activeTimings.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-2 border-t border-[#2A2A2A] pt-2 first:border-0 first:pt-0"
            >
              <span className="min-w-0 flex-1 text-sm text-white">{t.name}</span>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => void moveTiming(t.id, -1)}
                className="text-xs text-white/45 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === activeTimings.length - 1}
                onClick={() => void moveTiming(t.id, 1)}
                className="text-xs text-white/45 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => void toggleTimingActive(t.id, t.active)}
                className="text-[11px] text-red-400/80"
              >
                Wyłącz
              </button>
            </li>
          ))}
        </ul>
        {inactiveTimings.length > 0 ? (
          <div className="mt-3 border-t border-[#2A2A2A] pt-3">
            <p className="text-[10px] uppercase text-white/35">Wyłączone</p>
            {inactiveTimings.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void toggleTimingActive(t.id, t.active)}
                className="mt-1 block text-xs text-white/50"
              >
                + {t.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={cardCls}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Suplementy
        </p>
        <form onSubmit={(e) => void addSupplement(e)} className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="Np. Kreatyna"
            value={supplementName}
            onChange={(e) => setSupplementName(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-xl bg-[#EF9F27] px-4 text-sm font-bold text-black disabled:opacity-50"
          >
            Dodaj
          </button>
        </form>
        <ul className="mt-3 space-y-2">
          {activeSupplements.map((s) => {
            const supRules = bundle.rules.filter((r) => r.supplement_id === s.id);
            const preview = SUPPLEMENT_RULE_CONDITIONS.map((c) =>
              rulePreviewLabel(supRules, bundle.doses, c)
            )
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={s.id}
                className="border-t border-[#2A2A2A] pt-2 first:border-0 first:pt-0"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{s.name}</p>
                    {preview ? (
                      <p className="text-[11px] text-white/45">{preview}</p>
                    ) : (
                      <p className="text-[11px] text-white/30">Brak harmonogramu</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedSupplementId === s.id) {
                        setExpandedSupplementId(null);
                      } else {
                        openRuleEditor(s.id, "always");
                        setExpandedSupplementId(s.id);
                      }
                    }}
                    className="text-[11px] text-[#EF9F27]"
                  >
                    Harmonogram
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleSupplementActive(s.id, s.active)}
                    className="text-[11px] text-red-400/80"
                  >
                    Wyłącz
                  </button>
                </div>

                {expandedSupplementId === s.id ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-[#333] bg-[#151515] p-3">
                    <div className="flex flex-wrap gap-2">
                      {SUPPLEMENT_RULE_CONDITIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => openRuleEditor(s.id, c)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                            newRuleCondition === c && expandedSupplementId === s.id
                              ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                              : "border-[#444] text-white/65"
                          }`}
                        >
                          {RULE_CONDITION_LABELS[c]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/45">
                      Wybierz pory (= liczba dawek):
                    </p>
                    <div className="space-y-1">
                      {activeTimings.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 text-sm text-white/85"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTimingIds.includes(t.id)}
                            onChange={() => toggleTimingSelection(t.id)}
                            className="size-4 accent-[#EF9F27]"
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || selectedTimingIds.length === 0}
                        onClick={() => void saveRule(s.id)}
                        className="flex-1 rounded-xl bg-[#EF9F27] py-2 text-sm font-bold text-black disabled:opacity-50"
                      >
                        Zapisz regułę
                      </button>
                      {bundle.rules.some(
                        (r) =>
                          r.supplement_id === s.id && r.condition === newRuleCondition
                      ) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const rule = bundle.rules.find(
                              (r) =>
                                r.supplement_id === s.id &&
                                r.condition === newRuleCondition
                            );
                            if (rule) void deleteRule(rule.id);
                          }}
                          className="rounded-xl border border-red-500/40 px-3 text-[12px] text-red-400"
                        >
                          Usuń
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {inactiveSupplements.length > 0 ? (
          <div className="mt-3 border-t border-[#2A2A2A] pt-3">
            <p className="text-[10px] uppercase text-white/35">Wyłączone</p>
            {inactiveSupplements.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void toggleSupplementActive(s.id, s.active)}
                className="mt-1 block text-xs text-white/50"
              >
                + {s.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
