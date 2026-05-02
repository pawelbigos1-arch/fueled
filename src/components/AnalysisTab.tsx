"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredMeal } from "@/lib/fueled-storage";
import {
  addDays,
  formatDateKey,
  parseDateKey,
  readBurnTotal,
  readMealsStored,
  readWeightStore,
  writeWeightStore,
  type WeightStorage,
  type WeightDay,
} from "@/lib/fueled-storage";
import type { StatsRange } from "@/lib/date-range";
import {
  enumerateDays,
  parseKey,
  startDateForRange,
} from "@/lib/date-range";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGES: StatsRange[] = [
  "7d",
  "14d",
  "1m",
  "2m",
  "3m",
  "6m",
  "1r",
];

const pill =
  "rounded-[10px] border border-[#333] px-3 py-1.5 text-xs font-medium transition bg-[#151515]";

const sectionCap =
  "text-[10px] font-semibold uppercase tracking-[0.22em] text-white/52";

function sumMealsKcal(ml: StoredMeal[]): number {
  return ml.reduce((s, m) => s + Math.max(0, m.calories), 0);
}

function MacroLine({
  metric,
  data,
}: {
  metric: "weight" | "fat" | "muscle";
  data: Array<{ dk: string; v: number }>;
}) {
  const stroke =
    metric === "weight"
      ? "#EF9F27"
      : metric === "fat"
        ? "#93c5fd"
        : "#c4b5fd";

  const pts = data.map((d0) => ({
    label: parseKey(d0.dk).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
    }),
    v: d0.v,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={pts} margin={{ top: 4, left: -10, right: 6, bottom: 0 }}>
        <CartesianGrid stroke="#333" strokeDasharray="3 6" opacity={0.85} />
        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <YAxis domain={["auto", "auto"]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            border: "1px solid #333",
            background: "#151515",
          }}
          labelStyle={{ color: "#fafafa", fontWeight: 600 }}
        />
        <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FoodCal({
  month,
  setMonth,
  picked,
  onPick,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  picked: string;
  onPick: (dk: string) => void;
}) {
  const y = month.getFullYear();
  const mo = month.getMonth();

  const first = new Date(y, mo, 1);
  const last = new Date(y, mo + 1, 0);
  const lead = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((lead + last.getDate()) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, ix) => {
    const dom = ix - lead + 1;
    return dom >= 1 && dom <= last.getDate()
      ? `${y}-${String(mo + 1).padStart(2, "0")}-${String(dom).padStart(2, "0")}`
      : null;
  });

  function hasMeals(dk: string) {
    return readMealsStored(dk).length > 0;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-2 hover:border-white/28"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1))
          }
        >
          ‹
        </button>
        <p className="text-sm font-medium capitalize text-white/90">
          {month.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-2 hover:border-white/28"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1))
          }
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[9px] font-bold uppercase text-white/45">
        {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((h) => (
          <span key={h} className="py-2 text-center">
            {h}
          </span>
        ))}
        {cells.map((dk, i) =>
          dk ? (
            <button
              key={`afc-${dk}-${i}`}
              type="button"
              onClick={() => {
                onPick(dk);

              }}
              className={`rounded-[10px] border py-3 text-[11px] font-semibold ${
                picked === dk
                  ? "ring-1 ring-[#EF9F27] ring-offset-2 ring-offset-[#121212]"
                  : ""
              } ${
                hasMeals(dk)
                  ? "border-[#EF9F27]/50 bg-[#EF9F27]/12 text-[#ffe8c7]"
                  : "border-[#333] bg-[#151515] text-white/55"
              }`}
            >
              {Number(dk.split("-")[2])}
            </button>
          ) : (
            <span key={`ep-${i}`} />
          )
        )}
      </div>

      <p className="text-[11px] text-white/40">
        Klik wybrano — szczegóły dnia są w trybie przełącz na „Dzień” lub
        zapisz zakres powyżej.
      </p>
    </div>
  );
}

