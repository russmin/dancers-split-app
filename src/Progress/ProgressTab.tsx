// components/ProgressTab.tsx
import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ProgressChart from "./ProgressChart";
import WeeklyWorkoutLog from "./WeeklyWorkoutLog";
import { aggregatePRsByWeek } from "@/lib/utils";
import { WorkoutEntry } from "@/components/WorkoutLogTable";

interface ProgressTabProps {
  workouts: WorkoutEntry[];
  unit: "kg" | "lb";
  exerciseFilter: string;
  setExerciseFilter: (value: string) => void;
  uniqueExercises: string[];
}

export default function ProgressTab({
  workouts,
  unit,
  exerciseFilter,
  setExerciseFilter,
  uniqueExercises,
}: ProgressTabProps) {
  // Aggregate all PRs by week and exercise
  const weeklyData = useMemo(() => aggregatePRsByWeek(workouts), [workouts]);
  type WeeklyPR = {
    week: string;
    maxVolume?: number;
    maxWeight?: number;
  };

  const selectedData: WeeklyPR[] = useMemo(() => {
    if (exerciseFilter === "__all") return [];
    return weeklyData[exerciseFilter] ?? [];
  }, [weeklyData, exerciseFilter]);

  return (
    <>
      <Card className="rounded-2xl shadow-sm mb-6">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg">Progress (Weekly PRs)</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Label className="mr-1">Exercise</Label>
            <Select value={exerciseFilter} onValueChange={setExerciseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All exercises" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All exercises</SelectItem>
                {uniqueExercises.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-64 w-full">
            {selectedData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-slate-500">
                No data yet — add a workout to see progress.
              </div>
            ) : (
              <ProgressChart
                data={selectedData.map((d) => ({
                  week: d.week,
                  volume: d.maxVolume ?? 0,
                  weight: d.maxWeight ?? 0,
                }))}
                unit={unit}
              />

            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Tracks your highest recorded volume and weight each week ({unit}).
          </p>
        </CardContent>
      </Card>

      <WeeklyWorkoutLog workouts={workouts} unit={unit} />
    </>
  );
}
