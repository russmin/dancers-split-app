import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fromKg } from "@/lib/utils";

interface ProgressChartProps {
  data: { week: string; volume: number; weight: number }[];
  unit: "kg" | "lb";
}

export default function ProgressChart({ data, unit }: ProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: any, name: string) => {
            const label = name === "volume" ? "Max Volume" : "Max Weight";
            const displayValue =
              unit === "kg" ? value : Math.round(fromKg(value, unit) * 10) / 10;
            return [displayValue, `${label} (${unit})`];
          }}
          labelClassName="text-xs"
        />
        <Line
          type="monotone"
          dataKey="volume"
          stroke="#8884d8"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#82ca9d"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
