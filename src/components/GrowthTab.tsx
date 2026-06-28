"use client";

import { useState } from "react";
import ReflectionSection from "@/components/reflection/ReflectionSection";
import GoalsSection from "@/components/goals/GoalsSection";
import NewThingsSection from "@/components/new-things/NewThingsSection";

type GrowthSection = "reflection" | "goals" | "new_things";

const pill =
  "touch-manipulation inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-[#333] px-3 py-2.5 text-[13px] font-medium leading-tight transition active:opacity-90";

export default function GrowthTab() {
  const [section, setSection] = useState<GrowthSection>("reflection");

  return (
    <div className="space-y-4">
      <nav className="flex gap-2" aria-label="Sekcje rozwoju">
        {(
          [
            ["reflection", "Refleksje"],
            ["goals", "Cele"],
            ["new_things", "Nowe rzeczy"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`${pill} ${
              section === id
                ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                : "text-white/72"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === "reflection" ? <ReflectionSection /> : null}
      {section === "goals" ? <GoalsSection /> : null}
      {section === "new_things" ? <NewThingsSection /> : null}
    </div>
  );
}
