"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartUnit } from "@/lib/measurement-profiles";

export type ExerciseChartPoint = { dateLabel: string; value: number };

function unitSuffix(unit: ChartUnit): string {
  switch (unit) {
    case "kg":
      return "kg";
    case "reps":
      return "powt.";
    case "sec":
      return "s";
    case "km":
      return "km";
  }
}

function emptyHint(unit: ChartUnit): string {
  switch (unit) {
    case "kg":
      return "zapisuj serie z ciężarem";
    case "reps":
      return "zapisuj serie i powtórzenia";
    case "sec":
      return "zapisuj czasy trzymania";
    case "km":
      return "zapisuj dystans";
  }
}

export default function ExerciseMaxChart({
  data,
  unit,
}: {
  data: ExerciseChartPoint[];
  unit: ChartUnit;
}) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-white/35">
        Za mało danych pod wybrany zakres — {emptyHint(unit)}, aby pojawiła się
        krzywa.
      </p>
    );
  }

  const suffix = unitSuffix(unit);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#333" strokeDasharray="3 6" opacity={0.85} />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: "#9ca3af", fontSize: 10 }}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[0, "auto"]} />
        <Tooltip
          contentStyle={{
            background: "#151515",
            border: "1px solid #333",
          }}
          labelStyle={{ color: "#fafafa", fontWeight: 600 }}
          formatter={(v) =>
            typeof v === "number"
              ? [
                  unit === "km"
                    ? `${v.toFixed(2)} ${suffix}`
                    : `${Math.round(v)} ${suffix}`,
                  "Max",
                ]
              : [String(v), ""]
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#EF9F27"
          strokeWidth={2}
          dot={{ r: 2.5, stroke: "#fafafa", strokeWidth: 1, fill: "#121212" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