function WeightBodyPane({
  wRange,
  setWRange,
  wm,
  setWm,
  wInp,
  setWInp,
  fatInp,
  setFatInp,
  musInp,
  setMusInp,
  saveMeasures,
  weightSeriesRaw,
  cards,
}: {
  wRange: StatsRange;
  setWRange: (r: StatsRange) => void;
  wm: "weight" | "fat" | "muscle";
  setWm: (m: "weight" | "fat" | "muscle") => void;
  wInp: string;
  setWInp: (s: string) => void;
  fatInp: string;
  setFatInp: (s: string) => void;
  musInp: string;
  setMusInp: (s: string) => void;
  saveMeasures: (e: React.FormEvent) => void;
  weightSeriesRaw: Array<{ dk: string; v: number }>;
  cards: { current: number; mn: number; trend: number };
}) {
  return (
    <div className="space-y-5">
      <form
        onSubmit={saveMeasures}
        className="space-y-3 rounded-[10px] border border-[#333] bg-[#151515]/90 p-3"
      >
        <label className="block text-[11px] font-bold uppercase tracking-wide">
          Dane pomiaru
          <input
            className="mt-1 w-full rounded-[10px] border border-[#333] bg-[#121212] px-3 py-2 text-[18px] font-semibold outline-none focus:border-[#EF9F27]/35"
            placeholder="Waga kg"
            value={wInp}
            inputMode="decimal"
            onChange={(ev) => setWInp(ev.target.value)}
          />
          <input
            className="mt-3 w-full rounded-[10px] border border-[#333] bg-[#121212] px-3 py-2 text-[18px] font-semibold outline-none focus:border-[#EF9F27]/35"
            placeholder="% tłuszczu"
            value={fatInp}
            inputMode="decimal"
            onChange={(ev) => setFatInp(ev.target.value)}
          />
          <input
            className="mt-3 w-full rounded-[10px] border border-[#333] bg-[#121212] px-3 py-2 text-[18px] font-semibold outline-none focus:border-[#EF9F27]/35"
            placeholder="Mięśnie kg"
            value={musInp}
            inputMode="decimal"
            onChange={(ev) => setMusInp(ev.target.value)}
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-[10px] border border-[#EF9F27]/55 bg-[#EF9F27]/18 py-3 font-bold text-[#fff2e8] hover:bg-[#EF9F27]/28"
        >
          Zapisz pomiary
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {(["weight", "fat", "muscle"] as const).map((m0) => (
          <button
            key={m0}
            type="button"
            onClick={() => setWm(m0)}
            className={`${pill} capitalize ${
              wm === m0
                ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e6]"
                : "!border-[#333] text-white/70"
            }`}
          >
            {m0 === "weight"
              ? "Waga"
              : m0 === "fat"
                ? "Tkanka tl."
                : "Mięśnie"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((rk) => (
          <button
            key={`wk-${rk}`}
            type="button"
            onClick={() => setWRange(rk)}
            className={`${pill} ${
              wRange === rk
                ? "border-[#EF9F27]/55 bg-[#EF9F27]/12 text-[#fff2e6]"
                : "!border-[#333] text-white/65"
            }`}
          >
            {rk}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-3 text-[11px]">
          Aktualny
          <p className="mt-2 text-lg font-black text-[#EF9F27]">
            {Number.isFinite(cards.current)
              ? cards.current.toFixed(1)
              : "–"}
          </p>
        </div>
        <div className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-3 text-[11px]">
          Minimum
          <p className="mt-2 text-lg font-black text-white/88">
            {Number.isFinite(cards.mn) ? cards.mn.toFixed(1) : "–"}
          </p>
        </div>
        <div className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-3 text-[11px]">
          Trend Δ
          <p className={`mt-2 text-lg font-black ${cards.trend >= 0 ? "text-[#3B6D11]" : "text-red-400"}`}>
            {Number.isFinite(cards.trend)
              ? (cards.trend > 0 ? "+" : "") + cards.trend.toFixed(2)
              : "–"}
          </p>
        </div>
      </div>

      <MacroLine metric={wm} data={weightSeriesRaw} />
    </div>
  );
}

export default function AnalysisTab() {

  const [mounted, setMounted] = useState(false);

  /** diet */
  const [dietTab, setDietTab] = useState(true);
  const [foodView, setFoodView] = useState<"day" | "cal">("day");
  const [dietRange, setDietRange] = useState<StatsRange>("14d");
  const [dayPick, setDayPick] = useState(() =>
    formatDateKey(new Date())
  );
  const [calMonth, setCalMonth] = useState(() => new Date());

  /** weight */
  const [wm, setWeightMetric] = useState<"weight" | "fat" | "muscle">(
    "weight"
  );
  const [wRange, setWRange] = useState<StatsRange>("14d");
  const [wInp, setWInp] = useState("");
  const [fatInp, setFatInp] = useState("");
  const [musInp, setMusInp] = useState("");

  useEffect(() => {
    setMounted(true);
    const store = readWeightStore();
    const tk = formatDateKey(new Date());
    const td = store[tk];
    if (td) {
      setWInp(td.weight !== undefined ? String(td.weight) : "");
      setFatInp(td.fat !== undefined ? String(td.fat) : "");
      setMusInp(td.muscle !== undefined ? String(td.muscle) : "");
    }
  }, []);

  const dietWindow = useMemo(() => {
    const end = new Date();
    const start = startDateForRange(dietRange, end);
    return enumerateDays(start, end);
  }, [dietRange]);

  const dietStats = useMemo(() => {
    let sumEat = 0;
    let sumBurn = 0;
    let active = 0;
    dietWindow.forEach((dk) => {
      const ks = sumMealsKcal(readMealsStored(dk));
      const bw = readBurnTotal(dk);
      if (ks > 0 || bw > 0) active += 1;
      sumEat += ks;
      sumBurn += bw;
    });
    const n = dietWindow.length || 1;

    return {
      avgEat: Math.round(sumEat / n),
      avgBurn: Math.round(sumBurn / n),
      activeDays: active,
      barPoints: dietWindow.map((dk) => ({
        label: parseKey(dk).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "short",
        }),
        eat: Math.max(0, sumMealsKcal(readMealsStored(dk))),
        burn: Math.max(0, readBurnTotal(dk)),
      })),
    };
  }, [dietWindow]);

  const kcalWeightLineData = useMemo(() => {
    const end = new Date();
    const start = startDateForRange(dietRange, end);
    const keys = enumerateDays(start, end);
    const store = readWeightStore();
    return keys.map((dk) => {
      const raw = store[dk]?.weight;
      const w =
        typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      return {
        label: parseKey(dk).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "short",
        }),
        kcal: sumMealsKcal(readMealsStored(dk)),
        weight: w,
      };
    });
  }, [dietRange, mounted]);

  const showWeightAxis = useMemo(
    () =>
      kcalWeightLineData.some(
        (d) => d.weight !== null && Number.isFinite(d.weight)
      ),
    [kcalWeightLineData]
  );

  const mealsDay = useMemo(
    () => readMealsStored(dayPick),
    [dayPick, mounted]
  );

  function shiftFoodDay(d: number) {
    const x = formatDateKey(addDays(parseDateKey(dayPick), d));
    setDayPick(x);
  }

  /** weight series */
  const weightWindowKeys = useMemo(() => {
    const end = new Date();
    const start = startDateForRange(wRange, end);
    return enumerateDays(start, end);
  }, [wRange]);

  const weightSeriesRaw = useMemo(() => {
    const st = readWeightStore();
    return weightWindowKeys
      .map((dk) => {
        const e: WeightDay | undefined = st[dk];
        let v = 0;

        if (wm === "weight") v = e?.weight ?? Number.NaN;
        else if (wm === "fat") v = e?.fat ?? Number.NaN;
        else v = e?.muscle ?? Number.NaN;

        return { dk, v };
      })
      .filter((row) => Number.isFinite(row.v));
  }, [weightWindowKeys, wm, mounted]);

  const cards = useMemo(() => {
    const vals = weightSeriesRaw.map((r) => r.v);
    if (vals.length === 0)
      return { current: NaN as number, mn: NaN as number, trend: 0 };

    const trend = vals[vals.length - 1] - vals[0];
    return {
      current: vals[vals.length - 1],
      mn: Math.min(...vals),
      trend,
    };
  }, [weightSeriesRaw]);

  function saveMeasures(e: React.FormEvent) {
    e.preventDefault();
    const tk = formatDateKey(new Date());
    const nw: WeightDay = {};

    const w = Number(wInp.replace(",", "."));
    const f = Number(fatInp.replace(",", "."));
    const mu = Number(musInp.replace(",", "."));

    if (Number.isFinite(w)) nw.weight = Math.round(w * 10) / 10;
    if (Number.isFinite(f)) nw.fat = Math.round(f * 10) / 10;
    if (Number.isFinite(mu)) nw.muscle = Math.round(mu * 10) / 10;

    const merged: WeightStorage = { ...readWeightStore(), [tk]: nw };
    writeWeightStore(merged);
  }

  /** bar SVG */
  const barMax = Math.max(
    1,
    ...dietStats.barPoints.flatMap((b) => [b.eat, b.burn])
  );

  if (!mounted) {
    return <p className="py-12 text-center text-white/35">…</p>;
  }

  return (
    <div className="space-y-5 pb-8 text-white">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDietTab(true)}
          className={`${pill} flex-1 py-2.5 font-medium ${
            dietTab
              ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
              : "!border-[#333] text-white/72"
          }`}
        >
          Dieta
        </button>
        <button
          type="button"
          onClick={() => setDietTab(false)}
          className={`${pill} flex-1 py-2.5 font-medium ${
            !dietTab
              ? "border-[#fafafa]/30 bg-white/[0.07] text-white"
              : "!border-[#333] text-white/72"
          }`}
        >
          Waga i ciało
        </button>
      </div>

      {dietTab ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r0) => (
              <button
                key={`d-${r0}`}
                type="button"
                onClick={() => setDietRange(r0)}
                className={`${pill} ${
                  dietRange === r0
                    ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                    : "!border-[#333]"
                }`}
              >
                {r0}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "Śr. spożyte", v: `${dietStats.avgEat}`, c: "#EF9F27" },
              { l: "Śr. spalone", v: `${dietStats.avgBurn}`, c: "#3B6D11" },
              { l: "Aktywne dni", v: `${dietStats.activeDays}`, c: "#d4d4d4" },
            ].map((c0) => (
              <div
                key={c0.l}
                className="rounded-[10px] border border-[#333] bg-[#151515] px-2 py-3 text-center text-[11px]"
              >
                <p className="font-bold uppercase tracking-wide text-white/45">
                  {c0.l}
                </p>
                <p
                  className="mt-1 text-xl font-black"
                  style={{ color: c0.c }}
                >
                  {c0.v}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[10px] border border-[#333] bg-[#151515] p-3">
            <p className={`${sectionCap} mb-3`}>Spożyte kcal · waga (kg)</p>
            <div className="h-[244px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={kcalWeightLineData}
                  margin={{ top: 6, left: 0, right: 8, bottom: 2 }}
                >
                  <CartesianGrid
                    stroke="#333"
                    strokeDasharray="3 6"
                    opacity={0.85}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9ca3af", fontSize: 9 }}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={{ stroke: "#333" }}
                  />
                  <YAxis
                    yAxisId="kcal"
                    orientation="left"
                    tick={{ fill: "#EF9F27", fontSize: 10 }}
                    width={36}
                    tickLine={false}
                    axisLine={{ stroke: "#333" }}
                  />
                  {showWeightAxis ? (
                    <YAxis
                      yAxisId="kg"
                      orientation="right"
                      tick={{ fill: "#e5e5e5", fontSize: 10 }}
                      domain={["auto", "auto"]}
                      width={34}
                      tickLine={false}
                      axisLine={{ stroke: "#333" }}
                    />
                  ) : null}
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #333",
                      background: "#151515",
                      borderRadius: "10px",
                    }}
                    labelStyle={{ color: "#fafafa", fontWeight: 600 }}
                    formatter={(value, name) => {
                      if (name === "Waga (kg)") {
                        if (value == null || value === "") return ["—", name];
                        return [
                          typeof value === "number"
                            ? value.toFixed(1)
                            : String(value),
                          name,
                        ];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(v) => (
                      <span style={{ color: "#d4d4d4" }}>{v}</span>
                    )}
                  />
                  <Line
                    yAxisId="kcal"
                    type="monotone"
                    dataKey="kcal"
                    name="Spożyte kcal"
                    stroke="#EF9F27"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  {showWeightAxis ? (
                    <Line
                      yAxisId="kg"
                      type="monotone"
                      dataKey="weight"
                      name="Waga (kg)"
                      stroke="#fafafa"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!showWeightAxis ? (
              <p className="mt-2 text-center text-[11px] leading-snug text-white/42">
                Brak wpisów wagi w wybranym zakresie — linia wagi pojawi się po zapisaniu pomiaru w „Waga i ciało”.
              </p>
            ) : null}
          </div>

          <div className="rounded-[10px] border border-[#333] bg-[#151515] p-3">
            <p className={`${sectionCap} mb-2`}>Słupki (spożyte / spalone)</p>

            <div className="flex h-[120px] items-end gap-[2px] overflow-x-auto pb-1">
              {dietStats.barPoints.map((bp, ix) => {
                const eh = Math.round((bp.eat / barMax) * 105);
                const bh = Math.round((bp.burn / barMax) * 105);
                return (
                  <div key={ix} className="flex w-8 flex-shrink-0 flex-col items-center gap-1">
                    <div className="flex h-[106px] w-full flex-col justify-end rounded-sm bg-black/35">
                      <div
                        className="rounded-t-sm bg-[#EF9F27]"
                        style={{
                          height: `${Math.max(eh, 2)}px`,
                        }}
                      />
                      <div
                        className="rounded-b-sm bg-[#3B6D11]"
                        style={{
                          height: `${Math.max(bh, 2)}px`,
                        }}
                      />
                    </div>
                    <span className="text-[8px] text-white/40">
                      {bp.label.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-[10px] font-semibold">
              <span className="text-[#EF9F27]">■ spożyte</span>
              <span className="text-[#3B6D11]">■ spalone</span>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center gap-3">
              <h3 className={`${sectionCap} shrink-0`}>Co jadłem</h3>
              <div className="flex gap-1">
                {(["day", "cal"] as const).map((mde) => (
                  <button
                    key={mde}
                    type="button"
                    onClick={() => setFoodView(mde)}
                    className={`${pill} px-4 ${
                      foodView === mde
                        ? "border-[#EF9F27]/55 bg-[#EF9F27]/14 text-[#fff3e8]"
                        : "!border-[#333]"
                    }`}
                  >
                    {mde === "day" ? "Dzień" : "Kalendarz"}
                  </button>
                ))}
              </div>
            </div>

            {foodView === "day" ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-2 text-white hover:border-white/28"
                    onClick={() => shiftFoodDay(-1)}
                  >
                    ‹
                  </button>
                  <p className="text-xs capitalize opacity-65">
                    {parseDateKey(dayPick).toLocaleDateString("pl-PL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <button
                    type="button"
                    className="rounded-[10px] border border-[#333] bg-[#151515] px-3 py-2 text-white hover:border-white/28"
                    onClick={() => shiftFoodDay(1)}
                  >
                    ›
                  </button>
                </div>
                <table className="w-full border-collapse overflow-hidden rounded-[10px] border border-[#333] text-sm">
                  <thead className="bg-[#151515]">
                    <tr className="text-left text-[10px] uppercase text-white/42">
                      <th className="px-3 py-2">Nazwa</th>
                      <th className="px-3 py-2">kcal</th>
                      <th className="px-3 py-2">B</th>
                      <th className="px-3 py-2">W</th>
                      <th className="px-3 py-2">T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mealsDay.map((mv) => (
                      <tr key={mv.id} className="border-t border-[#333]">
                        <td className="max-w-[90px] truncate px-3 py-2">{mv.label}</td>
                        <td className="px-3 py-2">{mv.calories}</td>
                        <td className="px-3 py-2">{mv.protein_g}</td>
                        <td className="px-3 py-2">{mv.carbs_g}</td>
                        <td className="px-3 py-2">{mv.fat_g}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-right text-sm font-bold text-[#EF9F27]">
                  Razem:{""}
                  {mealsDay.reduce((s, m3) => s + m3.calories, 0)} kcal
                </p>
              </>
            ) : (
              <FoodCal
                month={calMonth}
                setMonth={setCalMonth}
                picked={dayPick}
                onPick={setDayPick}
              />
            )}
          </section>
        </div>
      ) : (
        <WeightBodyPane
          wRange={wRange}
          setWRange={setWRange}
          wm={wm}
          setWm={setWeightMetric}
          wInp={wInp}
          setWInp={setWInp}
          fatInp={fatInp}
          setFatInp={setFatInp}
          musInp={musInp}
          setMusInp={setMusInp}
          saveMeasures={saveMeasures}
          weightSeriesRaw={weightSeriesRaw}
          cards={cards}
        />
      )}
    </div>
  );
}