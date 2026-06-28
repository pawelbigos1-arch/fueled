"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatDateKey } from "@/lib/fueled-storage";
import type { NewThingRow } from "@/lib/growth-types";

const cardCls = "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";
const inputCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60";

export default function NewThingsSection() {
  const [items, setItems] = useState<NewThingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"planned" | "done">("planned");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plannedDate, setPlannedDate] = useState("");

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [doneDate, setDoneDate] = useState(() => formatDateKey(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("new_things")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) console.error("[NewThingsSection] load:", error.message);
    setItems((data ?? []) as NewThingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const planned = items.filter((i) => i.status === "planned");
  const done = items.filter((i) => i.status === "done");
  const visible = tab === "planned" ? planned : done;

  async function addPlanned(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("new_things").insert({
      user_id: user.id,
      status: "planned",
      title: t,
      description: description.trim(),
      planned_date: plannedDate || null,
      sort_order: planned.length,
    });
    if (error) {
      console.error("[NewThingsSection] insert:", error.message);
      return;
    }
    setTitle("");
    setDescription("");
    setPlannedDate("");
    await load();
  }

  async function markDone(id: string) {
    if (!doneDate) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("new_things")
      .update({
        status: "done",
        done_date: doneDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      console.error("[NewThingsSection] complete:", error.message);
      return;
    }
    setCompleteId(null);
    setTab("done");
    await load();
  }

  async function removeItem(id: string) {
    const supabase = createClient();
    await supabase.from("new_things").delete().eq("id", id);
    await load();
  }

  return (
    <div className="space-y-4 text-white">
      <div className="flex gap-2">
        {(
          [
            ["planned", "Planowane"],
            ["done", "Zrealizowane"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium ${
              tab === id
                ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                : "border-[#333] text-white/65"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "planned" ? (
        <form onSubmit={(e) => void addPlanned(e)} className={`${cardCls} space-y-3`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł"
            className={inputCls}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Krótki opis"
            rows={2}
            className={inputCls}
          />
          <label className="block text-[11px] text-white/50">
            Planowana data (opcjonalnie)
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl border border-[#EF9F27]/55 bg-[#EF9F27]/15 py-2.5 text-sm font-semibold text-[#EF9F27]"
          >
            Dodaj plan
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/45">Ładowanie…</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-sm text-white/45">
          {tab === "planned" ? "Brak planowanych rzeczy." : "Brak zrealizowanych."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id} className={`${cardCls} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-white/55">{item.description}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-white/40">
                    {item.status === "planned"
                      ? item.planned_date
                        ? `Plan: ${item.planned_date}`
                        : "Bez daty planu"
                      : item.done_date
                        ? `Zrealizowano: ${item.done_date}`
                        : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeItem(item.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Usuń
                </button>
              </div>
              {item.status === "planned" ? (
                completeId === item.id ? (
                  <div className="flex flex-wrap items-end gap-2 border-t border-[#333] pt-3">
                    <label className="text-[11px] text-white/50">
                      Data realizacji
                      <input
                        type="date"
                        value={doneDate}
                        onChange={(e) => setDoneDate(e.target.value)}
                        className={`${inputCls} mt-1`}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void markDone(item.id)}
                      className="rounded-lg border border-[#3B6D11]/55 bg-[#3B6D11]/15 px-3 py-2 text-xs font-semibold text-[#9fd86a]"
                    >
                      Potwierdź
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompleteId(null)}
                      className="text-xs text-white/50 hover:underline"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCompleteId(item.id);
                      setDoneDate(formatDateKey(new Date()));
                    }}
                    className="text-xs font-medium text-[#EF9F27] hover:underline"
                  >
                    Oznacz jako zrealizowane →
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
