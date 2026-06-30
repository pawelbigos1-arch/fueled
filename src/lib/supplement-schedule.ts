import type {
  ExpectedDose,
  SupplementBundle,
  SupplementRuleCondition,
  SupplementRuleDoseRow,
  SupplementRuleRow,
  SupplementTimingRow,
} from "@/lib/supplement-types";

export function doseKey(
  supplementId: string,
  timingId: string,
  doseIndex: number
): string {
  return `${supplementId}:${timingId}:${doseIndex}`;
}

export function isTrainingDay(
  date: string,
  trainingPlans: Map<string, boolean>
): boolean {
  return trainingPlans.get(date) ?? false;
}

export function buildTrainingPlanMap(
  plans: { date: string; is_training: boolean }[]
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const p of plans) map.set(p.date, p.is_training);
  return map;
}

export function buildIntakeSet(
  intakes: { supplement_id: string; timing_id: string; dose_index: number; taken: boolean; date: string }[],
  date: string
): Set<string> {
  const keys = new Set<string>();
  for (const row of intakes) {
    if (row.date !== date || !row.taken) continue;
    keys.add(doseKey(row.supplement_id, row.timing_id, row.dose_index));
  }
  return keys;
}

function pickRule(
  rules: SupplementRuleRow[],
  isTraining: boolean
): SupplementRuleRow | null {
  const byCondition = new Map(rules.map((r) => [r.condition, r]));
  if (isTraining && byCondition.has("training")) {
    return byCondition.get("training")!;
  }
  if (!isTraining && byCondition.has("rest")) {
    return byCondition.get("rest")!;
  }
  if (byCondition.has("always")) {
    return byCondition.get("always")!;
  }
  return null;
}

function dosesForRule(
  rule: SupplementRuleRow,
  allDoses: SupplementRuleDoseRow[],
  timingById: Map<string, SupplementTimingRow>
): { timingId: string; doseIndex: number }[] {
  return allDoses
    .filter((d) => d.rule_id === rule.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d, idx) => ({ timingId: d.timing_id, doseIndex: idx }))
    .filter((d) => timingById.has(d.timingId));
}

export function resolveExpectedDoses(
  bundle: SupplementBundle,
  date: string,
  trainingPlans: Map<string, boolean>
): ExpectedDose[] {
  const activeTimings = bundle.timings
    .filter((t) => t.active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const timingById = new Map(activeTimings.map((t) => [t.id, t]));

  const activeSupplements = bundle.supplements
    .filter((s) => s.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const rulesBySupplement = new Map<string, SupplementRuleRow[]>();
  for (const rule of bundle.rules) {
    if (!rulesBySupplement.has(rule.supplement_id)) {
      rulesBySupplement.set(rule.supplement_id, []);
    }
    rulesBySupplement.get(rule.supplement_id)!.push(rule);
  }

  const isTraining = isTrainingDay(date, trainingPlans);
  const result: ExpectedDose[] = [];

  for (const supplement of activeSupplements) {
    const rules = rulesBySupplement.get(supplement.id) ?? [];
    const rule = pickRule(rules, isTraining);
    if (!rule) continue;

    const doseSlots = dosesForRule(rule, bundle.doses, timingById);
    for (const slot of doseSlots) {
      const timing = timingById.get(slot.timingId)!;
      result.push({
        supplementId: supplement.id,
        supplementName: supplement.name,
        timingId: slot.timingId,
        timingName: timing.name,
        doseIndex: slot.doseIndex,
        key: doseKey(supplement.id, slot.timingId, slot.doseIndex),
      });
    }
  }

  result.sort((a, b) => {
    const ta = timingById.get(a.timingId)?.sort_order ?? 0;
    const tb = timingById.get(b.timingId)?.sort_order ?? 0;
    if (ta !== tb) return ta - tb;
    const sa =
      activeSupplements.find((s) => s.id === a.supplementId)?.sort_order ?? 0;
    const sb =
      activeSupplements.find((s) => s.id === b.supplementId)?.sort_order ?? 0;
    return sa - sb;
  });

  return result;
}

export function dayProgress(
  expected: ExpectedDose[],
  takenSet: Set<string>
): { taken: number; expected: number; met: boolean } {
  const total = expected.length;
  let taken = 0;
  for (const dose of expected) {
    if (takenSet.has(dose.key)) taken += 1;
  }
  return { taken, expected: total, met: total > 0 && taken >= total };
}

export function groupDosesByTiming(
  doses: ExpectedDose[]
): { timingId: string; timingName: string; doses: ExpectedDose[] }[] {
  const groups: {
    timingId: string;
    timingName: string;
    doses: ExpectedDose[];
  }[] = [];
  const index = new Map<string, number>();

  for (const dose of doses) {
    if (!index.has(dose.timingId)) {
      index.set(dose.timingId, groups.length);
      groups.push({
        timingId: dose.timingId,
        timingName: dose.timingName,
        doses: [],
      });
    }
    groups[index.get(dose.timingId)!].doses.push(dose);
  }

  return groups;
}

export function hasConfiguredSupplements(bundle: SupplementBundle): boolean {
  const activeIds = new Set(
    bundle.supplements.filter((s) => s.active).map((s) => s.id)
  );
  if (activeIds.size === 0) return false;
  return bundle.rules.some(
    (r) => activeIds.has(r.supplement_id) && bundle.doses.some((d) => d.rule_id === r.id)
  );
}

export function rulePreviewLabel(
  rules: SupplementRuleRow[],
  doses: SupplementRuleDoseRow[],
  condition: SupplementRuleCondition
): string {
  const rule = rules.find((r) => r.condition === condition);
  if (!rule) return "";
  const count = doses.filter((d) => d.rule_id === rule.id).length;
  return count > 0 ? `${RULE_CONDITION_SHORT[condition]} ${count}×` : "";
}

const RULE_CONDITION_SHORT: Record<SupplementRuleCondition, string> = {
  always: "zawsze",
  training: "trening",
  rest: "odpoczynek",
};

export function weekSupplementProgress(
  bundle: SupplementBundle,
  dates: string[],
  trainingPlans: Map<string, boolean>,
  intakes: SupplementBundle["intakes"]
): { taken: number; expected: number } {
  let taken = 0;
  let expected = 0;
  for (const date of dates) {
    const doses = resolveExpectedDoses(bundle, date, trainingPlans);
    const takenSet = buildIntakeSet(intakes, date);
    const p = dayProgress(doses, takenSet);
    taken += p.taken;
    expected += p.expected;
  }
  return { taken, expected };
}
