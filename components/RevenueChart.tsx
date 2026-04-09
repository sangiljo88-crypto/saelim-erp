"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface DataPoint {
  month: string;
  actual: number;
  target: number;
}

function formatBillions(val: number) {
  return `${(val / 100_000_000).toFixed(1)}억`;
}

export default function RevenueChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1F3864" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#1F3864" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00B050" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#00B050" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={formatBillions} tick={{ fontSize: 11 }} width={55} />
        <Tooltip formatter={(value) => typeof value === "number" ? formatBillions(value) : value} />
        <Legend />
        <Area type="monotone" dataKey="target" name="목표" stroke="#00B050" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorTarget)" />
        <Area type="monotone" dataKey="actual" name="실적" stroke="#1F3864" strokeWidth={2.5} fill="url(#colorActual)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
