import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ProgressChart from "./Progress/ProgressChart";
import ProfileTab from "@/components/ProfileTab";
import PlanTab from "@/components/PlanTab";
import ProgressTab from "./Progress/ProgressTab";
import CircuitRunner, { type CircuitSpec } from "@/components/CircuitRunner";
import WeeklyWorkoutLog from "@/Progress/WeeklyWorkoutLog";
import LibraryTab from "@/components/LibraryTab";
import WorkoutPreview from "@/components/WorkoutPreview";

import { markPRsBeforeInsert } from "@/lib/pr";
// If you keep a manual-log picker you can re-enable this import.
import { EXERCISES } from "@/lib/exercises";
import {
  Exercise,
  Workout,
  WorkoutPlan,
  loadExercises,
  loadWorkouts,
  loadPlans,
  saveExercises,
  saveWorkouts,
  savePlans,
  populatePlanDays,
  populateWorkoutExercises,
} from "@/lib/workoutLibrary";
import { initializeLibrary } from "@/lib/defaultWorkouts";
import { planToLegacyFormat, workoutToCircuitSpec } from "@/lib/workoutConverters";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";

/* --------------------------------------------
   Types
---------------------------------------------*/
type SessionMode = "sets" | "circuit";

interface UserProfile {
  name: string;
  age?: number | "";
  heightCm?: number | "";
  weightKg?: number | "";
  goal?: "strength" | "hypertrophy" | "endurance" | "general" | "";
  unit?: "kg" | "lb";
  // Program fields
  programName?: string;
  programDurationWeeks?: number | "";
  daysPerWeek?: number | "";
  preferredDays?: string[]; // Mon..Sun
  programStartDate?: string; // YYYY-MM-DD
}

interface WorkoutEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // exercise name
  sets: number; // per-set logs will be 1
  reps: number; // per-set reps OR seconds for timed entries
  weightKg?: number; // stored in kg
  notes?: string;
}

/* --------------------------------------------
   Constants & helpers
---------------------------------------------*/
const STORAGE_KEYS = {
  profile: "wt_profile_v5",
  workouts: "wt_workouts_v5",
} as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

const KG_PER_LB = 0.45359237;
function toKg(value: number, unit: "kg" | "lb") {
  return unit === "lb" ? value * KG_PER_LB : value;
}
function fromKg(kg: number, unit: "kg" | "lb") {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}
// ---- Progressive Overload helpers ----
const PO_INCR = { kg: 2.5, lb: 5 }; // +2.5kg or +5lb

function isTimedName(name: string) {
  return /\(sec\)\s*$/.test(name);
}
function getTargetRepRangeForExercise(name: string): [number, number] | null {
  const match = name.match(/(\d+)\s*-\s*(\d+)/);
  if (match) return [Number(match[1]), Number(match[2])];
  return null;
}
function extractRepRangeFromName(name: string): [number, number] {
  const match = name.match(/(\d+)\s*-\s*(\d+)/); // matches "10-12"
  if (match) return [Number(match[1]), Number(match[2])];
  const single = name.match(/(\d+)\s*reps?/i);
  if (single) {
    const val = Number(single[1]);
    return [val, val]; // fallback to fixed
  }
  return [10, 12]; // default range
}
function getISOWeekString(dateStr: string) {
  const date = new Date(dateStr);
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  // Set to nearest Thursday: current date + 4 - current day number
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tempDate.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}
interface WeeklyPR {
  week: string;
  weight: number;
  reps: number;
}

function aggregatePRsByWeek(workouts: WorkoutEntry[]): Record<string, WeeklyPR[]> {
  const byWeek: Record<string, Record<string, WeeklyPR>> = {};

  for (const entry of workouts) {
    const week = getISOWeekString(entry.date);
    const exercise = entry.name;
    const weight = entry.weightKg ?? 0;
    const reps = entry.reps ?? 0;

    if (!byWeek[week]) byWeek[week] = {};
    if (!byWeek[week][exercise]) {
      byWeek[week][exercise] = { week, weight, reps };
    } else {
      const existing = byWeek[week][exercise];
      if (weight > existing.weight || (weight === existing.weight && reps > existing.reps)) {
        byWeek[week][exercise] = { week, weight, reps };
      }
    }
  }

  // Transform into: { "Bench Press": [ {week, weight, reps}, ... ] }
  const result: Record<string, WeeklyPR[]> = {};
  for (const week in byWeek) {
    for (const exercise in byWeek[week]) {
      if (!result[exercise]) result[exercise] = [];
      result[exercise].push(byWeek[week][exercise]);
    }
  }

  // Sort each exercise’s PRs by week
  for (const ex in result) {
    result[ex].sort((a, b) => a.week.localeCompare(b.week));
  }

  return result;
}

/** Return the most recent non-timed entry for the exact exercise name */
function lastEntryFor(workouts: WorkoutEntry[], name: string): WorkoutEntry | undefined {
  // your list is newest-first after saves, but be safe and sort by date desc then by array order
  const filtered = workouts.filter(w => w.name === name && !isTimedName(w.name));
  if (filtered.length === 0) return undefined;
  // assume the first is newest because you prepend on save
  return filtered[0];
}

/** Round to a sensible display for the UI */
function roundDisplayUnit(n: number, unit: "kg" | "lb") {
  // kg: 0.5 step, lb: 1 step (tweak if you want)
  const step = unit === "kg" ? 0.5 : 1;
  return Math.round(n / step) * step;
}

/* --------------------------------------------
   Workout Library Integration
---------------------------------------------*/

/* --------------------------------------------
   Plan parsing helpers
---------------------------------------------*/
function extractRestSeconds(source: string): number | undefined {
  const paren = source.match(/\(([^)]*?)\)/g);
  if (!paren) return undefined;
  const restChunk = paren.find((p) => /rest/i.test(p));
  if (!restChunk) return undefined;

  const minRange = restChunk.match(/(\d+)\s*-\s*(\d+)\s*min/i);
  if (minRange) {
    const a = Number(minRange[1]),
      b = Number(minRange[2]);
    return Math.round(((a + b) / 2) * 60);
  }
  const minOnly = restChunk.match(/(\d+)\s*min/i);
  if (minOnly) return Number(minOnly[1]) * 60;

  const sec = restChunk.match(/(\d+)\s*(s|sec|secs|second|seconds)/i);
  if (sec) return Number(sec[1]);

  return undefined;
}

