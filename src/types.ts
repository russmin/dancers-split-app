export type WorkoutMode = "standard" | "timed" | "circuit";

export interface WorkoutEntry {
  id: string;
  date: string;
  name: string;
  sets: number;         // for timed we keep sets=1
  reps: number;         // for timed we store seconds in reps
  weightKg?: number;
  notes?: string;
  isPRMaxWeight?: boolean;
  isPRVolume?: boolean;
}
export interface SetEntry {
  reps: number | "";
  weight: number | "";
  suggestedReps?: number;
  suggestedWeight?: number;
}

export interface SessionExercise {
  name: string;
  mode: Exclude<WorkoutMode, "circuit">;
  sets?: SetEntry[];
  seconds?: number | "";
  restSec?: number;
}


export interface CircuitSpec {
  mode: "circuit";
  name: string;                         // e.g., "Full-Body Circuit"
  rounds: number;                       // e.g., 3
  stationRestSec: number;               // rest between stations
  roundRestSec?: number;                // rest between rounds (optional)
  stations: { label: string; seconds: number }[];
}
