"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkoutRow } from "@/lib/discipline-auto";
import { strengthDatesFromWorkouts } from "@/lib/discipline-auto";
import {
  DEFAULT_SUPPLEMENT_TIMINGS,
  type SupplementBundle,
} from "@/lib/supplement-types";
import { createClient } from "@/lib/supabase";

export function useSupplementsData(rangeStart: string, rangeEnd: string) {
  const [bundle, setBundle] = useState<SupplementBundle>({
    timings: [],
    supplements: [],
    rules: [],
    doses: [],
    intakes: [],
    trainingPlans: [],
  });
  const [strengthDates, setStrengthDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBundle({
        timings: [],
        supplements: [],
        rules: [],
        doses: [],
        intakes: [],
        trainingPlans: [],
      });
      setStrengthDates(new Set());
      setLoading(false);
      return;
    }

    let { data: timings, error: te } = await supabase
      .from("supplement_timings")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (te) console.error("[useSupplementsData] timings:", te.message);

    if (!timings || timings.length === 0) {
      const rows = DEFAULT_SUPPLEMENT_TIMINGS.map((name, i) => ({
        user_id: user.id,
        name,
        sort_order: i,
        active: true,
      }));
      const { data: seeded, error: se } = await supabase
        .from("supplement_timings")
        .insert(rows)
        .select("*");
      if (se) console.error("[useSupplementsData] seed timings:", se.message);
      timings = seeded ?? [];
    }

    const [
      supplementsRes,
      rulesRes,
      dosesRes,
      intakesRes,
      plansRes,
      workoutsRes,
    ] = await Promise.all([
      supabase
        .from("supplements")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase.from("supplement_rules").select("*").eq("user_id", user.id),
      supabase.from("supplement_rule_doses").select("*").eq("user_id", user.id),
      supabase
        .from("supplement_intakes")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", rangeStart)
        .lte("date", rangeEnd),
      supabase
        .from("training_day_plans")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", rangeStart)
        .lte("date", rangeEnd),
      supabase
        .from("workout_log")
        .select("date, exercise, category, measurement_profile")
        .eq("user_id", user.id)
        .gte("date", rangeStart)
        .lte("date", rangeEnd),
    ]);

    if (supplementsRes.error) {
      console.error("[useSupplementsData] supplements:", supplementsRes.error.message);
    }
    if (rulesRes.error) {
      console.error("[useSupplementsData] rules:", rulesRes.error.message);
    }
    if (dosesRes.error) {
      console.error("[useSupplementsData] doses:", dosesRes.error.message);
    }
    if (intakesRes.error) {
      console.error("[useSupplementsData] intakes:", intakesRes.error.message);
    }
    if (plansRes.error) {
      console.error("[useSupplementsData] plans:", plansRes.error.message);
    }
    if (workoutsRes.error) {
      console.error("[useSupplementsData] workouts:", workoutsRes.error.message);
    }

    setBundle({
      timings: (timings ?? []) as SupplementBundle["timings"],
      supplements: (supplementsRes.data ?? []) as SupplementBundle["supplements"],
      rules: (rulesRes.data ?? []) as SupplementBundle["rules"],
      doses: (dosesRes.data ?? []) as SupplementBundle["doses"],
      intakes: (intakesRes.data ?? []) as SupplementBundle["intakes"],
      trainingPlans: (plansRes.data ?? []) as SupplementBundle["trainingPlans"],
    });
    setStrengthDates(
      strengthDatesFromWorkouts((workoutsRes.data ?? []) as WorkoutRow[])
    );
    setLoading(false);
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    void load();
  }, [load]);

  return { bundle, strengthDates, loading, reload: load };
}
