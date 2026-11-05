"use client";
// Loaded lazily (next/dynamic) so Recharts stays out of the first-load bundle.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { stroke: "#7f7499", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "#2f2750", strokeDasharray: "2 4", vertical: false } as const;
const TOOLTIP = {
  contentStyle: { background: "#221b3c", border: "1px solid #2f2750", borderRadius: 12, color: "#f5ede4", fontSize: 12 },
  labelStyle: { color: "#b7abc8" },
  itemStyle: { color: "#f5ede4" },
  cursor: { fill: "#ffffff0d", stroke: "#7f7499", strokeWidth: 1 },
} as const;

export function CycleLengthChart({ data, avg }: { data: { label: string; days: number }[]; avg: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} domain={[0, (max: number) => Math.max(40, max + 4)]} allowDecimals={false} />
        <Tooltip {...TOOLTIP} formatter={(v) => [`${v} days`, "Cycle length"]} />
        <ReferenceLine y={avg} stroke="#b7abc8" strokeDasharray="4 4" label={{ value: `avg ${avg}`, fill: "#b7abc8", fontSize: 11, position: "insideTopRight" }} />
        <Bar dataKey="days" fill="#ec7c8e" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SymptomChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" {...AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="name" {...AXIS} width={110} tick={{ fill: "#b7abc8", fontSize: 12 }} />
        <Tooltip {...TOOLTIP} formatter={(v) => [`${v} days`, "Logged"]} />
        <Bar dataKey="count" fill="#f2a65a" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SleepChart({ data }: { data: { label: string; hours: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} minTickGap={24} />
        <YAxis {...AXIS} domain={[0, 12]} />
        <Tooltip {...TOOLTIP} formatter={(v) => [`${v} h`, "Sleep"]} />
        <Line type="monotone" dataKey="hours" stroke="#a993f7" strokeWidth={2} dot={{ r: 3, fill: "#a993f7", stroke: "#1a1530", strokeWidth: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
