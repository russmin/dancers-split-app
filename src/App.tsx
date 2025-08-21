
import ProfileTab from "@/components/ProfileTab";
import PlanTab from "@/components/PlanTab";
import WorkoutLogTable from "@/components/WorkoutLogTable";
import { markPRsBeforeInsert } from "@/lib/pr";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, PlusCircle, BarChart3, User } from "lucide-react";

/* --------------------------------------------
   Plan Data (Final 4-Day Dancer's Split)
---------------------------------------------*/
const dancerSplit = [
  {
    day: 1,
    title: "Lower Body Strength & Stability ",
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
      "Cable Woodchoppers (High to Low): 12 reps/side",
      "Plank: 60s hold",
    ],
  },
  {
    day: 4,
    title: "Dance-Specific Power & Plyometrics ",
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
   Types & Helpers
---------------------------------------------*/
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
}

interface WorkoutEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // exercise name
  sets: number; // per-set logs will be 1
  reps: number; // per-set reps
  weightKg?: number; // stored in kg
  notes?: string;
}

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

/* --------------------------------------------
   Plan parsing helpers
---------------------------------------------*/
function extractRestSeconds(source: string): number | undefined {
  const paren = source.match(/\(([^)]*?)\)/g);
  if (!paren) return undefined;
  const restChunk = paren.find(p => /rest/i.test(p));
  if (!restChunk) return undefined;

  const minRange = restChunk.match(/(\d+)\s*-\s*(\d+)\s*min/i);
  if (minRange) {
    const a = Number(minRange[1]), b = Number(minRange[2]);
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

/* --------------------------------------------
   RestTimer widget (auto-advances on finish if onDone provided)
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
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          onDone?.();
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
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setRunning(r => !r)}>
        {running ? "Pause" : "Start"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl"
        onClick={() => { setRunning(false); setRemaining(seconds); }}
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
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    age: "",
    heightCm: "",
    weightKg: "",
    goal: "",
    unit: "kg",
    programName: "Final 4-Day Dancer's Split",
    programDurationWeeks: 8,
    daysPerWeek: 4,
    preferredDays: ["Mon", "Tue", "Thu", "Sat"],
  });

  // Workouts
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);

  // Manual log form
  const [wDate, setWDate] = useState<string>(todayISO());
  const [wName, setWName] = useState<string>("");
  const [wSets, setWSets] = useState<string>("3");
  const [wReps, setWReps] = useState<string>("10");
  const [wWeight, setWWeight] = useState<string>("");
  const [wNotes, setWNotes] = useState<string>("");

  // Session runner
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionDay, setSessionDay] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState<string>(todayISO());
  const [sessionIdx, setSessionIdx] = useState(0);             // which exercise
  const [currentSetIdx, setCurrentSetIdx] = useState(0);       // which set in exercise
  const [restStartSignal, setRestStartSignal] = useState(0);   // bump to auto-start rest timer

  const [sessionPlan, setSessionPlan] = useState<{
    name: string;
    sets: { reps: number | ""; weight: number | "" }[];
    timed?: boolean;
    seconds?: number | "";
    restSec?: number;
  }[]>([]);

  // View state
//  const [sortBy, setSortBy] = useState<"date" | "name" | "volume">("date");
  const [exerciseFilter, setExerciseFilter] = useState<string>("__all");
 // const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTopTab, setActiveTopTab] = useState<string>("plan");
  const [activePlanDay, setActivePlanDay] = useState<string>("1");

  // Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.profile);
      const w = localStorage.getItem(STORAGE_KEYS.workouts);
      if (p) setProfile(JSON.parse(p));
      if (w) setWorkouts(JSON.parse(w));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(workouts));
  }, [workouts]);

  // Derived
  const unit = profile.unit ?? "kg";
  const uniqueExercises = useMemo(() => Array.from(new Set(workouts.map(w => w.name))).sort(), [workouts]);
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

/*   const sortedWorkouts = useMemo(() => {
    const copy = [...workouts];
    switch (sortBy) {
      case "name":
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "volume":
        copy.sort((a, b) => (b.sets * b.reps * (b.weightKg ?? 1)) - (a.sets * a.reps * (a.weightKg ?? 1)));
        break;
      default:
        copy.sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    return copy;
  }, [workouts, sortBy]); */

  // Plan/session helpers
  function startSession(day: number) {
    const d = dancerSplit.find(x => x.day === day);
    if (!d) return;
    const plan = d.exercises
      .filter(s => !/^Format:/i.test(s))
      .map(s => {
        const name = s.split(":")[0];
        const parsed = parseSetsAndReps(s);
        const restSec = extractRestSeconds(s);
        if (parsed.timed) {
          return { name, timed: true, seconds: parsed.seconds, restSec, sets: [{ reps: "", weight: "" }] };
        }
        const setsArr = Array.from({ length: parsed.sets }, () => ({ reps: parsed.reps as number, weight: "" as number | "" }));
        return { name, sets: setsArr, restSec };
      });
    setSessionPlan(plan as any);
    setSessionIdx(0);
    setCurrentSetIdx(0);
    setSessionDay(day);
    setSessionActive(true);
    setActiveTopTab("track");
  }

  function finishSessionAndSave() {
    const entries: WorkoutEntry[] = [];
    for (const ex of sessionPlan) {
      if (ex.timed) {
        entries.push({ id: uid(), date: sessionDate, name: ex.name + " (sec)", sets: 1, reps: Number(ex.seconds) || 0, weightKg: undefined });
        continue;
      }
      ex.sets.forEach((s) => {
        const reps = Number(s.reps) || 0;
        const weightKg = s.weight === "" ? undefined : Math.round(toKg(Number(s.weight), unit) * 100) / 100;
        entries.push({ id: uid(), date: sessionDate, name: ex.name, sets: 1, reps, weightKg });
      });
    }
    if (entries.length === 0) return setSessionActive(false);
    const withPR = markPRsBeforeInsert(workouts, entries);
    setWorkouts(prev => [...withPR, ...prev]);
    setSessionActive(false);
  }

  function updateSet(exIdx: number, setIdx: number, field: "reps" | "weight", value: string) {
    setSessionPlan(prev => prev.map((ex, i) => {
      if (i !== exIdx || ex.timed) return ex;
      const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: value === "" ? "" : Number(value) } : s);
      return { ...ex, sets };
    }));
  }

  function preferredToggle(day: string) {
    setProfile(p => ({
      ...p,
      preferredDays: p.preferredDays?.includes(day)
        ? p.preferredDays.filter(d => d !== day)
        : [...(p.preferredDays || []), day],
    }));
  }

  // Generic actions
  function handleProfileChange<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile(p => ({ ...p, [key]: value }));
  }

  function addWorkout(fromPlan?: { name: string }) {
    const name = fromPlan?.name ?? wName;
    if (!name.trim()) return alert("Please enter a workout name.");
    const sets = Number(wSets);
    const reps = Number(wReps);
    const rawWeight = wWeight === "" ? undefined : Number(wWeight);
    if (!Number.isFinite(sets) || sets <= 0) return alert("Sets must be a positive number.");
    if (!Number.isFinite(reps) || reps <= 0) return alert("Reps must be a positive number.");
    if (rawWeight !== undefined && (!Number.isFinite(rawWeight) || rawWeight < 0)) return alert("Weight must be a non-negative number.");

    const entry: WorkoutEntry = {
      id: uid(),
      date: wDate,
      name: name.trim(),
      sets,
      reps,
      weightKg: rawWeight === undefined ? undefined : Math.round(toKg(rawWeight, unit) * 100) / 100,
      notes: wNotes.trim() || undefined,
    };
    const withPR = markPRsBeforeInsert(workouts, [entry]);
    setWorkouts(prev => [...withPR, ...prev]);

    if (!fromPlan) setWName("");
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
  function onImportClick() { fileInputRef.current?.click(); }
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

  // UI
  const profileComplete = profile.name.trim().length > 0;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-900 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7" />
          <motion.h1 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-semibold tracking-tight">
            Dancer's Split — Plan & Tracker
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
              onStartSession={(day) => { startSession(day); setActiveTopTab("track"); }}
            />
          </TabsContent>


          {/* TRACK TAB (session runner + manual) */}
          <TabsContent value="track">
            <div className="space-y-6">
              {/* Session runner */}
              {sessionActive ? (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Session — Day {sessionDay}
                    <span className="text-slate-500 text-sm ml-2">{sessionDate}</span>
                  </CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <Label htmlFor="sdate">Session date</Label>
                      <Input id="sdate" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="font-medium">{sessionPlan[sessionIdx]?.name ?? ""}</div>
                      <div className="space-x-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => { setSessionIdx((i) => Math.max(0, i-1)); setCurrentSetIdx(0); }}>Prev</Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => { setSessionIdx((i) => Math.min(sessionPlan.length-1, i+1)); setCurrentSetIdx(0); }}>Next</Button>
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
                                setCurrentSetIdx(i => i + 1);
                              } else if (sessionIdx < sessionPlan.length - 1) {
                                setSessionIdx(i => i + 1);
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
                          <Input inputMode="numeric" value={sessionPlan[sessionIdx].seconds as any} onChange={(e) => {
                            const v = e.target.value; setSessionPlan(prev => prev.map((ex, i) => i===sessionIdx ? { ...ex, seconds: v === "" ? "" : Number(v) } : ex));
                          }} />
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
                              <tr key={j} className={`border-b last:border-0 ${j === currentSetIdx ? "bg-slate-50" : ""}`}>
                                <td className="py-2 pr-4">{j+1}</td>
                                <td className="py-2 pr-4"><Input inputMode="numeric" value={String(s.reps)} onChange={(e) => updateSet(sessionIdx, j, "reps", e.target.value)} /></td>
                                <td className="py-2 pr-4"><Input inputMode="numeric" value={s.weight === "" ? "" : String(s.weight)} onChange={(e) => updateSet(sessionIdx, j, "weight", e.target.value)} placeholder={unit === "kg" ? "40" : "90"} /></td>
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
                            if (rest > 0) {
                              setRestStartSignal(n => n + 1); // kick off timer; onDone advances
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
                      <Button variant="outline" className="rounded-xl" onClick={() => setSessionActive(false)}>Cancel</Button>
                      {sessionIdx === sessionPlan.length - 1 ? (
                        <Button className="rounded-xl" onClick={finishSessionAndSave}>Finish Session & Save</Button>
                      ) : (
                        <Button className="rounded-xl" onClick={() => { setSessionIdx(i => Math.min(sessionPlan.length-1, i+1)); setCurrentSetIdx(0); }}>Complete Exercise →</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Start a Session</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <Label>Day</Label>
                      <Select value={String(sessionDay)} onValueChange={(v) => setSessionDay(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {dancerSplit.map(d => <SelectItem key={d.day} value={String(d.day)}>Day {d.day}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <Button className="w-full rounded-xl" onClick={() => startSession(sessionDay)}>Start</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Manual logging */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><PlusCircle className="h-5 w-5" /> Manual Log</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="wname">Exercise</Label>
                      <Input id="wname" placeholder="e.g., Bulgarian Split Squat" value={wName} onChange={(e) => setWName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="sets">Sets</Label>
                      <Input id="sets" inputMode="numeric" value={wSets} onChange={(e) => setWSets(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="reps">Reps</Label>
                      <Input id="reps" inputMode="numeric" value={wReps} onChange={(e) => setWReps(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="weight">Weight ({unit}) — optional</Label>
                      <Input id="weight" inputMode="numeric" placeholder={unit === "kg" ? "40" : "90"} value={wWeight} onChange={(e) => setWWeight(e.target.value)} />
                    </div>
                    <div className="md:col-span-6">
                      <Label htmlFor="notes">Notes</Label>
                      <Input id="notes" placeholder="tempo, partial ROM, cues, RPE…" value={wNotes} onChange={(e) => setWNotes(e.target.value)} />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <Button className="w-full rounded-xl" onClick={() => addWorkout()}>Add Workout</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="All exercises" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All exercises</SelectItem>
                      {uniqueExercises.map(n => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  {dailyData.length === 0 ? (
                    <div className="h-full grid place-items-center text-sm text-slate-500">No data yet — add a workout to see progress.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: any) => [
                            unit === "kg" ? value : Math.round(fromKg(Number(value), unit) * 10) / 10,
                            unit === "kg" ? "Volume (kg×reps)" : "Volume (lb×reps)",
                          ]}
                          labelClassName="text-xs"
                        />
                        <Line type="monotone" dataKey="volume" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">Volume = sets × reps × weight ({unit}); weightless entries count as 1 per rep.</p>
              </CardContent>
            </Card>

            <WorkoutLogTable
              workouts={workouts}
              unit={unit}
              onChange={setWorkouts}
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
