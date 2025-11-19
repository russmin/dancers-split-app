/**
 * Default workouts and plan based on the original Dancer's Split
 */

import { Workout, WorkoutExercise, WorkoutPlan, WorkoutDay, generateId } from "./workoutLibrary";
import { createDefaultExercises } from "./defaultExercises";

/**
 * Create default workouts from exercises
 */
export function createDefaultWorkouts(exercises: ReturnType<typeof createDefaultExercises>): Workout[] {
  const getExercise = (name: string) => exercises.find((e) => e.name === name);

  return [
    // Day 1 - Lower Body Strength & Stability
    {
      id: generateId(),
      name: "Lower Body Strength & Stability",
      description: "Day 1 workout focusing on lower body strength and stability",
      mode: "sets-reps",
      exercises: [
        {
          exerciseId: getExercise("Leg Press (Bilateral)")!.id,
          sets: 4,
          repRange: [6, 8],
          restSec: 150,
        },
        {
          exerciseId: getExercise("Bulgarian Split Squats")!.id,
          sets: 3,
          repRange: [8, 10],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Romanian Deadlifts")!.id,
          sets: 3,
          repRange: [8, 10],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Single-Leg Leg Curl")!.id,
          sets: 3,
          repRange: [8, 10],
          restSec: 60,
        },
        {
          exerciseId: getExercise("Pallof Press")!.id,
          sets: 3,
          repRange: [10, 12],
          restSec: 60,
        },
        {
          exerciseId: getExercise("Deep Goblet Squat Hold (Kettlebell)")!.id,
          sets: 3,
          seconds: 30,
          restSec: 60,
        },
        {
          exerciseId: getExercise("Standing Calf Raises")!.id,
          sets: 4,
          repRange: [12, 15],
          restSec: 45,
        },
      ],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },

    // Day 2 - Upper Body Strength & Posture
    {
      id: generateId(),
      name: "Upper Body Strength & Posture",
      description: "Day 2 workout focusing on upper body strength and posture",
      mode: "sets-reps",
      exercises: [
        {
          exerciseId: getExercise("Lat Pulldown (Wide Grip)")!.id,
          sets: 4,
          repRange: [10, 12],
          restSec: 150,
        },
        {
          exerciseId: getExercise("Seated Row (Neutral Grip)")!.id,
          sets: 3,
          repRange: [12, 15],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Smith Machine Overhead Press")!.id,
          sets: 3,
          repRange: [6, 8],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Incline Dumbbell Press")!.id,
          sets: 3,
          repRange: [8, 10],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Cable Face Pulls")!.id,
          sets: 3,
          repRange: [12, 15],
          restSec: 60,
        },
        {
          exerciseId: getExercise("Assisted Dips")!.id,
          sets: 3,
          restSec: 60,
          notes: "To failure",
        },
        {
          exerciseId: getExercise("Suitcase Carry")!.id,
          sets: 2,
          seconds: 30,
          restSec: 0,
        },
      ],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },

    // Day 3 - Full-Body Power & Endurance (Circuit)
    {
      id: generateId(),
      name: "Full-Body Power & Endurance (Circuit)",
      description: "Day 3 circuit workout for full-body power and endurance",
      mode: "circuit",
      rounds: 3,
      stationRestSec: 30,
      roundRestSec: 60,
      exercises: [
        {
          exerciseId: getExercise("Kettlebell Swings")!.id,
          circuitSeconds: 45,
        },
        {
          exerciseId: getExercise("Box Jumps")!.id,
          circuitSeconds: 45,
        },
        {
          exerciseId: getExercise("Push-Ups")!.id,
          circuitSeconds: 45,
        },
        {
          exerciseId: getExercise("Single-Leg RDL (Bodyweight)")!.id,
          circuitSeconds: 45,
        },
        {
          exerciseId: getExercise("Bird Dog Crunch")!.id,
          repRange: [10, 12],
        },
        {
          exerciseId: getExercise("Plank")!.id,
          circuitSeconds: 60,
        },
      ],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },

    // Day 4 - Dance-Specific Power & Plyometrics
    {
      id: generateId(),
      name: "Dance-Specific Power & Plyometrics",
      description: "Day 4 workout focusing on dance-specific movements and plyometrics",
      mode: "sets-reps",
      exercises: [
        {
          exerciseId: getExercise("Depth Drops to Stick Landing")!.id,
          sets: 3,
          repRange: [5, 5],
          restSec: 150,
        },
        {
          exerciseId: getExercise("Lateral Skater Jumps")!.id,
          sets: 3,
          repRange: [8, 8],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Single-Leg Box Jumps")!.id,
          sets: 3,
          repRange: [5, 5],
          restSec: 90,
        },
        {
          exerciseId: getExercise("Copenhagen Planks")!.id,
          sets: 3,
          repRange: [8, 10],
          restSec: 60,
        },
        {
          exerciseId: getExercise("Band-Resisted Ankle Jumps")!.id,
          sets: 3,
          repRange: [15, 15],
          restSec: 60,
        },
        {
          exerciseId: getExercise("Deep Goblet Squat Hold (Kettlebell)")!.id,
          sets: 2,
          seconds: 30,
          restSec: 60,
        },
      ],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
  ];
}

/**
 * Create default workout plan
 */
export function createDefaultPlan(
  workouts: Workout[]
): WorkoutPlan {
  return {
    id: generateId(),
    name: "Final 4-Day Dancer's Split",
    description: "A 4-day split designed for dancers focusing on strength, stability, and dance-specific movements",
    durationWeeks: 12,
    daysPerWeek: 4,
    days: [
      {
        day: 1,
        title: "Lower Body Strength & Stability",
        workoutId: workouts[0]?.id ?? "",
      },
      {
        day: 2,
        title: "Upper Body Strength & Posture",
        workoutId: workouts[1]?.id ?? "",
      },
      {
        day: 3,
        title: "Full-Body Power & Endurance (Circuit)",
        workoutId: workouts[2]?.id ?? "",
      },
      {
        day: 4,
        title: "Dance-Specific Power & Plyometrics",
        workoutId: workouts[3]?.id ?? "",
      },
    ],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };
}

/**
 * Initialize library with default data if empty
 */
export function initializeLibrary(): {
  exercises: ReturnType<typeof createDefaultExercises>;
  workouts: Workout[];
  plan: WorkoutPlan;
} {
  const exercises = createDefaultExercises();
  const workouts = createDefaultWorkouts(exercises);
  const plan = createDefaultPlan(workouts);

  return { exercises, workouts, plan };
}

