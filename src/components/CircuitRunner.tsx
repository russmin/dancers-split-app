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

  // entries collected as we go (we only need work entries)
  const entriesRef = React.useRef<WorkoutEntry[]>([]);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          // Transition
          if (phase === "work") {
            // push a timed entry for this work
            const st = circuit.stations[stationIndex];
            entriesRef.current.push({
              id: uid(),
              date: dateISO,
              name: `${st.label} (sec)`,
              sets: 1,
              reps: st.seconds,
            });
            // go to rest or next station/round
            if (circuit.stationRestSec > 0) {
              setPhase("rest");
              setRemaining(circuit.stationRestSec);
            } else {
              advanceToNext();
            }
          } else {
            // finished rest: go to next
            advanceToNext();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, stationIndex, round]);

  function advanceToNext() {
    const lastStation = stationIndex >= circuit.stations.length - 1;
    if (!lastStation) {
      const nextIdx = stationIndex + 1;
      setStationIndex(nextIdx);
      setPhase("work");
      setRemaining(circuit.stations[nextIdx].seconds);
      return;
    }
    // last station in the round
    const lastRound = round >= circuit.rounds;
    if (!lastRound) {
      // optional round rest
      if (circuit.roundRestSec && circuit.roundRestSec > 0) {
        setPhase("rest");
        setRemaining(circuit.roundRestSec);
        // after round rest, move to next round’s first station
        setTimeout(() => {
          setRound((r) => r + 1);
          setStationIndex(0);
          setPhase("work");
          setRemaining(circuit.stations[0].seconds);
        }, 0);
      } else {
        setRound((r) => r + 1);
        setStationIndex(0);
        setPhase("work");
        setRemaining(circuit.stations[0].seconds);
      }
      return;
    }
    // all done
    onFinish([...entriesRef.current]);
    // reset UI
    setRunning(false);
  }

  const currentLabel =
    phase === "work"
      ? circuit.stations[stationIndex]?.label ?? "—"
      : "Rest";

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{circuit.name} — Round {round}/{circuit.rounds}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <div><Label>Current</Label></div>
          <div className="text-base font-semibold">{currentLabel}</div>
        </div>
        <div className="text-4xl font-mono">{fmt(remaining)}</div>
        <div className="flex items-center gap-2">
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
            }}
          >
            Reset
          </Button>
        </div>

        {/* Simple preview */}
        <div className="text-xs text-slate-600">
          Stations:{" "}
          {circuit.stations.map((s, i) => (
            <span key={i}>
              {i ? " • " : ""}
              {s.label} {s.seconds}s
            </span>
          ))}
          {circuit.stationRestSec ? ` • Rest ${circuit.stationRestSec}s` : ""}
          {circuit.roundRestSec ? ` • Round rest ${circuit.roundRestSec}s` : ""}
        </div>
      </CardContent>
    </Card>
  );
}
