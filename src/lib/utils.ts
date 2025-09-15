import { type ClassValue } from "clsx"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"
import type { WorkoutEntry } from "@/components/WorkoutLogTable";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function fromKg(kg: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? kg : kg / 0.453592;
}
export interface WeeklyPR {
  week: string; // formatted like "2025-W37"
  volume: number;
  weight: number;
}

export function aggregatePRsByWeek(
  workouts: WorkoutEntry[]
): Record<string, WeeklyPR[]> {
  const grouped: Record<string, Record<string, WeeklyPR>> = {};

  for (const workout of workouts) {
    if (!workout.name || workout.reps === undefined || !workout.sets) continue;

    const week = getWeekLabel(workout.date);
    const exercise = workout.name;
    const weight = workout.weightKg ?? 0;
    const reps = workout.reps ?? 0;
    const sets = workout.sets ?? 0;
    const volume = weight * reps * sets;

    if (!grouped[exercise]) grouped[exercise] = {};
    if (!grouped[exercise][week]) {
      grouped[exercise][week] = {
        week,
        volume,
        weight,
      };
    } else {
      grouped[exercise][week].volume = Math.max(
        grouped[exercise][week].volume,
        volume
      );
      grouped[exercise][week].weight = Math.max(
        grouped[exercise][week].weight,
        weight
      );
    }
  }

  // Convert to array
  const result: Record<string, WeeklyPR[]> = {};
  for (const exercise in grouped) {
    result[exercise] = Object.values(grouped[exercise]).sort((a, b) =>
      a.week.localeCompare(b.week)
    );
  }

  return result;
}

function getWeekLabel(dateString: string): string {
  const d = new Date(dateString);
  const first = d.getDate() - d.getDay(); // Sunday as start
  const sunday = new Date(d.setDate(first));
  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, "0");
  const day = String(sunday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}