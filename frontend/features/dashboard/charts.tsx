"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fa } from "@shared/utils";

export function SalesChart({ points, comparison = true }: { points: Array<{ date: string; amount: number; previous?: number }>; comparison?: boolean }) {
  const fill = useId().replace(/[^a-z0-9-]/gi, "");
  return <div className="sales-chart" dir="ltr" aria-label="نمودار روند فروش بر حسب میلیون تومان">
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 520, height: 191 }}>
      <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 1, left: 3 }} accessibilityLayer>
        <defs><linearGradient id={fill} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.20} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.025} /></linearGradient></defs>
        <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="date" reversed tickLine={false} axisLine={false} minTickGap={28} tickMargin={10} tick={{ fill: "var(--muted)", fontSize: 10 }} />
        <YAxis orientation="right" width={42} tickLine={false} axisLine={false} tickMargin={7} tickCount={5} tickFormatter={fa} tick={{ fill: "var(--muted)", fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, direction: "rtl", fontSize: 12, color: "var(--text)" }} itemStyle={{ color: "var(--text)" }} formatter={(value) => fa(Number(value)) + " میلیون تومان"} />
        {comparison && <Area dataKey="previous" name="بازهٔ قبل" type="monotone" stroke="var(--subtle)" strokeWidth={1.3} strokeDasharray="4 4" fill="transparent" isAnimationActive={false} dot={false} />}
        <Area dataKey="amount" name="فروش" type="monotone" stroke="var(--primary)" strokeWidth={2.5} fill={"url(#" + fill + ")"} isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--primary)" }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
