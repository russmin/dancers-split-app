/**
 * Converters between workout library format and App.tsx format
 */

import {
  WorkoutPlan,
  Workout,
  Exercise,
  populatePlanDays,
  populateWorkoutExercises,
} from "./workoutLibrary";
import { CircuitSpec } from "@/components/CircuitRunner";

/**
 * Old format used by App.tsx (for backwards compatibility)
 */
export interface LegacyPlanDay {
  day: number;
  title: string;
  exercises: string[];
}

/**
 * Convert library workout plan to legacy format for App.tsx
 */
export function planToLegacyFormat(
  plan: WorkoutPlan,
  workouts: Workout[],
  exercises: Exercise[]
): LegacyPlanDay[] {
  const populated = populatePlanDays(plan, workouts, exercises);

  return populated.days.map((day) => {
    const workout = day.workout;
    if (!workout) {
      return {
        day: day.day,
        title: day.title,
        exercises: [],
      };
    }

    const populatedWorkout = populateWorkoutExercises(workout, exercises);

    // Convert exercises to string format
    const exerciseStrings = populatedWorkout.exercises.map((we) => {
      const ex = we.exercise;
      if (!ex) return `${we.exerciseId} (missing)`;

      if (workout.mode === "circuit") {
        // Circuit format: "Exercise Name: 45s"
        if (we.circuitSeconds) {
          return `${ex.name}: ${we.circuitSeconds}s`;
        }
        // For exercises with reps in circuit
        if (we.repRange) {
          return `${ex.name}: ${we.repRange[0]}-${we.repRange[1]} reps`;
        }
        return ex.name;
      }

      // Sets/reps format: "Exercise Name: 4x6-8 (2-3 min rest)"
      const sets = we.sets ?? ex.defaultSets ?? 3;
      let exerciseStr = `${ex.name}: ${sets}x`;

      if (we.repRange) {
        exerciseStr += `${we.repRange[0]}-${we.repRange[1]}`;
      } else if (we.reps) {
        exerciseStr += String(we.reps);
      } else if (ex.defaultRepRange) {
        exerciseStr += `${ex.defaultRepRange[0]}-${ex.defaultRepRange[1]}`;
      } else {
        exerciseStr += "10-12";
      }

      // Add rest time
      const restSec = we.restSec ?? ex.defaultRestSec;
      if (restSec !== undefined) {
        if (restSec >= 120) {
          const min = Math.floor(restSec / 60);
          const minRange = restSec >= 150 ? "2-3" : `${min}`;
          exerciseStr += ` (${minRange} min rest)`;
        } else if (restSec > 0) {
          exerciseStr += ` (${restSec}s rest)`;
        } else {
          exerciseStr += " (No rest between sides)";
        }
      }

      // Add timed indicator
      if (we.seconds || ex.isTimed) {
        exerciseStr += ` — ${we.seconds ?? ex.defaultSeconds ?? 30}s hold`;
      }

      return exerciseStr;
    });

    // Add circuit header if needed
    if (workout.mode === "circuit") {
      return {
        day: day.day,
        title: day.title,
        exercises: [
          `Format: ${workout.rounds ?? 3} rounds. Rest ${
            workout.roundRestSec ?? 60
          }-${(workout.roundRestSec ?? 60) + 30} sec after completing the entire circuit.`,
          ...exerciseStrings,
        ],
      };
    }

    return {
      day: day.day,
      title: day.title,
      exercises: [...exerciseStrings], // Ensure mutable array
    };
  });
}

/**
 * Convert library workout to CircuitSpec for CircuitRunner
 */
export function workoutToCircuitSpec(
  workout: Workout,
  exercises: Exercise[]
): CircuitSpec | null {
  if (workout.mode !== "circuit") return null;

  const populated = populateWorkoutExercises(workout, exercises);

  const stations = populated.exercises
    .filter((we) => we.circuitSeconds || we.exercise?.isTimed)
    .map((we) => ({
      label: we.exercise?.name ?? we.exerciseId,
      seconds: we.circuitSeconds ?? we.exercise?.defaultSeconds ?? 45,
    }));

  return {
    mode: "circuit",
    name: workout.name,
    rounds: workout.rounds ?? 3,
    stationRestSec: workout.stationRestSec ?? 30,
    roundRestSec: workout.roundRestSec ?? 60,
    stations,
  };
}