function parseSetsAndReps(ex: string) {
  const head = ex.split("(")[0];

  const m = head.match(/(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i);
  if (m) {
    const sets = Number(m[1]);
    const repMin = Number(m[2]);
    const repMax = m[3] ? Number(m[3]) : repMin;
    return { sets, reps: repMin, repMin, repMax, timed: false as const };
  }

  const t = head.match(/(\d+)\s*(s|sec|secs|second|seconds)/i);
  if (t) return { sets: 1, reps: 0, timed: true as const, seconds: Number(t[1]) };

  return { sets: 3, reps: 10, repMin: 10, repMax: 10, timed: false as const };
}
function getProgressiveTarget({
  lastReps,
  lastWeight,
  repMin,
  repMax,
}: {
  lastReps: number;
  lastWeight: number;
  repMin: number;
  repMax: number;
}) {
  if (lastReps < repMax) {
    return { reps: lastReps + 1, weight: lastWeight };
  } else {
    return { reps: repMin, weight: Math.round((lastWeight + 5) * 10) / 10 };
  }
}

function day3ToCircuit(): CircuitSpec {
  const base = [
    { label: "Kettlebell Swings", seconds: 45 },
    { label: "Box/Broad Jumps", seconds: 45 },
    { label: "Push-Ups", seconds: 45 },
    { label: "Single-Leg RDL (BW)", seconds: 45 },
    { label: "Bird Dog Crunch", seconds: 45 },
    { label: "Plank", seconds: 60 },
  ];
  return {
    mode: "circuit",
    name: "Full-Body Circuit",
    rounds: 3,
    stationRestSec: 30,
    roundRestSec: 60,
    stations: base,
  };
}
function getLastWorkoutFor(name: string, logs: WorkoutEntry[]) {
  const filtered = logs.filter(w => w.name === name && typeof w.reps === "number" && w.reps > 0);
  if (filtered.length === 0) return null;

  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

/* --------------------------------------------
   Rest Timer (for sets/reps flow)
---------------------------------------------*/
function RestTimer({
  seconds = 90,
  startSignal = 0,
  onDone,
}: {
  seconds?: number;
  startSignal?: number;
  onDone?: () => void;
}) {
  const [remaining, setRemaining] = React.useState<number>(seconds);
  const [running, setRunning] = React.useState<boolean>(false);

  React.useEffect(() => {
    setRemaining(seconds);
    setRunning(true);
  }, [startSignal, seconds]);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);

          // --- HAPTIC (mobile-safe no-op on desktop)
          try {
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              // light buzz
              (navigator as any).vibrate?.(150);
            }
          } catch {}

          // --- BEEP (very short)
          try {
            const AudioCtx =
              (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;   // A5-ish
              gain.gain.value = 0.04;      // quiet
              osc.start();
              setTimeout(() => {
                osc.stop();
                ctx.close?.();
              }, 180);
            }
          } catch {}

          onDone?.();          // advance your flow
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onDone]);

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="font-mono">{fmt(remaining)}</div>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setRunning((r) => !r)}>
        {running ? "Pause" : "Start"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl"
        onClick={() => {
          setRunning(false);
          setRemaining(seconds);
        }}
      >
        Reset
      </Button>
    </div>
  );
}


