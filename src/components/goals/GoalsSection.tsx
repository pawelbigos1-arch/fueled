"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { addDays, formatDateKey, parseDateKey } from "@/lib/fueled-storage";
import type { DatedGoalRow, ProjectRow } from "@/lib/growth-types";

const cardCls = "rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4";
const inputCls =
  "w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none focus:border-[#EF9F27]/60";

export default function GoalsSection() {
  const [day, setDay] = useState(() => formatDateKey(new Date()));
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [goals, setGoals] = useState<DatedGoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [showProjects, setShowProjects] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProjects([]);
      setGoals([]);
      setLoading(false);
      return;
    }

    const [{ data: pRows }, { data: gRows }] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("dated_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", day)
        .order("sort_order", { ascending: true }),
    ]);

    setProjects((pRows ?? []) as ProjectRow[]);
    setGoals((gRows ?? []) as DatedGoalRow[]);
    setLoading(false);
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const dateLabel = useMemo(() => {
    try {
      return parseDateKey(day).toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return day;
    }
  }, [day]);

  function shift(delta: number) {
    setDay(formatDateKey(addDays(parseDateKey(day), delta)));
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("dated_goals").insert({
      user_id: user.id,
      date: day,
      title: t,
      description: description.trim(),
      project_id: projectId || null,
      sort_order: goals.length,
    });
    if (error) {
      console.error("[GoalsSection] insert:", error.message);
      return;
    }
    setTitle("");
    setDescription("");
    await load();
  }

  async function removeGoal(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("dated_goals").delete().eq("id", id);
    if (error) console.error("[GoalsSection] delete:", error.message);
    await load();
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const n = newProjectName.trim();
    if (!n) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      name: n,
      sort_order: projects.length,
    });
    if (error) {
      console.error("[GoalsSection] project insert:", error.message);
      return;
    }
    setNewProjectName("");
    await load();
  }

  async function removeProject(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ active: false })
      .eq("id", id);
    if (error) console.error("[GoalsSection] project delete:", error.message);
    await load();
  }

  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4 text-white">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg border border-[#333] px-3 py-2 hover:bg-white/5"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center text-sm capitalize text-white/75">
          {dateLabel}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg border border-[#333] px-3 py-2 hover:bg-white/5"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowProjects((v) => !v)}
        className="text-xs text-[#EF9F27] underline-offset-2 hover:underline"
      >
        {showProjects ? "Ukryj projekty" : "Zarządzaj projektami"}
      </button>

      {showProjects ? (
        <div className={`${cardCls} space-y-3`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Projekty
          </p>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#333] px-3 py-2 text-sm"
              >
                <span>{p.name}</span>
                <button
                  type="button"
                  onClick={() => void removeProject(p.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Usuń
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => void addProject(e)} className="flex gap-2">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nowy projekt"
              className={inputCls}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-[#EF9F27]/55 bg-[#EF9F27]/15 px-4 py-2 text-sm font-semibold text-[#EF9F27]"
            >
              Dodaj
            </button>
          </form>
        </div>
      ) : null}

      <form onSubmit={(e) => void addGoal(e)} className={`${cardCls} space-y-3`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Nowy cel na ten dzień
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tytuł celu"
          className={inputCls}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opis (opcjonalnie)"
          rows={2}
          className={inputCls}
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={inputCls}
        >
          <option value="">Bez projektu</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="w-full rounded-xl border border-[#EF9F27]/55 bg-[#EF9F27]/15 py-2.5 text-sm font-semibold text-[#EF9F27]"
        >
          Dodaj cel
        </button>
      </form>

      {loading ? (
        <p className="text-center text-sm text-white/45">Ładowanie…</p>
      ) : goals.length === 0 ? (
        <p className="text-center text-sm text-white/45">Brak celów na ten dzień.</p>
      ) : (
        <ul className="space-y-2">
          {goals.map((g) => (
            <li key={g.id} className={`${cardCls} flex gap-3`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{g.title}</p>
                {g.description ? (
                  <p className="mt-1 text-sm text-white/55">{g.description}</p>
                ) : null}
                <p className="mt-2 text-[11px] uppercase tracking-wide text-[#EF9F27]/80">
                  {projectName(g.project_id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeGoal(g.id)}
                className="shrink-0 text-xs text-red-400 hover:underline"
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
