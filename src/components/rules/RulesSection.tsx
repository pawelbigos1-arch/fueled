"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { PersonalRuleRow } from "@/lib/growth-types";

const cardCls =
  "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4 space-y-3";

const inputCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60";

export default function RulesSection() {
  const [rules, setRules] = useState<PersonalRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRules([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("personal_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (error) console.error("[RulesSection] load:", error.message);
    setRules((data ?? []) as PersonalRuleRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const sort_order =
      rules.length > 0 ? Math.max(...rules.map((r) => r.sort_order)) + 1 : 0;

    const { error } = await supabase.from("personal_rules").insert({
      user_id: user.id,
      title: t,
      body: b,
      sort_order,
    });
    if (error) {
      console.error("[RulesSection] insert:", error.message);
      return;
    }
    setTitle("");
    setBody("");
    void load();
  }

  async function saveEdit(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("personal_rules")
      .update({
        title: editTitle.trim(),
        body: editBody.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) console.error("[RulesSection] update:", error.message);
    setEditId(null);
    void load();
  }

  async function removeRule(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("personal_rules").delete().eq("id", id);
    if (error) console.error("[RulesSection] delete:", error.message);
    void load();
  }

  async function moveRule(id: string, dir: -1 | 1) {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= rules.length) return;

    const supabase = createClient();
    const a = rules[idx];
    const b = rules[swapIdx];
    await supabase.from("personal_rules").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("personal_rules").update({ sort_order: a.sort_order }).eq("id", b.id);
    void load();
  }

  if (loading) {
    return <p className="text-center text-xs text-white/45">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/85">
        Moje zasady
      </h2>

      <form onSubmit={(e) => void addRule(e)} className={`${cardCls} space-y-3`}>
        <input
          className={inputCls}
          placeholder="Tytuł zasady"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className={`${inputCls} min-h-[88px] resize-y`}
          placeholder="Treść — dlaczego to ważne, jak stosujesz"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-[#EF9F27] py-2.5 text-sm font-bold text-black"
        >
          Dodaj zasadę
        </button>
      </form>

      {rules.length === 0 ? (
        <p className="text-center text-xs text-white/40">Brak zasad — dodaj pierwszą.</p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className={cardCls}>
              {editId === rule.id ? (
                <>
                  <input
                    className={inputCls}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <textarea
                    className={`${inputCls} min-h-[80px] resize-y`}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(rule.id)}
                      className="flex-1 rounded-lg bg-[#3B6D11] py-2 text-xs font-semibold"
                    >
                      Zapisz
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="rounded-lg border border-[#333] px-3 py-2 text-xs"
                    >
                      Anuluj
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-white">{rule.title}</h3>
                  {rule.body ? (
                    <p className="whitespace-pre-wrap text-sm text-white/75">{rule.body}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(rule.id);
                        setEditTitle(rule.title);
                        setEditBody(rule.body);
                      }}
                      className="rounded-lg border border-[#333] px-3 py-1.5 text-xs"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRule(rule.id)}
                      className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-300"
                    >
                      Usuń
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveRule(rule.id, -1)}
                      className="rounded-lg border border-[#333] px-2 py-1.5 text-xs"
                      aria-label="Wyżej"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveRule(rule.id, 1)}
                      className="rounded-lg border border-[#333] px-2 py-1.5 text-xs"
                      aria-label="Niżej"
                    >
                      ↓
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
