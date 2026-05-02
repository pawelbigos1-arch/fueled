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

export type ExerciseChartPoint = { dateLabel: string; value: number };

export default function ExerciseMaxChart({
  data,
  unit,
}: {
  data: ExerciseChartPoint[];
  unit: "kg" | "reps";
}) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-white/35">
        Za mało danych pod wybrany zakres —{" "}
        {unit === "kg"
          ? "zapisuj serie z ciężarem"
          : "zapisuj serie i powtórzenia"}
        , aby pojawiła się krzywa.
      </p>
    );
  }

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
              ? [`${Math.round(v)} ${unit === "kg" ? "kg" : "powt."}`, "Max"]
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
