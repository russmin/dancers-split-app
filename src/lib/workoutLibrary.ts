/**
 * Workout Library System
 * 
 * Defines types and utilities for managing exercises and workouts
 */

export type ExerciseCategory =
  | "strength"
  | "cardio"
  | "mobility"
  | "plyometric"
  | "core"
  | "dance-specific"
  | "other";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "glutes"
  | "core"
  | "full-body"
  | "calves"
  | "hamstrings"
  | "quads";

export type WorkoutMode = "sets-reps" | "timed" | "circuit";

/**
 * Base exercise definition stored in library
 */
export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroups: MuscleGroup[];
  equipment?: string[];
  notes?: string;
  defaultRepRange?: [number, number]; // [min, max] reps
  defaultSets?: number;
  defaultRestSec?: number;
  isTimed?: boolean; // true for exercises that are typically time-based
  defaultSeconds?: number; // for timed exercises
}

/**
 * Exercise as used in a workout (includes workout-specific parameters)
 */
export interface WorkoutExercise {
  exerciseId: string; // references Exercise.id
  exercise?: Exercise; // populated when loading
  // For sets/reps mode
  sets?: number;
  reps?: number; // single value or target
  repRange?: [number, number]; // [min, max]
  weight?: number; // optional
  restSec?: number;
  // For timed mode
  seconds?: number;
  rounds?: number; // for timed exercises that repeat
  // For circuit mode
  circuitSeconds?: number;
  // Notes for this specific workout
  notes?: string;
}

/**
 * A complete workout definition
 */
export interface Workout {
  id: string;
  name: string;
  description?: string;
  mode: WorkoutMode;
  exercises: WorkoutExercise[];
  // For circuit mode
  rounds?: number;
  stationRestSec?: number;
  roundRestSec?: number;
  // Metadata
  created?: string; // ISO date
  updated?: string; // ISO date
}

/**
 * A workout plan (collection of workouts organized by days)
 */
export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  days: WorkoutDay[];
  // Program metadata
  durationWeeks?: number;
  daysPerWeek?: number;
  startDate?: string; // ISO date - when the plan was started/activated
  created?: string; // ISO date
  updated?: string; // ISO date
}

/**
 * A day in a workout plan
 */
export interface WorkoutDay {
  day: number; // 1, 2, 3, etc.
  title: string;
  workoutId: string; // references Workout.id
  workout?: Workout; // populated when loading
}

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  exercises: "wt_exercises_v1",
  workouts: "wt_workouts_v1",
  plans: "wt_plans_v1",
} as const;

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/**
 * Load exercises from localStorage
 */
export function loadExercises(): Exercise[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.exercises);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save exercises to localStorage
 */
export function saveExercises(exercises: Exercise[]): void {
  localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(exercises));
}

/**
 * Load workouts from localStorage
 */
export function loadWorkouts(): Workout[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.workouts);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save workouts to localStorage
 */
export function saveWorkouts(workouts: Workout[]): void {
  localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(workouts));
}

/**
 * Load workout plans from localStorage
 */
export function loadPlans(): WorkoutPlan[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.plans);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save workout plans to localStorage
 */
export function savePlans(plans: WorkoutPlan[]): void {
  localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(plans));
}

/**
 * Populate workout exercises with full exercise data
 */
export function populateWorkoutExercises(
  workout: Workout,
  exercises: Exercise[]
): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((we) => ({
      ...we,
      exercise: exercises.find((e) => e.id === we.exerciseId),
    })),
  };
}

/**
 * Populate plan days with full workout data
 */
export function populatePlanDays(
  plan: WorkoutPlan,
  workouts: Workout[],
  exercises: Exercise[]
): WorkoutPlan {
  return {
    ...plan,
    days: plan.days.map((day) => {
      const workout = workouts.find((w) => w.id === day.workoutId);
      return {
        ...day,
        workout: workout
          ? populateWorkoutExercises(workout, exercises)
          : undefined,
      };
    }),
  };
}

