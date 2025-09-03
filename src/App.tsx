import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

import ProfileTab from "@/components/ProfileTab";
import PlanTab from "@/components/PlanTab";
import WorkoutLogTable from "@/components/WorkoutLogTable";
import CircuitRunner, { type CircuitSpec } from "@/components/CircuitRunner";

import { markPRsBeforeInsert } from "@/lib/pr";
// If you keep a manual-log picker you can re-enable this import.
// import { EXERCISES } from "@/lib/exercises";

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
   Plan Data (Final 4-Day Dancer's Split)
---------------------------------------------*/
const dancerSplit = [
  {
    day: 1,
    title: "Lower Body Strength & Stability",
    exercises: [
      "Leg Press (Bilateral): 4x6-8 (2-3 min rest)",
      "Bulgarian Split Squats: 3x8/leg (90s rest)",
      "Romanian Deadlifts: 3x10 (90s rest)",
      "Single-Leg Leg Curl: 3x10/leg (60s rest)",
      "Pallof Press: 3x10-12/side (60s rest)",
      "Deep Goblet Squat Hold (Kettlebell): 3x30s (60s rest)",
      "Standing Calf Raises: 4x15 (45s rest)",
    ],
  },
  {
    day: 2,
    title: "Upper Body Strength & Posture",
    exercises: [
      "Lat Pulldown (Wide Grip): 4x10 (2-3 min rest)",
      "Seated Row (Neutral Grip): 3x12 (90s rest)",
      "Smith Machine Overhead Press: 3x8 (90s rest)",
      "Incline Dumbbell Press: 3x10 (90s rest)",
      "Cable Face Pulls: 3x15 (60s rest)",
      "Assisted Dips: 3 sets to failure (60s rest)",
      "Suitcase Carry (Finisher): 2x30s/side (No rest between sides)",
    ],
  },
  {
    day: 3,
    title: "Full-Body Power & Endurance (Circuit)",
    exercises: [
      "Format: 3 rounds. Rest 60-90 sec after completing the entire circuit.",
      "Kettlebell Swings: 45s",
      "Box Jumps / Broad Jumps: 45s",
      "Push-Ups: 45s",
      "Single-Leg RDL (Bodyweight): 45s/leg",
      "Bird Dog Crunch 10-12 reps/side",
      "Plank: 60s hold",
    ],
  },
  {
    day: 4,
    title: "Dance-Specific Power & Plyometrics",
    exercises: [
      "Depth Drops to Stick Landing: 3x5 (2-3 min rest)",
      "Lateral Skater Jumps: 3x8/side (90s rest)",
      "Single-Leg Box Jumps: 3x5/leg (90s rest)",
      "Copenhagen Planks: 3x8-10/side (60s rest)",
      "Band-Resisted Ankle Jumps: 3x15 (60s rest)",
      "Deep Goblet Squat Hold (Kettlebell): 2x30s (60s rest)",
    ],
  },
] as const;

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
  const head = ex.split("(")[0]; // ignore parenthetical notes like (90s rest)

  const m = head.match(/(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i);
  if (m) {
    const sets = Number(m[1]);
    const reps = m[3] ? Number(m[3]) : Number(m[2]); // use upper bound if range
    return { sets, reps, timed: false as const };
  }

  const t = head.match(/(\d+)\s*(s|sec|secs|second|seconds)/i);
  if (t) return { sets: 1, reps: 0, timed: true as const, seconds: Number(t[1]) };

  return { sets: 3, reps: 10, timed: false as const };
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

  // Sets/reps session plan
  const [sessionPlan, setSessionPlan] = useState<
    {
      name: string;
      sets: { reps: number | ""; weight: number | "" }[];
      timed?: boolean;
      seconds?: number | "";
      restSec?: number;
    }[]
  >([]);

  // UI state
  const [exerciseFilter, setExerciseFilter] = useState<string>("__all");
  const [activeTopTab, setActiveTopTab] = useState<string>(() => localStorage.getItem("activeTab") || "plan");
  const [activePlanDay, setActivePlanDay] = useState<string>("1");
 // effect
  useEffect(() => { localStorage.setItem("activeTab", activeTopTab); }, [activeTopTab]);
  // Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Derived
  const unit = profile.unit ?? "kg";
  const uniqueExercises = useMemo(
    () => Array.from(new Set(workouts.map((w) => w.name))).sort(),
    [workouts]
  );
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; volume: number }>();
    for (const w of workouts) {
      if (exerciseFilter !== "__all" && w.name !== exerciseFilter) continue;
      const volume = w.sets * w.reps * (w.weightKg ?? 1);
      const k = w.date;
      if (!map.has(k)) map.set(k, { date: k, volume: 0 });
      map.get(k)!.volume += volume;
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [workouts, exerciseFilter]);

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

  // Session helpers
  function startSession(day: number | string | undefined | null) {
    const dnum = Number(day);
    if (![1, 2, 3, 4].includes(dnum)) {
      // fallback to day 1 if an invalid value slips in
      return startSession(1);
    }

    // Day 3 → circuit
    if (dnum === 3) {
      const spec = day3ToCircuit();
      setCircuitSpec(spec);
      setSessionMode("circuit");
      setSessionDay(dnum);
      setSessionActive(true);
      setActiveTopTab("track");
      return;
    }

    // Other days → sets/reps
    const d = dancerSplit.find((x) => x.day === dnum);
    if (!d) return;

    const plan = d.exercises
      .filter((s) => !/^Format:/i.test(s))
      .map((s) => {
        const name = s.split(":")[0];
        const parsed = parseSetsAndReps(s);
        const restSec = extractRestSeconds(s);
        if (parsed.timed) {
          return {
            name,
            timed: true as const,
            seconds: parsed.seconds,
            restSec,
            sets: [{ reps: "", weight: "" }],
          };
        }
        // Progressive Overload defaults
        const prev = lastEntryFor(workouts, name);
        let nextReps = parsed.reps as number;
        let nextWeightUnit: number | "" = "";

        // If we have a previous entry, prefer +weight; if no weight, try +1 rep
        if (prev) {
          // prev.reps is stored per set entry; use it as a hint for reps
          nextReps = Math.max(parsed.reps as number, (prev.reps ?? parsed.reps as number) + 1);

          if (typeof prev.weightKg === "number") {
            // suggest +2.5kg or +5lb (stored in kg but session UI uses the selected unit)
            const incKg = PO_INCR[unit] === 5 ? 5 * KG_PER_LB : 2.5; // if unit lb → 5 lb in kg; if kg → 2.5 kg
            const suggestedKg = prev.weightKg + incKg;
            const asUnit = fromKg(suggestedKg, unit);
            nextWeightUnit = roundDisplayUnit(asUnit, unit);
          }
        }

        // Build sets with suggested reps/weight prefilled
        const setsArr = Array.from({ length: parsed.sets }, () => ({
          reps: nextReps,
          weight: nextWeightUnit, // stays in UI unit; you already convert to kg on save
        }));
        return { name, sets: setsArr, restSec };
      });

    if (plan.length === 0) return;

    setSessionPlan(plan as any);
    setSessionIdx(0);
    setCurrentSetIdx(0);
    setSessionDay(dnum);
    setSessionMode("sets");
    setSessionActive(true);
    setActiveTopTab("track");
  }

  function finishSessionAndSave() {
    const entries: WorkoutEntry[] = [];
    for (const ex of sessionPlan) {
      if (ex.timed) {
        entries.push({
          id: uid(),
          date: sessionDate,
          name: ex.name + " (sec)",
          sets: 1,
          reps: Number(ex.seconds) || 0,
          weightKg: undefined,
        });
        continue;
      }
      ex.sets.forEach((s) => {
        const reps = Number(s.reps) || 0;
        const weightKg =
          s.weight === "" ? undefined : Math.round(toKg(Number(s.weight), unit) * 100) / 100;
        entries.push({ id: uid(), date: sessionDate, name: ex.name, sets: 1, reps, weightKg });
      });
    }
    if (entries.length === 0) return setSessionActive(false);
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

    // Prefill manual log with PO when an exercise is chosen
  useEffect(() => {
    const name = wName.trim();
    if (!name) return;

    const prev = lastEntryFor(workouts, name);
    if (!prev) return;

    // Only prefill if the user hasn't typed their own values yet
    const repsEmpty = wReps === "" || wReps === "10";    // your default is "10"
    const weightEmpty = wWeight === "";                   // empty means not set

    if (repsEmpty) {
      const nextReps = Math.max(Number(wReps || 0), (prev.reps ?? 0) + 1);
      if (nextReps > 0) setWReps(String(nextReps));
    }

    if (weightEmpty && typeof prev.weightKg === "number") {
      const incKg = PO_INCR[unit] === 5 ? 5 * KG_PER_LB : 2.5;
      const suggestedKg = prev.weightKg + incKg;
      const asUnit = fromKg(suggestedKg, unit);
      setWWeight(String(roundDisplayUnit(asUnit, unit)));
    }

    // You can also set default sets to 1 if you prefer
    if (wSets === "" || wSets === "3") setWSets("1");
  }, [wName, unit, workouts]); // deps

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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="track">Track</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
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
            />
          </TabsContent>

          {/* PLAN TAB */}
          <TabsContent value="plan">
            <PlanTab
              plan={dancerSplit}
              activePlanDay={activePlanDay}
              onChangeActivePlanDay={setActivePlanDay}
              onStartSession={(day) => {
                startSession(Number(day));
                setActiveTopTab("track");
              }}
              /* Calendar props */
              preferredDays={(profile.preferredDays as any) || []}
              programStartDate={profile.programStartDate}
              daysPerWeek={profile.daysPerWeek as any}
              completedDates={completedDates}
              onPickDate={(isoDate, suggestedPlanDay) => {
                setSessionDate(isoDate);
                startSession(suggestedPlanDay ?? 1);
                setActiveTopTab("track");
              }}
            />
          </TabsContent>

          {/* TRACK TAB (circuit OR sets runner, else start) */}
          <TabsContent value="track">
            <div className="space-y-6">
              {/* 1) CIRCUIT MODE */}
              {sessionActive && sessionMode === "circuit" && circuitSpec ? (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Session — Day {sessionDay}
                      <span className="text-slate-500 text-sm ml-2">{sessionDate}</span>
                    </CardTitle>
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
                          // Optional manual finish (log all stations x rounds):
                          const auto: WorkoutEntry[] = [];
                          for (let r = 1; r <= circuitSpec.rounds; r++) {
                            for (const st of circuitSpec.stations) {
                              auto.push({
                                id: uid(),
                                date: sessionDate,
                                name: `${st.label} (sec)`,
                                sets: 1,
                                reps: st.seconds,
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
                    <CardTitle className="text-lg">
                      Session — Day {sessionDay}
                      <span className="text-slate-500 text-sm ml-2">{sessionDate}</span>
                    </CardTitle>
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
                          <>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Timed</span>
                            <Button size="sm" variant="outline" className="rounded-lg"
                              onClick={() => {
                                setSessionPlan(prev => prev.map((ex, i) => i === sessionIdx
                                  ? {
                                      name: ex.name,
                                      timed: false,
                                      restSec: ex.restSec,
                                      sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }],
                                    }
                                  : ex));
                              }}>
                              Convert to Sets/Reps
                            </Button>
                          </>
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
                        <div>
                          <Label>Seconds</Label>
                          <Input
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
                        </div>
                        <div className="col-span-2 self-end text-slate-500">(timed movement)</div>
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
                                </td>
                                <td className="py-2 pr-4">
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
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
                      <Label>Exercise</Label>
                      <Input placeholder="Exercise name" value={wName}
                        onChange={(e) => setWName(e.target.value)} />
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
                            const entry: WorkoutEntry = {
                              id: uid(),
                              date: sessionDate,
                              name: `${name} (sec)`,
                              sets: 1,
                              reps: secs,
                            };
                            const withPR = markPRsBeforeInsert(workouts, [entry]);
                            setWorkouts(prev => [...withPR, ...prev]);
                            setWName(""); setWSeconds("");
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
                          {dancerSplit.map((d) => (
                            <SelectItem key={d.day} value={String(d.day)}>
                              Day {d.day}
                            </SelectItem>
                          ))}
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
                          startSession(sessionDay);
                          setActiveTopTab("track");
                        }}
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
            <Card className="rounded-2xl shadow-sm mb-6">
              <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="text-lg">Progress (Daily Volume)</CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <Label className="mr-1">Exercise</Label>
                  <Select value={exerciseFilter} onValueChange={(v) => setExerciseFilter(v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All exercises" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All exercises</SelectItem>
                      {uniqueExercises.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  {dailyData.length === 0 ? (
                    <div className="h-full grid place-items-center text-sm text-slate-500">
                      No data yet — add a workout to see progress.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: any) => [
                            unit === "kg"
                              ? value
                              : Math.round(fromKg(Number(value), unit) * 10) / 10,
                            unit === "kg" ? "Volume (kg×reps)" : "Volume (lb×reps)",
                          ]}
                          labelClassName="text-xs"
                        />
                        <Line type="monotone" dataKey="volume" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Volume = sets × reps × weight ({unit}); entries without weight count as 1 per rep.
                </p>
              </CardContent>
            </Card>

            <WorkoutLogTable workouts={workouts} unit={unit} onChange={setWorkouts} />
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
