import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type CircuitSpec = {
  mode: "circuit";
  name: string;
  rounds: number;
  stationRestSec: number;
  roundRestSec?: number;
  stations: { label: string; seconds: number }[];
};

export interface WorkoutEntry {
  id: string;
  date: string;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number;
  notes?: string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const beep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    o.start();
    o.stop(ctx.currentTime + 0.16);
  } catch {}
};

export default function CircuitRunner({
  circuit,
  dateISO,
  onFinish,
  uid,
}: {
  circuit: CircuitSpec;
  dateISO: string;
  onFinish: (entries: WorkoutEntry[]) => void;
  uid: () => string;
}) {
  const [round, setRound] = React.useState(1);
  const [stationIndex, setStationIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<"work" | "rest">("work");
  const [remaining, setRemaining] = React.useState<number>(circuit.stations[0]?.seconds ?? 45);
  const [running, setRunning] = React.useState<boolean>(false);

  const [finished, setFinished] = React.useState(false);
  const [editableEntries, setEditableEntries] = React.useState<WorkoutEntry[]>([]);

  const totalStations = circuit.stations.length;
  const entriesRef = React.useRef<WorkoutEntry[]>([]);

  const stationSeconds = phase === "work"
    ? (circuit.stations[stationIndex]?.seconds ?? 45)
    : (stationIndex === totalStations ? (circuit.roundRestSec ?? 0) : circuit.stationRestSec);

  const last5 = remaining <= 5 && running;

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          beep();

          if (phase === "work") {
            const st = circuit.stations[stationIndex];
            entriesRef.current.push({
              id: uid(),
              date: dateISO,
              name: `${st.label} (sec)`,
              sets: 1,
              reps: st.seconds,
            });

            if (circuit.stationRestSec > 0 && stationIndex < totalStations - 1) {
              setPhase("rest");
              setRemaining(circuit.stationRestSec);
            } else {
              advanceToNext();
            }
          } else {
            advanceToNext();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase, stationIndex, round]);

  function advanceToNext() {
    const isLastStation = stationIndex >= totalStations - 1;
    const isLastRound = round >= circuit.rounds;

    if (!isLastStation) {
      const nextIdx = stationIndex + 1;
      setStationIndex(nextIdx);
      setPhase("work");
      setRemaining(circuit.stations[nextIdx].seconds);
      return;
    }

    if (!isLastRound) {
      const nextRound = round + 1;
      if (circuit.roundRestSec && circuit.roundRestSec > 0) {
        setPhase("rest");
        setRemaining(circuit.roundRestSec);
        setTimeout(() => {
          setRound(nextRound);
          setStationIndex(0);
          setPhase("work");
          setRemaining(circuit.stations[0].seconds);
        }, circuit.roundRestSec * 1000);
      } else {
        setRound(nextRound);
        setStationIndex(0);
        setPhase("work");
        setRemaining(circuit.stations[0].seconds);
      }
      return;
    }

    // Final round complete
    setEditableEntries([...entriesRef.current]);
    setFinished(true);
    setRunning(false);
  }

  const currentLabel = phase === "work" ? (circuit.stations[stationIndex]?.label ?? "—") : "Rest";
  const stationProgress = stationSeconds > 0 ? (1 - remaining / stationSeconds) : 0;
  const roundProgress = (
    (round - 1) * totalStations +
    (phase === "work" ? stationIndex : Math.min(stationIndex + 0.5, totalStations))
  ) / (circuit.rounds * totalStations);

  const nextStationLabel =
    phase === "rest" && stationIndex < totalStations - 1
      ? circuit.stations[stationIndex + 1]?.label
      : phase === "rest" && stationIndex >= totalStations - 1 && round < circuit.rounds
        ? circuit.stations[0]?.label
        : null;

  const nextStationSeconds =
    phase === "rest" && stationIndex < totalStations - 1
      ? circuit.stations[stationIndex + 1]?.seconds
      : phase === "rest" && stationIndex >= totalStations - 1 && round < circuit.rounds
        ? circuit.stations[0]?.seconds
        : null;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{circuit.name} — Round {round}/{circuit.rounds}</span>
          <span className="text-xs text-slate-500">Station {stationIndex + 1}/{totalStations}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Round progress */}
        <div className="h-1.5 w-full rounded bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-slate-400 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, roundProgress * 100))}%` }}
          />
        </div>

        <div className="text-sm">
          <Label>Current</Label>
          <div className="text-base font-semibold">{currentLabel}</div>
        </div>

        {/* Timer */}
        <div className={[
          "text-5xl font-mono text-center rounded-xl px-4 py-6 border",
          phase === "work" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200",
          last5 ? "animate-pulse" : ""
        ].join(" ")}>
          {fmt(remaining)}
        </div>

        {nextStationLabel && nextStationSeconds && (
          <div className="text-sm text-slate-600 text-center">
            🔜 Up Next: <strong>{nextStationLabel}</strong> ({nextStationSeconds}s)
          </div>
        )}

        {/* Station progress bar */}
        <div className="h-2 w-full rounded bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all ${phase === "work" ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${Math.max(0, Math.min(100, stationProgress * 100))}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-xl" onClick={() => setRunning(r => !r)}>
            {running ? "Pause" : "Start"}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setRunning(false);
              setRound(1);
              setStationIndex(0);
              setPhase("work");
              setRemaining(circuit.stations[0]?.seconds ?? 45);
              entriesRef.current = [];
              setFinished(false);
              setEditableEntries([]);
            }}
          >
            Reset
          </Button>
          <Button variant="ghost" className="rounded-xl" onClick={() => setRemaining((r) => Math.max(0, r - 10))}>-10s</Button>
          <Button variant="ghost" className="rounded-xl" onClick={() => setRemaining((r) => r + 10)}>+10s</Button>
          <Button variant="outline" className="rounded-xl" onClick={advanceToNext}>Skip ▶</Button>
        </div>

        {/* Station list */}
        <div className="text-xs text-slate-600">
          Stations:{" "}
          {circuit.stations.map((s, i) => (
            <span key={i}>
              {i ? " • " : ""}{s.label} {s.seconds}s
            </span>
          ))}
          {circuit.stationRestSec ? ` • Rest ${circuit.stationRestSec}s` : ""}
          {circuit.roundRestSec ? ` • Round rest ${circuit.roundRestSec}s` : ""}
        </div>

        {/* Final review UI */}
        {finished && (
          <div className="space-y-2 mt-6">
            <h3 className="text-base font-semibold">Finish Workout</h3>
            <p className="text-sm text-slate-600">Review and edit any reps or weight:</p>

            {editableEntries.map((entry, i) => (
              <div key={entry.id} className="flex flex-wrap gap-2 items-center">
                <div className="w-36 font-medium">{entry.name}</div>
                <div className="flex gap-1 items-center">
                  <Label className="text-xs">Reps</Label>
                  <input
                    type="number"
                    className="w-16 rounded border px-1 py-0.5 text-sm"
                    value={entry.reps}
                    onChange={(e) => {
                      const reps = parseInt(e.target.value) || 0;
                      setEditableEntries((prev) =>
                        prev.map((ent, idx) => idx === i ? { ...ent, reps } : ent)
                      );
                    }}
                  />
                </div>
                <div className="flex gap-1 items-center">
                  <Label className="text-xs">Weight</Label>
                  <input
                    type="number"
                    className="w-20 rounded border px-1 py-0.5 text-sm"
                    value={entry.weightKg ?? ""}
                    onChange={(e) => {
                      const weightKg = parseFloat(e.target.value);
                      setEditableEntries((prev) =>
                        prev.map((ent, idx) => idx === i ? { ...ent, weightKg } : ent)
                      );
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-3 mt-4">
              <Button className="rounded-xl" onClick={() => {
                onFinish([...editableEntries]);
                setFinished(false);
              }}>
                Save Workout
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => {
                setFinished(false);
                setEditableEntries([]);
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