/* --------------------------------------------
   Main Component
---------------------------------------------*/
export default function DancerSplitTracker() {
  // Workout Library State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutLibrary, setWorkoutLibrary] = useState<Workout[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  
  // Legacy format for backwards compatibility
  const [dancerSplit, setDancerSplit] = useState<Array<{
    day: number;
    title: string;
    exercises: string[];
  }>>([]);

  // Profile & Units
  const [autoRest, setAutoRest] = useState(true);
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    age: "",
    heightCm: "",
    weightKg: "",
    goal: "",
    unit: "kg",
    programName: "Final 4-Day Dancer's Split",
    programDurationWeeks: 12,
    daysPerWeek: 4,
    preferredDays: ["Mon", "Tue", "Thu", "Sat"],
    programStartDate: todayISO(),
  });

  // Workouts (log)
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  // state

 
  // Manual log form
  const [wDate, setWDate] = useState<string>(todayISO());
  const [wName, setWName] = useState<string>("");
  const [wExerciseId, setWExerciseId] = useState<string>(""); // Selected exercise ID from library
  const [wOpenEntry, setWOpenEntry] = useState<boolean>(false); // Use open entry (not from library)
  const [wSets, setWSets] = useState<string>("3");
  const [wReps, setWReps] = useState<string>("10");
  const [wWeight, setWWeight] = useState<string>("");
  const [wNotes, setWNotes] = useState<string>("");
  const [wType, setWType] = useState<"sets" | "timed">("sets");
  const [wSeconds, setWSeconds] = useState<string>("");
  // Session runner state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>("sets");
  const [sessionDay, setSessionDay] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>(todayISO());
  const [sessionIdx, setSessionIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [restStartSignal, setRestStartSignal] = useState(0);
  const [circuitSpec, setCircuitSpec] = useState<CircuitSpec | null>(null);
  const [circuitManual, setCircuitManual] = useState<
    { reps?: number | ""; weight?: number | "" }[]
  >([]);
  const [sessionPlan, setSessionPlan] = useState<{
    name: string;
    sets: {
      reps: number | "";
      weight: number | "";
      suggestedReps?: number;
      suggestedWeight?: number;
    }[];
    timed?: boolean;
    seconds?: number | "";
    restSec?: number;
    rounds?: number;
    reps?: number | "";
    weight?: number | "";
  }[]>([]);

  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  const [roundInput, setRoundInput] = useState<string>(
    String(sessionPlan[sessionIdx]?.rounds ?? 1)
    );
  const [repInput, setRepInput] = useState<string>(
    String(sessionPlan[sessionIdx]?.reps ?? "")
  );
  const [weightInput, setWeightInput] = useState<string>(
    String(sessionPlan[sessionIdx]?.weight ?? "")
  );

  // UI state
  const [exerciseFilter, setExerciseFilter] = useState<string>("__all");
  const [activeTopTab, setActiveTopTab] = useState<string>(() => localStorage.getItem("activeTab") || "plan");
  const [activePlanDay, setActivePlanDay] = useState<string>("1");
  const [showWorkoutPreview, setShowWorkoutPreview] = useState(false);
  const [previewDay, setPreviewDay] = useState<number>(1);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
 // effect
  useEffect(() => { localStorage.setItem("activeTab", activeTopTab); }, [activeTopTab]);
  // Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Workout Library
  useEffect(() => {
    try {
      console.log("Initializing workout library...");
      // Load profile first to get programName
      let loadedProfile: UserProfile | null = null;
      try {
        const p = localStorage.getItem(STORAGE_KEYS.profile);
        if (p) loadedProfile = JSON.parse(p);
        console.log("Loaded profile:", loadedProfile?.programName);
      } catch (err) {
        console.error("Error loading profile:", err);
      }

      let loadedExercises = loadExercises();
      let loadedWorkouts = loadWorkouts();
      let loadedPlans = loadPlans();
      console.log("Loaded:", { exercises: loadedExercises.length, workouts: loadedWorkouts.length, plans: loadedPlans.length });

      // Initialize with defaults if empty
      if (loadedExercises.length === 0) {
        console.log("Initializing default library...");
        try {
          const { exercises: defaultExercises, workouts: defaultWorkouts, plan } = initializeLibrary();
          loadedExercises = defaultExercises;
          loadedWorkouts = defaultWorkouts;
          loadedPlans = [plan];
          saveExercises(loadedExercises);
          saveWorkouts(loadedWorkouts);
          savePlans(loadedPlans);
          console.log("Default library initialized:", { exercises: loadedExercises.length, workouts: loadedWorkouts.length });
        } catch (err) {
          console.error("Error initializing library:", err);
          throw err; // Re-throw to be caught by outer catch
        }
      }

      setExercises(loadedExercises);
      setWorkoutLibrary(loadedWorkouts);
      setPlans(loadedPlans);

      // Load or set active plan - use loaded profile's programName or default
      const programName = loadedProfile?.programName || profile.programName || "Final 4-Day Dancer's Split";
      const plan = loadedPlans.find(p => p.name === programName) || loadedPlans[0] || null;
      console.log("Selected plan:", plan?.name);
      setActivePlan(plan);

      // Convert to legacy format for backwards compatibility
      if (plan && loadedExercises.length > 0 && loadedWorkouts.length > 0) {
        try {
          const populatedPlan = populatePlanDays(plan, loadedWorkouts, loadedExercises);
          const legacyPlan = planToLegacyFormat(populatedPlan, loadedWorkouts, loadedExercises);
          setDancerSplit(legacyPlan);
          console.log("Converted plan to legacy format:", legacyPlan.length, "days");
        } catch (err) {
          console.error("Error converting plan to legacy format:", err);
        }
      } else {
        console.warn("Cannot convert plan - missing data:", { plan: !!plan, exercises: loadedExercises.length, workouts: loadedWorkouts.length });
      }
    } catch (err) {
      console.error("Error initializing workout library:", err);
      // Still try to render something
      setDancerSplit([]);
    }
  }, []); // Only run once on mount

  // Update legacy format when plan changes
  useEffect(() => {
    if (activePlan && exercises.length > 0 && workoutLibrary.length > 0) {
      const populatedPlan = populatePlanDays(activePlan, workoutLibrary, exercises);
      const legacyPlan = planToLegacyFormat(populatedPlan, workoutLibrary, exercises);
      setDancerSplit(legacyPlan);
      
      // Update profile program name
      if (activePlan.name) {
        setProfile((p) => ({
          ...p,
          programName: activePlan.name,
          programDurationWeeks: activePlan.durationWeeks ?? p.programDurationWeeks,
          daysPerWeek: activePlan.daysPerWeek ?? p.daysPerWeek,
        }));
      }
    }
  }, [activePlan, exercises, workoutLibrary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persistence
  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.profile);
      const w = localStorage.getItem(STORAGE_KEYS.workouts);
      if (p) setProfile(JSON.parse(p));
      if (w) setWorkouts(JSON.parse(w));
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(workouts));
  }, [workouts]);
  useEffect(() => {
    if (!timerActive || timerRemaining === null) return;

    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timerRemaining]);


  // Derived
  const unit = profile.unit ?? "kg";
  const uniqueExercises = useMemo(
    () => Array.from(new Set(workouts.map((w) => w.name))).sort(),
    [workouts]
  );


  const completedDates = useMemo(() => {
    const s = new Set<string>();
    for (const w of workouts) s.add(w.date);
    return s;
  }, [workouts]);

  // Profile actions
  function preferredToggle(day: string) {
    setProfile((p) => ({
      ...p,
      preferredDays: p.preferredDays?.includes(day)
        ? p.preferredDays.filter((d) => d !== day)
        : [...(p.preferredDays || []), day],
    }));
  }
  function handleProfileChange<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }
  function applyProgressiveOverload(
    plan: {
      name: string;
      sets: { reps: number | ""; weight: number | "" }[];
      restSec?: number;
      timed?: boolean;
      seconds?: number;
    }[],
    workouts: WorkoutEntry[],
    unit: "kg" | "lb"
  ) {
    return plan.map((exercise) => {
      if (exercise.timed) return exercise; // Skip timed

      const prev = lastEntryFor(workouts, exercise.name);
      if (!prev) return exercise;

      const newSets = exercise.sets.map((set) => {
        let suggestedReps = undefined;
        let suggestedWeight = undefined;

        if (typeof prev.reps === "number" && typeof set.reps === "number") {
          const targetRange = getTargetRepRangeForExercise(exercise.name);
          const topOfRange = targetRange?.[1] ?? set.reps;

          if (prev.reps < topOfRange) {
            suggestedReps = prev.reps + 1;
          } else if (typeof prev.weightKg === "number") {
            const incKg = unit === "lb" ? 5 * 0.45359237 : 2.5;
            const newKg = prev.weightKg + incKg;
            const newWeight = fromKg(newKg, unit);
            suggestedReps = targetRange?.[0] ?? set.reps;
            suggestedWeight = roundDisplayUnit(newWeight, unit);
          }
        }

        return {
          ...set,
          suggestedReps,
          suggestedWeight,
        };
      });

      return {
        ...exercise,
        sets: newSets,
      };
    });
}

  // Session helpers
  function buildSessionPlan(day: number) {
    if (!activePlan || !dancerSplit.length) return null;

    const planDay = activePlan.days.find((d) => d.day === day);
    if (!planDay) return null;

    const workout = workoutLibrary.find((w) => w.id === planDay.workoutId);
    if (!workout) return null;

    const populatedWorkout = populateWorkoutExercises(workout, exercises);

    // Circuit mode - return circuit spec
    if (workout.mode === "circuit") {
      return { workout, planDay, mode: "circuit" as const, circuitSpec: workoutToCircuitSpec(populatedWorkout, exercises) };
    }

    // Sets/reps or timed mode
    const plan = populatedWorkout.exercises.map((we) => {
      const ex = we.exercise;
      if (!ex) {
        return {
          name: we.exerciseId,
          sets: [{ reps: "", weight: "" }],
          restSec: we.restSec,
        };
      }

      const name = ex.name;
      const restSec = we.restSec ?? ex.defaultRestSec;

      // Timed exercise
      if (we.seconds || ex.isTimed) {
        const seconds = we.seconds ?? ex.defaultSeconds ?? 30;
        return {
          name,
          timed: true as const,
          seconds,
          restSec,
          sets: [{ reps: "", weight: "" }],
        };
      }

      // Sets/reps exercise
      const sets = we.sets ?? ex.defaultSets ?? 3;
      const repRange = we.repRange ?? ex.defaultRepRange;
      const repLow = repRange ? repRange[0] : we.reps ?? 10;
      const repHigh = repRange ? repRange[1] : we.reps ?? 12;

      let nextReps = repLow;
      let nextWeightUnit: number | "" = "";

      const prev = lastEntryFor(workouts, name);

      if (prev) {
        const prevReps = prev.reps ?? repLow;
        const prevWeightKg = prev.weightKg;

        if (repHigh && prevReps >= repHigh) {
          // REACHED MAX REPS → add weight
          if (typeof prevWeightKg === "number") {
            const incKg = PO_INCR[unit] === 5 ? 5 * KG_PER_LB : 2.5;
            const suggestedKg = prevWeightKg + incKg;
            const asUnit = fromKg(suggestedKg, unit);
            nextWeightUnit = roundDisplayUnit(asUnit, unit);
          }
          nextReps = repLow; // reset reps to bottom
        } else {
          // NOT YET AT MAX REPS → +1 rep, same weight
          nextReps = prevReps + 1;
          if (typeof prevWeightKg === "number") {
            const asUnit = fromKg(prevWeightKg, unit);
            nextWeightUnit = roundDisplayUnit(asUnit, unit);
          }
        }
      }

      // Build sets with suggested reps/weight prefilled
      const setsArr = Array.from({ length: sets }, () => ({
        reps: nextReps,
        weight: nextWeightUnit,
      }));

      return { name, sets: setsArr, restSec };
    });

    if (plan.length === 0) return null;

    return { workout, planDay, mode: "sets" as const, plan };
  }

  function startSession(day: number | string | undefined | null, customPlan?: typeof sessionPlan) {
    const dnum = Number(day);
    
    // If we have a custom plan (edited plan from preview), use it directly
    if (customPlan && customPlan.length > 0) {
      setSessionPlan(customPlan as any);
      setSessionIdx(0);
      setCurrentSetIdx(0);
      setSessionDay(dnum);
      setSessionMode("sets");
      setSessionActive(true);
      setShowWorkoutPreview(false);
      setActiveTopTab("track");
      return;
    }

    // Otherwise, build the session plan
    const built = buildSessionPlan(dnum);
    if (!built) {
      console.error("Cannot start session: buildSessionPlan returned null", { day: dnum, activePlan, dancerSplitLength: dancerSplit.length });
      alert("Cannot start session. Please ensure you have an active plan and the workout exists.");
      return;
    }

    // Circuit mode
    if (built.mode === "circuit" && built.circuitSpec) {
      setCircuitSpec(built.circuitSpec);
      setCircuitManual(Array.from({ length: built.circuitSpec.stations.length }, () => ({})));
      setSessionMode("circuit");
      setSessionDay(dnum);
      setSessionActive(true);
      setShowWorkoutPreview(false);
      setActiveTopTab("track");
      return;
    }

    // Sets/reps or timed mode
    const planToUse = built.plan;
    if (!planToUse || planToUse.length === 0) {
      console.error("Cannot start session: plan is empty", { built });
      alert("Cannot start session. No exercises in workout.");
      return;
    }

    setSessionPlan(planToUse as any);
    setSessionIdx(0);
    setCurrentSetIdx(0);
    setSessionDay(dnum);
    setSessionMode("sets");
    setSessionActive(true);
    setShowWorkoutPreview(false);
    setActiveTopTab("track");
  }
  
  
  function finishSessionAndSave() {
    const entries: WorkoutEntry[] = [];

    for (const ex of sessionPlan) {
      if (ex.timed) {
        const seconds = typeof ex.seconds === "number" ? ex.seconds : Number(ex.seconds) || 0;

        entries.push({
          id: uid(),
          date: sessionDate,
          name: ex.name + " (sec)",
          sets: 1,
          reps: seconds,
          weightKg: undefined,
        });

        // Optionally store reps/weight for timed movement
        for (const set of ex.sets) {
          const reps = typeof set.reps === "number" ? set.reps : Number(set.reps);
          const weight = typeof set.weight === "number" ? set.weight : Number(set.weight);

          if (!isNaN(reps) || !isNaN(weight)) {
            entries.push({
              id: uid(),
              date: sessionDate,
              name: ex.name,
              sets: 1,
              reps: isNaN(reps) ? 0 : reps,
              weightKg:
                unit === "lb"
                  ? isNaN(weight)
                    ? undefined
                    : Math.round(weight * 0.45359237 * 100) / 100
                  : isNaN(weight)
                  ? undefined
                  : weight,
            });
          }
        }
      } else {
        for (const set of ex.sets) {
          const reps = typeof set.reps === "number" ? set.reps : Number(set.reps);
          const weight = typeof set.weight === "number" ? set.weight : Number(set.weight);

          entries.push({
            id: uid(),
            date: sessionDate,
            name: ex.name,
            sets: 1,
            reps: isNaN(reps) ? 0 : reps,
            weightKg:
              unit === "lb"
                ? isNaN(weight)
                  ? undefined
                  : Math.round(weight * 0.45359237 * 100) / 100
                : isNaN(weight)
                ? undefined
                : weight,
          });
        }
      }
    }

    const withPR = markPRsBeforeInsert(workouts, entries);
    setWorkouts((prev) => [...withPR, ...prev]);
    setSessionActive(false);
  }



  // Export / Import
  function exportJSON() {
    const data = { profile, workouts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workout-tracker-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function onImportClick() {
    fileInputRef.current?.click();
  }
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.profile) setProfile(parsed.profile);
        if (Array.isArray(parsed.workouts)) setWorkouts(parsed.workouts);
        alert("Import successful");
      } catch (err) {
        alert("Import failed: " + (err as Error).message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  // UI derived
  const profileComplete = profile.name.trim().length > 0;


    // Prefill manual log with PO when an exercise is chosen from library
  useEffect(() => {
    if (wOpenEntry) return; // Don't prefill for open entries
    
    const exerciseId = wExerciseId;
    if (!exerciseId) return;

    const exercise = exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    // Prefill with exercise defaults
    if (exercise.defaultSets && (wSets === "" || wSets === "3")) {
      setWSets(String(exercise.defaultSets));
    }

    if (exercise.defaultRepRange) {
      const [min, max] = exercise.defaultRepRange;
      if (wReps === "" || wReps === "10") {
        // Try progressive overload first
        const prev = lastEntryFor(workouts, exercise.name);
        if (prev) {
          const prevReps = prev.reps ?? min;
          if (prevReps >= max) {
            // At max, suggest min again (weight will be increased)
            setWReps(String(min));
          } else {
            // Not at max, +1 rep
            setWReps(String(prevReps + 1));
          }
        } else {
          setWReps(String(min));
        }
      }
    }

    // Progressive overload for weight
    const prev = lastEntryFor(workouts, exercise.name);
    if (prev && wWeight === "") {
      const prevReps = prev.reps ?? 0;
      const prevWeightKg = prev.weightKg;
      const repRange = exercise.defaultRepRange;
      
      if (repRange && prevReps >= repRange[1]) {
        // Reached max reps, suggest weight increase
        if (typeof prevWeightKg === "number") {
          const incKg = PO_INCR[unit] === 5 ? 5 * KG_PER_LB : 2.5;
          const suggestedKg = prevWeightKg + incKg;
          const asUnit = fromKg(suggestedKg, unit);
          setWWeight(String(roundDisplayUnit(asUnit, unit)));
        }
      } else if (typeof prevWeightKg === "number") {
        // Not at max, keep same weight
        const asUnit = fromKg(prevWeightKg, unit);
        setWWeight(String(roundDisplayUnit(asUnit, unit)));
      }
    }
  }, [wExerciseId, exercises, unit, workouts, wOpenEntry, wSets, wReps, wWeight]); // deps
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-900 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7" />
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl md:text-3xl font-semibold tracking-tight"
          >
            Dancer&apos;s Split — Plan & Tracker
          </motion.h1>
        </div>

        <Tabs value={activeTopTab} onValueChange={setActiveTopTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="track">Track</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile">
            <ProfileTab
              profile={profile}
              unit={unit}
              profileComplete={profileComplete}
              onChange={handleProfileChange}
              onTogglePreferredDay={preferredToggle}
              onExport={exportJSON}
              onImportClick={onImportClick}
              fileInputRef={fileInputRef}
              onImportFile={handleImportFile}
              fromKg={fromKg}
              toKg={toKg}
              activePlan={activePlan}
              availablePlans={plans}
              onSelectPlan={(planId) => {
                const plan = plans.find((p) => p.id === planId);
                if (!plan) return;
                const updatedPlan = { ...plan, startDate: todayISO() };
                setActivePlan(updatedPlan);
                // Clear start dates from all other plans
                const updatedPlans = plans.map((p) => 
                  p.id === planId ? updatedPlan : { ...p, startDate: undefined }
                );
                setPlans(updatedPlans);
                savePlans(updatedPlans);
                // Update profile
                setProfile((p) => ({
                  ...p,
                  programName: plan.name,
                  programDurationWeeks: plan.durationWeeks ?? p.programDurationWeeks,
                  daysPerWeek: plan.daysPerWeek ?? p.daysPerWeek,
                  programStartDate: updatedPlan.startDate,
                }));
                // Update legacy format will happen in useEffect
              }}
            />
          </TabsContent>

          {/* PLAN TAB */}
          <TabsContent value="plan">
            {dancerSplit.length === 0 ? (
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6 text-center text-slate-600">
                  <p>Loading workout plan...</p>
                </CardContent>
              </Card>
            ) : (
              <PlanTab
                plan={dancerSplit}
                activePlanDay={activePlanDay}
                onChangeActivePlanDay={setActivePlanDay}
                onStartSession={(day) => {
                  setPreviewDay(day);
                  setShowWorkoutPreview(true);
                  setActiveTopTab("track");
                }}
                /* Calendar props */
                preferredDays={(profile.preferredDays as any) || []}
                programStartDate={profile.programStartDate}
                daysPerWeek={profile.daysPerWeek as any}
                completedDates={completedDates}
                onPickDate={(isoDate, suggestedPlanDay) => {
                  setSessionDate(isoDate);
                  setPreviewDay(suggestedPlanDay ?? 1);
                  setShowWorkoutPreview(true);
                }}
                activePlan={activePlan}
                availablePlans={plans}
                onCancelPlan={() => {
                  if (activePlan) {
                    // Clear start date from the plan
                    const updatedPlans = plans.map((p) => 
                      p.id === activePlan.id ? { ...p, startDate: undefined } : p
                    );
                    setPlans(updatedPlans);
                    savePlans(updatedPlans);
                  }
                  setActivePlan(null);
                  setDancerSplit([]);
                  setProfile((p) => ({ ...p, programName: "", programStartDate: undefined }));
                }}
                onStartNewPlan={(planId) => {
                  const plan = plans.find((p) => p.id === planId);
                  if (!plan) return;
                  const updatedPlan = { ...plan, startDate: todayISO() };
                  setActivePlan(updatedPlan);
                  // Clear start dates from all other plans
                  const updatedPlans = plans.map((p) => 
                    p.id === planId ? updatedPlan : { ...p, startDate: undefined }
                  );
                  setPlans(updatedPlans);
                  savePlans(updatedPlans);
                  // Update profile
                  setProfile((p) => ({
                    ...p,
                    programName: plan.name,
                    programDurationWeeks: plan.durationWeeks ?? p.programDurationWeeks,
                    daysPerWeek: plan.daysPerWeek ?? p.daysPerWeek,
                    programStartDate: updatedPlan.startDate,
                  }));
                  // Update legacy format will happen in useEffect
                }}
              />
            )}
          </TabsContent>

          {/* TRACK TAB (circuit OR sets runner, else start) */}
          <TabsContent value="track">
            <div className="space-y-6">
              {/* WORKOUT PREVIEW */}
              {showWorkoutPreview && (
                <WorkoutPreview
                  day={sessionActive ? sessionDay : previewDay}
                  date={sessionDate}
                  onDateChange={setSessionDate}
                  builtSession={sessionActive ? (sessionMode === "circuit" && circuitSpec ? {
                    workout: workoutLibrary.find((w) => w.id === activePlan?.days.find((d) => d.day === sessionDay)?.workoutId)!,
                    planDay: activePlan?.days.find((d) => d.day === sessionDay)!,
                    mode: "circuit",
                    circuitSpec: circuitSpec,
                  } : {
                    workout: workoutLibrary.find((w) => w.id === activePlan?.days.find((d) => d.day === sessionDay)?.workoutId)!,
                    planDay: activePlan?.days.find((d) => d.day === sessionDay)!,
                    mode: "sets",
                    plan: sessionPlan as any,
                  }) : buildSessionPlan(previewDay)}
                  exercises={exercises}
                  workoutLibrary={workoutLibrary}
                  onStart={(editedPlan) => {
                    if (sessionActive && editedPlan) {
                      // Update current session with edited plan
                      setSessionPlan(editedPlan as any);
                      // If current exercise index is out of bounds, adjust it
                      if (sessionIdx >= editedPlan.length) {
                        setSessionIdx(Math.max(0, editedPlan.length - 1));
                      }
                      setShowWorkoutPreview(false);
                      setEditingExerciseIndex(null);
                    } else {
                      // Starting new session
                      startSession(previewDay, editedPlan);
                      setShowWorkoutPreview(false);
                      setEditingExerciseIndex(null);
                    }
                  }}
                  onCancel={() => {
                    setShowWorkoutPreview(false);
                    setEditingExerciseIndex(null);
                  }}
                  onEditExercise={(index) => setEditingExerciseIndex(index)}
                  editingIndex={editingExerciseIndex}
                  unit={unit}
                  workouts={workouts}
                  lastEntryFor={lastEntryFor}
                  fromKg={fromKg}
                  roundDisplayUnit={roundDisplayUnit}
                />
              )}

              {/* 1) CIRCUIT MODE */}
              {sessionActive && sessionMode === "circuit" && circuitSpec ? (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">
                        Session — Day {sessionDay}
                        <span className="text-slate-500 text-sm ml-2">{sessionDate}</span>
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowWorkoutPreview(true);
                          setEditingExerciseIndex(null);
                          setPreviewDay(sessionDay);
                        }}
                        className="rounded-lg"
                      >
                        Edit Workout
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <Label htmlFor="sdate">Session date</Label>
                      <Input
                        id="sdate"
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                      />
                    </div>

                    <CircuitRunner
                      circuit={circuitSpec}
                      dateISO={sessionDate}
                      uid={uid}
                      onFinish={(entries) => {
                        const withPR = markPRsBeforeInsert(workouts, entries);
                        setWorkouts((prev) => [...withPR, ...prev]);
                        setSessionActive(false);
                        setSessionMode("sets");
                        setCircuitSpec(null);
                      }}
                    />

                    <div className="space-y-4">
                      {circuitSpec.stations.map((st, i) => (
                        <div key={i} className="border p-3 rounded-xl bg-slate-50">
                          <Label className="block mb-1 text-sm font-semibold">{st.label}</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {/* Reps Input */}
                            <div>
                              <Label>Reps (total)</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={
                                  circuitManual[i]?.reps !== undefined && circuitManual[i]?.reps !== null && circuitManual[i].reps !== ""
                                    ? String(circuitManual[i].reps)
                                    : ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCircuitManual((prev) => {
                                    const copy = [...prev];
                                    // Allow empty string, 0, or positive numbers
                                    if (val === "") {
                                      copy[i] = { ...copy[i], reps: "" };
                                    } else {
                                      const parsed = Number(val);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        copy[i] = { ...copy[i], reps: parsed };
                                      }
                                    }
                                    return copy;
                                  });
                                }}
                                onBlur={(e) => {
                                  // On blur, if empty, set to empty string (allows clearing)
                                  const val = e.target.value;
                                  if (val === "") {
                                    setCircuitManual((prev) => {
                                      const copy = [...prev];
                                      copy[i] = { ...copy[i], reps: "" };
                                      return copy;
                                    });
                                  }
                                }}
                              />
                            </div>

                            {/* Weight Input */}
                            <div>
                              <Label>Weight ({unit})</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={
                                  circuitManual[i]?.weight !== undefined && circuitManual[i]?.weight !== null
                                    ? String(circuitManual[i].weight)
                                    : ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCircuitManual((prev) => {
                                    const copy = [...prev];
                                    const parsed =  Number(val);
                                    copy[i] = {
                                      ...copy[i],
                                      weight: val === "" || isNaN(parsed) ? "" : parsed,
                                    };
                                    return copy;
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                          setSessionActive(false);
                          setCircuitSpec(null);
                          setSessionMode("sets");
                        }}
                      >
                        Cancel
                      </Button>

                      <Button
                        className="rounded-xl"
                        onClick={() => {
                          const auto: WorkoutEntry[] = [];

                          // Log each station once (not per round)
                          for (let i = 0; i < circuitSpec.stations.length; i++) {
                            const st = circuitSpec.stations[i];
                            const manual = circuitManual[i] || {};

                            // Always log the timed portion (total seconds across all rounds)
                            const totalSeconds = st.seconds * circuitSpec.rounds;
                            auto.push({
                              id: uid(),
                              date: sessionDate,
                              name: `${st.label} (sec)`,
                              sets: 1,
                              reps: totalSeconds,
                            });

                            // Sanitize reps and weight input
                            const repsValue =
                              typeof manual.reps === "number" ? manual.reps : Number(manual.reps);
                            const weightValue =
                              typeof manual.weight === "number"
                                ? manual.weight
                                : Number(manual.weight);

                            // Only push manual log if user entered something
                            // Reps should be entered once per station, representing total reps or reps per round
                            if (!isNaN(repsValue) || !isNaN(weightValue)) {
                              // If reps entered, assume it's total reps (or user can multiply per round)
                              // For now, log as-is - user enters total reps for all rounds
                              auto.push({
                                id: uid(),
                                date: sessionDate,
                                name: st.label,
                                sets: circuitSpec.rounds, // Use rounds as sets to indicate it's across multiple rounds
                                reps: isNaN(repsValue) ? 0 : repsValue,
                                weightKg:
                                  isNaN(weightValue)
                                    ? undefined
                                    : unit === "lb"
                                    ? Math.round(weightValue * 0.45359237 * 100) / 100
                                    : weightValue,
                              });
                            }
                          }

                          const withPR = markPRsBeforeInsert(workouts, auto);
                          setWorkouts((prev) => [...withPR, ...prev]);
                          setSessionActive(false);
                          setSessionMode("sets");
                          setCircuitSpec(null);
                        }}
                      >
                        Finish & Save Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}


              {/* 2) SETS / REPS MODE */}
              {sessionActive && sessionMode === "sets" ? (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">
                        Session — Day {sessionDay}
                        <span className="text-slate-500 text-sm ml-2">{sessionDate}</span>
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowWorkoutPreview(true);
                          setEditingExerciseIndex(null);
                        }}
                        className="rounded-lg"
                      >
                        Edit Workout
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <Label htmlFor="sdate2">Session date</Label>
                      <Input
                        id="sdate2"
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                      />
                    </div>

                    {/* Exercise list indicator */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 pb-2 border-b">
                      <span>Exercise {sessionIdx + 1} of {sessionPlan.length}</span>
                      <span>•</span>
                      <span>{sessionPlan.map((e) => e.name).join(", ")}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="font-medium">{sessionPlan[sessionIdx]?.name ?? ""}</div>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setSessionIdx((i) => Math.max(0, i - 1));
                            setCurrentSetIdx(0);
                          }}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setSessionIdx((i) => Math.min(sessionPlan.length - 1, i + 1));
                            setCurrentSetIdx(0);
                          }}
                        >
                          Next
                        </Button>
                      </div>
                      </div>
                      {/* Convert type row */}
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span>Type:</span>
                        {sessionPlan[sessionIdx]?.timed ? (
                          <div className="space-y-1 max-w-md">
                            <Label>Timed Exercise</Label>
                            <div className="flex items-center gap-3">
                              <Input
                                className="w-24"
                                inputMode="numeric"
                                value={sessionPlan[sessionIdx].seconds as any}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSessionPlan((prev) =>
                                    prev.map((ex, i) =>
                                      i === sessionIdx
                                        ? { ...ex, seconds: v === "" ? "" : Number(v) }
                                        : ex
                                    )
                                  );
                                }}
                              />
                              {!timerActive ? (
                                <Button
                                  variant="outline"
                                  className="rounded-xl text-sm"
                                  onClick={() => {
                                    setTimerRemaining(sessionPlan[sessionIdx].seconds as number);
                                    setTimerActive(true);
                                  }}
                                >
                                  ▶ Start Timer
                                </Button>
                              ) : (
                                <div
                                  className={`text-lg font-mono px-3 py-1 rounded border ${
                                    timerRemaining <= 5 ? "bg-yellow-100 animate-pulse" : "bg-slate-100"
                                  }`}
                                >
                                  {Math.floor(timerRemaining / 60)}:
                                  {(timerRemaining % 60).toString().padStart(2, "0")}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">Enter duration and use the timer to track rest or work.</p>
                          </div>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 rounded bg-slate-100">Sets/Reps</span>
                            <Button size="sm" variant="outline" className="rounded-lg"
                              onClick={() => {
                                setSessionPlan(prev => prev.map((ex, i) => i === sessionIdx
                                  ? {
                                      name: ex.name,
                                      timed: true,
                                      seconds: 45,
                                      restSec: ex.restSec,
                                      sets: [{ reps: "", weight: "" }],
                                    }
                                  : ex));
                              }}>
                              Convert to Timed
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{sessionPlan[sessionIdx]?.name ?? ""}</div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-600 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={autoRest}
                              onChange={(e) => setAutoRest(e.target.checked)}
                            />
                            Auto-rest
                          </label>
                          <div className="space-x-2">
                            <Button variant="outline" className="rounded-xl"
                              onClick={() => { setSessionIdx((i) => Math.max(0, i-1)); setCurrentSetIdx(0); }}>
                              Prev
                            </Button>
                            <Button variant="outline" className="rounded-xl"
                              onClick={() => { setSessionIdx((i) => Math.min(sessionPlan.length-1, i+1)); setCurrentSetIdx(0); }}>
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>

                    {/* Suggested rest + timer */}
                    {typeof sessionPlan[sessionIdx]?.restSec === "number" && (
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 border p-3">
                        <div className="text-xs text-slate-600">
                          Suggested rest: {sessionPlan[sessionIdx]!.restSec}s
                        </div>
                        <RestTimer
                          seconds={sessionPlan[sessionIdx]!.restSec}
                          startSignal={restStartSignal}
                          onDone={() => {
                            if (!sessionPlan[sessionIdx]?.timed) {
                              const sets = sessionPlan[sessionIdx]!.sets;
                              if (currentSetIdx < sets.length - 1) {
                                setCurrentSetIdx((i) => i + 1);
                              } else if (sessionIdx < sessionPlan.length - 1) {
                                setSessionIdx((i) => i + 1);
                                setCurrentSetIdx(0);
                              } else {
                                finishSessionAndSave();
                              }
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Timed vs sets table */}
                    {sessionPlan[sessionIdx]?.timed ? (
                      <div className="grid grid-cols-3 gap-3 max-w-md">
                        {/* Seconds */}
                        <div>
                          <Label>Seconds</Label>
                          <Input
                            inputMode="numeric"
                            value={sessionPlan[sessionIdx].seconds ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSessionPlan((prev) =>
                                prev.map((ex, i) =>
                                  i === sessionIdx
                                    ? { ...ex, seconds: v === "" ? "" : Number(v) }
                                    : ex
                                )
                              );
                            }}
                          />
                        </div>
                        {/* Rounds */}
                        <div>
                          <Label>Rounds</Label>
                          <Input
                            inputMode="numeric"
                            type="number"
                            min={1}
                            value={roundInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRoundInput(v);

                              // Only update sessionPlan when it's a valid number
                              const parsed = Number(v);
                              if (!isNaN(parsed) && parsed > 0) {
                                setSessionPlan((prev) =>
                                  prev.map((ex, i) =>
                                    i === sessionIdx ? { ...ex, rounds: parsed } : ex
                                  )
                                );
                              }
                            }}
                            onBlur={() => {
                              // If empty on blur, default to 1
                              if (roundInput === "") {
                                setRoundInput("1");
                                setSessionPlan((prev) =>
                                  prev.map((ex, i) =>
                                    i === sessionIdx ? { ...ex, rounds: 1 } : ex
                                  )
                                );
                              }
                            }}
                          />
                        </div>
                        {/* Spacer */}
                        <div className="self-end text-slate-500">(timed movement)</div>

                        {/* Reps (optional) */}
                        <div>
                          <Label>Reps (optional)</Label>
                          <Input
                            inputMode="numeric"
                            value={sessionPlan[sessionIdx].reps ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSessionPlan((prev) =>
                                prev.map((ex, i) =>
                                  i === sessionIdx
                                    ? { ...ex, reps: v === "" ? "" : Number(v) }
                                    : ex
                                )
                              );
                            }}
                          />
                        </div>

                        {/* Weight (optional) */}
                        <div>
                          <Label>Weight ({unit})</Label>
                          <Input
                            inputMode="numeric"
                            value={sessionPlan[sessionIdx].weight ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSessionPlan((prev) =>
                                prev.map((ex, i) =>
                                  i === sessionIdx
                                    ? { ...ex, weight: v === "" ? "" : Number(v) }
                                    : ex
                                )
                              );
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-[420px] text-sm">
                          <thead>
                            <tr className="text-left text-slate-500 border-b">
                              <th className="py-2 pr-4">Set</th>
                              <th className="py-2 pr-4">Reps</th>
                              <th className="py-2 pr-4">Weight ({unit})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessionPlan[sessionIdx]?.sets.map((s, j) => (
                              <tr
                                key={j}
                                className={`border-b last:border-0 ${
                                  j === currentSetIdx ? "bg-slate-50" : ""
                                }`}
                              >
                                <td className="py-2 pr-4">{j + 1}</td>
                                <td className="py-2 pr-4">
                                  <div className="relative">
                                    <Input
                                      inputMode="numeric"
                                      value={String(s.reps)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setSessionPlan(prev =>
                                          prev.map((ex, i) =>
                                            i === sessionIdx
                                              ? {
                                                  ...ex,
                                                  sets: ex.sets.map((x, k) =>
                                                    k === j ? { ...x, reps: v.trim() === "" ? "" : Number(v) } : x
                                                  ),
                                                }
                                              : ex
                                          )
                                        );
                                      }}
                                    />
                                    {s.suggestedReps !== undefined && s.reps === "" && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs italic">
                                        {s.suggestedReps}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 pr-4">
                                  <div className="relative">
                                    <Input
                                      inputMode="numeric"
                                      value={s.weight === "" ? "" : String(s.weight)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setSessionPlan(prev =>
                                          prev.map((ex, i) =>
                                            i === sessionIdx
                                              ? {
                                                  ...ex,
                                                  sets: ex.sets.map((x, k) =>
                                                    k === j ? { ...x, weight: v.trim() === "" ? "" : Number(v) } : x
                                                  ),
                                                }
                                              : ex
                                          )
                                        );
                                      }}
                                      placeholder={unit === "kg" ? "40" : "90"}
                                    />
                                    {s.suggestedWeight !== undefined && s.weight === "" && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs italic pointer-events-none">
                                        {s.suggestedWeight}
                                      </div>
                                    )}
                                  </div>
                                </td>

                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSessionPlan((prev) =>
                                prev.map((ex, i) =>
                                  i === sessionIdx
                                    ? {
                                        ...ex,
                                        sets: [...ex.sets, { reps: "", weight: "" }],
                                      }
                                    : ex
                                )
                              );
                            }}
                          >
                            + Add Set
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Complete Set button (for non-timed) */}
                    {!sessionPlan[sessionIdx]?.timed && (
                      <div className="flex items-center justify-end">
                        <Button
                          className="rounded-xl"
                          onClick={() => {
                            const rest = sessionPlan[sessionIdx]?.restSec ?? 0;
                            if (rest > 0 && autoRest) {
                              setRestStartSignal(n => n + 1); // auto start rest; onDone ⇒ advance
                            } else {
                              const sets = sessionPlan[sessionIdx]!.sets;
                              if (currentSetIdx < sets.length - 1) {
                                setCurrentSetIdx(i => i + 1);
                              } else if (sessionIdx < sessionPlan.length - 1) {
                                setSessionIdx(i => i + 1);
                                setCurrentSetIdx(0);
                              } else {
                                finishSessionAndSave();
                              }
                            }
                          }}
                        >
                          Complete Set →
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setSessionActive(false)}
                      >
                        Cancel
                      </Button>
                      {sessionIdx === sessionPlan.length - 1 ? (
                        <Button className="rounded-xl" onClick={finishSessionAndSave}>
                          Finish Session & Save
                        </Button>
                      ) : (
                        <Button
                          className="rounded-xl"
                          onClick={() => {
                            setSessionIdx((i) => Math.min(sessionPlan.length - 1, i + 1));
                            setCurrentSetIdx(0);
                          }}
                        >
                          Complete Exercise →
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
                {/* Manual logging */}
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Manual Log</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
                    <div className="md:col-span-2">
                      <Label>Date</Label>
                      <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Label>Exercise</Label>
                        <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wOpenEntry}
                            onChange={(e) => {
                              setWOpenEntry(e.target.checked);
                              if (e.target.checked) {
                                setWExerciseId("");
                                setWName("");
                              } else {
                                setWName("");
                              }
                            }}
                            className="w-3 h-3"
                          />
                          Open Entry
                        </label>
                      </div>
                      {wOpenEntry ? (
                        <Input 
                          placeholder="Exercise name (will be added to library)" 
                          value={wName}
                          onChange={(e) => setWName(e.target.value)} 
                        />
                      ) : (
                        <Select 
                          value={wExerciseId} 
                          onValueChange={(id) => {
                            setWExerciseId(id);
                            const exercise = exercises.find((e) => e.id === id);
                            if (exercise) {
                              setWName(exercise.name);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select exercise from library" />
                          </SelectTrigger>
                          <SelectContent>
                            {exercises.map((ex) => (
                              <SelectItem key={ex.id} value={ex.id}>
                                {ex.name} {ex.muscleGroups.length > 0 && `(${ex.muscleGroups[0]})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label>Type</Label>
                      <Select value={wType} onValueChange={(v) => setWType(v as "sets" | "timed")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sets">Sets/Reps</SelectItem>
                          <SelectItem value="timed">Timed (seconds)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {wType === "timed" ? (
                      <>
                        <div>
                          <Label>Seconds</Label>
                          <Input inputMode="numeric" value={wSeconds} onChange={(e) => setWSeconds(e.target.value)} />
                        </div>
                        <div className="md:col-span-3 flex items-end">
                          <Button className="w-full rounded-xl" onClick={() => {
                            const name = wName.trim();
                            const secs = Number(wSeconds);
                            if (!name) return alert("Enter a name");
                            if (!Number.isFinite(secs) || secs <= 0) return alert("Enter seconds > 0");
                            
                            // If open entry, add exercise to library
                            if (wOpenEntry && !exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
                              const newExercise: Exercise = {
                                id: uid(),
                                name,
                                category: "other",
                                muscleGroups: [],
                                isTimed: true,
                                defaultSeconds: secs,
                                defaultSets: 1,
                                defaultRestSec: 60,
                              };
                              const updatedExercises = [...exercises, newExercise];
                              setExercises(updatedExercises);
                              saveExercises(updatedExercises);
                            }

                            const entry: WorkoutEntry = {
                              id: uid(),
                              date: sessionDate,
                              name: `${name} (sec)`,
                              sets: 1,
                              reps: secs,
                            };
                            const withPR = markPRsBeforeInsert(workouts, [entry]);
                            setWorkouts(prev => [...withPR, ...prev]);
                            setWName(""); 
                            setWSeconds("");
                            setWExerciseId("");
                            setWOpenEntry(false);
                          }}>
                            Add Timed
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label>Sets</Label>
                          <Input inputMode="numeric" value={wSets} onChange={(e) => setWSets(e.target.value)} />
                        </div>
                        <div>
                          <Label>Reps</Label>
                          <Input inputMode="numeric" value={wReps} onChange={(e) => setWReps(e.target.value)} />
                        </div>
                        <div>
                          <Label>Weight ({unit})</Label>
                          <Input inputMode="numeric" value={wWeight} onChange={(e) => setWWeight(e.target.value)} placeholder={unit === "kg" ? "40" : "90"} />
                        </div>
                        <div className="md:col-span-3 flex items-end">
                          <Button className="w-full rounded-xl" onClick={() => {
                            const name = wName.trim();
                            const sets = Number(wSets);
                            const reps = Number(wReps);
                            const rawWeight = wWeight === "" ? undefined : Number(wWeight);
                            if (!name) return alert("Enter a name");
                            if (!Number.isFinite(sets) || sets <= 0) return alert("Sets > 0");
                            if (!Number.isFinite(reps) || reps <= 0) return alert("Reps > 0");
                            if (rawWeight !== undefined && (!Number.isFinite(rawWeight) || rawWeight < 0)) return alert("Weight ≥ 0");
                            
                            // If open entry, add exercise to library
                            if (wOpenEntry && !exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
                              // Extract rep range if sets > 1 (use reps as both min and max, or allow user to specify)
                              const repRange: [number, number] = [reps, reps];
                              const newExercise: Exercise = {
                                id: uid(),
                                name,
                                category: "strength",
                                muscleGroups: [],
                                defaultRepRange: repRange,
                                defaultSets: sets,
                                defaultRestSec: 90,
                                isTimed: false,
                              };
                              const updatedExercises = [...exercises, newExercise];
                              setExercises(updatedExercises);
                              saveExercises(updatedExercises);
                            }

                            const entry: WorkoutEntry = {
                              id: uid(),
                              date: sessionDate,
                              name,
                              sets,
                              reps,
                              weightKg: rawWeight === undefined ? undefined : Math.round(toKg(rawWeight, unit) * 100) / 100,
                            };
                            const withPR = markPRsBeforeInsert(workouts, [entry]);
                            setWorkouts(prev => [...withPR, ...prev]);
                            setWName("");
                            setWExerciseId("");
                            setWOpenEntry(false);
                            setWSets("3");
                            setWReps("10");
                            setWWeight("");
                          }}>
                            Add Sets/Reps
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
             
              {/* 3) START A SESSION (when not active) */}
              {!sessionActive ? (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Start a Session</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <Label>Day</Label>
                      <Select value={String(sessionDay)} onValueChange={(v) => setSessionDay(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dancerSplit.length > 0 ? (
                            dancerSplit.map((d) => (
                              <SelectItem key={d.day} value={String(d.day)}>
                                Day {d.day}: {d.title}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="1" disabled>Loading...</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <Button
                        className="w-full rounded-xl"
                        onClick={() => {
                          setPreviewDay(sessionDay);
                          setShowWorkoutPreview(true);
                          setActiveTopTab("track");
                        }}
                        disabled={dancerSplit.length === 0}
                      >
                        Start
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          {/* PROGRESS TAB */}
          <TabsContent value="progress">
            <ProgressTab
              workouts={workouts}
              unit={unit}
              exerciseFilter={exerciseFilter}
              setExerciseFilter={setExerciseFilter}
              uniqueExercises={uniqueExercises}
              activePlan={activePlan}
              programStartDate={profile.programStartDate}
              preferredDays={profile.preferredDays as any}
              daysPerWeek={typeof profile.daysPerWeek === "number" ? profile.daysPerWeek : undefined}
              setWorkouts={setWorkouts}
            />
          </TabsContent>

          {/* LIBRARY TAB */}
          <TabsContent value="library">
            <LibraryTab
              exercises={exercises}
              workouts={workoutLibrary}
              plans={plans}
              onUpdateExercises={(ex) => {
                setExercises(ex);
                saveExercises(ex);
              }}
              onUpdateWorkouts={(w) => {
                setWorkoutLibrary(w);
                saveWorkouts(w);
              }}
              onUpdatePlans={(p) => {
                setPlans(p);
                savePlans(p);
              }}
              onSelectPlan={(plan) => {
                setActivePlan(plan);
              }}
            />
          </TabsContent>
        </Tabs>

        <div className="text-xs text-slate-500 pt-2 space-y-1">
          <p>Data is stored locally in your browser (localStorage). Export to back up and import to restore.</p>
          <p>Volume = sets × reps × weight ({unit}); entries without weight count as 1 per rep.</p>
        </div>
      </div>
    </div>
  );
}
