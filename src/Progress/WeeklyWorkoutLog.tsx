import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkoutEntry } from "@/components/WorkoutLogTable";



interface Props {
  workouts: WorkoutEntry[];
  unit: "kg" | "lb";
}

function groupByWeek(workouts: WorkoutEntry[]) {
  const byWeek: Record<string, WorkoutEntry[]> = {};

  workouts.forEach((w) => {
    const date = new Date(w.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Sunday start
    const key = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(w);
  });

  return byWeek;
}

export default function WeeklyWorkoutLog({ workouts, unit }: Props) {
  const grouped = useMemo(() => groupByWeek(workouts), [workouts]);
  const weekKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // newest first
  const [activeWeek, setActiveWeek] = useState<string>(weekKeys[0]);
  
  const display = grouped[activeWeek] ?? [];

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle className="text-lg">Weekly Log</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          <Select value={activeWeek} onValueChange={(v) => setActiveWeek(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weekKeys.map((k, i) => (
                <SelectItem key={k} value={k}>
                  Week {weekKeys.length - i} ({k})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {display.length === 0 ? (
          <div className="text-sm text-slate-500">No workouts logged this week.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Exercise</th>
                  <th className="py-2 pr-4">Sets</th>
                  <th className="py-2 pr-4">Reps</th>
                  <th className="py-2 pr-4">Weight ({unit})</th>
                </tr>
              </thead>
              <tbody>
                {display.map((w) => (
                  <tr key={w.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{w.date}</td>
                    <td className="py-2 pr-4">{w.name}</td>
                    <td className="py-2 pr-4">{w.sets}</td>
                    <td className="py-2 pr-4">{w.reps}</td>
                    <td className="py-2 pr-4">
                      {w.weightKg
                        ? unit === "kg"
                          ? Math.round(w.weightKg)
                          : Math.round(w.weightKg / 0.45359237)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
