"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import TodayTab from "@/components/TodayTab";
import PlanTab from "@/components/PlanTab";
import LogTab from "@/components/LogTab";
import GoalTab from "@/components/GoalTab";
import AnalysisTab from "@/components/AnalysisTab";
import GrowthTab from "@/components/GrowthTab";

type TabId = "today" | "plan" | "log" | "goal" | "analysis" | "growth";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "today", label: "Dziś", icon: "☀️" },
  { id: "plan", label: "Plan", icon: "📋" },
  { id: "log", label: "Dziennik", icon: "🏋️" },
  { id: "goal", label: "Cel", icon: "🎯" },
  { id: "analysis", label: "Analiza", icon: "📊" },
  { id: "growth", label: "Rozwój", icon: "🧠" },
];

function formatTodayPl(): string {
  return new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function displayNameFromUser(user: User) {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fromFull =
    typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
  const fromName =
    typeof meta?.name === "string" ? meta.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const nick =
    email && email.includes("@")
      ? (email.split("@")[0] ?? email)
      : email;
  return fromFull || fromName || nick || "Użytkownik";
}

const ADMIN_STATS_EMAIL = "pawelbigos1@gmail.com";

export default function AppPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [userLabel, setUserLabel] = useState<string>("");
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setUserLabel(displayNameFromUser(user));

      const emailLc = typeof user.email === "string" ? user.email.toLowerCase() : "";
      if (emailLc !== ADMIN_STATS_EMAIL) return;

      let total: number | null = null;
      const rpc = await supabase.rpc("admin_user_profiles_count");
      if (!rpc.error && rpc.data !== null && rpc.data !== undefined) {
        total = Number(rpc.data);
      } else {
        if (rpc.error)
          console.error("[AppPage] admin_user_profiles_count RPC:", rpc.error.message);
        const { count, error } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true });
        if (error) console.error("[AppPage] user_profiles count fallback:", error.message);
        if (!error && count !== null) total = count;
      }
      if (!cancelled && total !== null && Number.isFinite(total)) setAdminUserCount(total);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const btnBase =
    "touch-manipulation flex min-h-[52px] min-w-0 flex-1 select-none flex-col items-center justify-center gap-1 rounded-[14px] border px-1.5 py-2.5 text-center transition active:opacity-90";
  const btnActive =
    "border-white/40 bg-[#252525] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  const btnIdle =
    "border-[#333] bg-transparent text-white/85 active:bg-white/[0.04] sm:hover:border-white/22 sm:hover:bg-white/[0.04] sm:hover:text-white";

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-[16px] pb-[max(16px,calc(env(safe-area-inset-bottom)+8px))] pt-[max(14px,calc(env(safe-area-inset-top)+6px))]">
        <header className="mb-4 flex shrink-0 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold tracking-[0.12em] text-white">
              FUELED<span className="tracking-normal">.</span>
              <span
                className="ml-0.5 inline-block size-2 translate-y-px rounded-[2px] bg-[#EF9F27]"
                aria-hidden
              />
            </h1>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <p className="max-w-[200px] truncate text-[13px] font-semibold leading-tight text-white/92">
                {userLabel || "…"}
              </p>
              <p className="text-[13px] capitalize leading-tight text-white/52">
                {formatTodayPl()}
              </p>
              <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                {adminUserCount !== null ? (
                  <span
                    className="rounded-md border border-white/15 bg-black/25 px-2 py-1 text-[11px] tabular-nums text-white/70"
                    title="Liczba rekordów w user_profiles"
                    aria-label={`Liczba użytkowników w aplikacji: ${adminUserCount}`}
                  >
                    👥 {adminUserCount}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="touch-manipulation min-h-[44px] min-w-[44px] px-2 py-2 text-[12px] text-white/50 underline-offset-4 active:bg-white/[0.06] sm:hover:text-white/85 sm:hover:underline"
                >
                  Wyloguj
                </button>
              </div>
            </div>
          </div>

          <nav className="flex gap-2.5" aria-label="Główna nawigacja">
            {TABS.map(({ id, label, icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  title={label}
                  className={`${btnBase} ${isActive ? btnActive : btnIdle}`}
                >
                  <span
                    className="text-[1.35rem] leading-none"
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <span
                    className={`block max-w-full truncate text-[12px] leading-tight tracking-tight sm:text-[13px] ${isActive ? "font-semibold" : "font-medium"}`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </header>

        <main className="flex flex-1 flex-col pb-2">
          {activeTab === "today" ? <TodayTab /> : null}
          {activeTab === "plan" ? <PlanTab /> : null}
          {activeTab === "log" ? <LogTab /> : null}
          {activeTab === "goal" ? <GoalTab /> : null}
          {activeTab === "analysis" ? <AnalysisTab /> : null}
          {activeTab === "growth" ? <GrowthTab /> : null}
        </main>
      </div>
    </div>
  );
}
