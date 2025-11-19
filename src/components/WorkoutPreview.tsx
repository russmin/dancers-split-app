/**
 * Workout Preview Component
 * 
 * Shows preview of workout before starting, allows editing exercises
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workout, Exercise, WorkoutPlan, WorkoutDay } from "@/lib/workoutLibrary";
import { CircuitSpec } from "@/components/CircuitRunner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkoutEntry } from "@/lib/pr";

interface Props {
  day: number;
  date: string;
  onDateChange: (date: string) => void;
  builtSession: {
    workout: Workout;
    planDay: WorkoutDay;
    mode: "circuit" | "sets";
    circuitSpec?: CircuitSpec | null;
    plan?: Array<{
      name: string;
      sets: Array<{ reps: number | ""; weight: number | "" }>;
      timed?: boolean;
      seconds?: number | "";
      restSec?: number;
      rounds?: number;
      reps?: number | "";
      weight?: number | "";
    }>;
  } | null;
  exercises: Exercise[];
  workoutLibrary: Workout[];
  onStart: (editedPlan?: any) => void;
  onCancel: () => void;
  onEditExercise: (index: number) => void;
  editingIndex: number | null;
  unit: "kg" | "lb";
  workouts: WorkoutEntry[];
  lastEntryFor: (workouts: WorkoutEntry[], name: string) => WorkoutEntry | undefined;
  fromKg: (kg: number, unit: "kg" | "lb") => number;
  roundDisplayUnit: (n: number, unit: "kg" | "lb") => number;
}

export default function WorkoutPreview({
  day,
  date,
  onDateChange,
  builtSession,
  exercises,
  workoutLibrary,
  onStart,
  onCancel,
  onEditExercise,
  editingIndex,
  unit,
  workouts,
  lastEntryFor,
  fromKg,
  roundDisplayUnit,
}: Props) {
  const [editedPlan, setEditedPlan] = useState(builtSession?.plan ? [...builtSession.plan] : []);
  const [addingExercise, setAddingExercise] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const KG_PER_LB = 0.45359237;
  const PO_INCR = { kg: 2.5, lb: 5 };

  useEffect(() => {
    if (builtSession?.plan) {
      setEditedPlan([...builtSession.plan]);
    }
  }, [builtSession]);

  if (!builtSession) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 text-center text-slate-600">
          <p>No workout found for Day {day}</p>
        </CardContent>
      </Card>
    );
  }

  const { workout, planDay } = builtSession;

  function addExercise() {
    if (!selectedExerciseId) return;
    const exercise = exercises.find((e) => e.id === selectedExerciseId);
    if (!exercise) return;

    const restSec = exercise.defaultRestSec ?? 90;

    if (exercise.isTimed) {
      const seconds = exercise.defaultSeconds ?? 30;
      setEditedPlan([
        ...editedPlan,
        {
          name: exercise.name,
          timed: true,
          seconds,
          restSec,
          sets: [{ reps: "", weight: "" }],
        },
      ]);
    } else {
      const sets = exercise.defaultSets ?? 3;
      const repRange = exercise.defaultRepRange;
      const repLow = repRange ? repRange[0] : 10;
      const repHigh = repRange ? repRange[1] : 12;

      let nextReps = repLow;
      let nextWeightUnit: number | "" = "";

      const prev = lastEntryFor(workouts, exercise.name);
      if (prev) {
        const prevReps = prev.reps ?? repLow;
        const prevWeightKg = prev.weightKg;

        if (repHigh && prevReps >= repHigh) {
          if (typeof prevWeightKg === "number") {
            const incKg = PO_INCR[unit] === 5 ? 5 * KG_PER_LB : 2.5;
            const suggestedKg = prevWeightKg + incKg;
            const asUnit = fromKg(suggestedKg, unit);
            nextWeightUnit = roundDisplayUnit(asUnit, unit);
          }
          nextReps = repLow;
        } else {
          nextReps = prevReps + 1;
          if (typeof prevWeightKg === "number") {
            const asUnit = fromKg(prevWeightKg, unit);
            nextWeightUnit = roundDisplayUnit(asUnit, unit);
          }
        }
      }

      const setsArr = Array.from({ length: sets }, () => ({
        reps: nextReps,
        weight: nextWeightUnit,
      }));

      setEditedPlan([
        ...editedPlan,
        {
          name: exercise.name,
          sets: setsArr,
          restSec,
        },
      ]);
    }

    setSelectedExerciseId("");
    setAddingExercise(false);
  }

  function removeExercise(index: number) {
    setEditedPlan(editedPlan.filter((_, i) => i !== index));
    if (editingIndex === index) {
      onEditExercise(-1);
    } else if (editingIndex !== null && editingIndex > index) {
      onEditExercise(editingIndex - 1);
    }
  }

  function updateExercise(index: number, updates: any) {
    setEditedPlan(editedPlan.map((ex, i) => (i === index ? { ...ex, ...updates } : ex)));
  }

  function moveExercise(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editedPlan.length) return;

    const newPlan = [...editedPlan];
    [newPlan[index], newPlan[newIndex]] = [newPlan[newIndex], newPlan[index]];
    setEditedPlan(newPlan);
  }

  if (builtSession.mode === "circuit" && builtSession.circuitSpec) {
    return (
      <Card className="rounded-2xl shadow-sm border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">
            Preview: Day {day} — {planDay.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Session Date</Label>
            <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="font-semibold mb-2">Circuit: {workout.name}</div>
            {workout.description && (
              <div className="text-sm text-slate-600 mb-2">{workout.description}</div>
            )}
            <div className="text-sm text-slate-600">
              {builtSession.circuitSpec.rounds} rounds • {builtSession.circuitSpec.stations.length} stations
            </div>
            <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
              {builtSession.circuitSpec.stations.map((st, i) => (
                <li key={i}>
                  {st.label}: {st.seconds}s
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={() => onStart()} className="rounded-xl">
              Start Workout
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="text-lg">
          Preview: Day {day} — {planDay.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Session Date</Label>
          <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-base font-semibold">Exercises ({editedPlan.length})</Label>
            {!addingExercise ? (
              <Button variant="outline" size="sm" onClick={() => setAddingExercise(true)} className="rounded-lg">
                + Add Exercise
              </Button>
            ) : (
              <div className="flex gap-2">
                <Select value={selectedExerciseId} onValueChange={setSelectedExerciseId}>
                  <SelectTrigger className="w-48 rounded-lg">
                    <SelectValue placeholder="Select exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {exercises
                      .filter((e) => !editedPlan.some((ep) => ep.name === e.name))
                      .map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addExercise} className="rounded-lg" disabled={!selectedExerciseId}>
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddingExercise(false);
                    setSelectedExerciseId("");
                  }}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {editedPlan.map((ex, index) => (
            <Card key={index} className="rounded-lg border">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="font-semibold flex-1">{ex.name}</div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveExercise(index, "up")}
                      disabled={index === 0}
                      className="rounded-lg"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveExercise(index, "down")}
                      disabled={index === editedPlan.length - 1}
                      className="rounded-lg"
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExercise(index)}
                      className="rounded-lg text-red-600"
                    >
                      ×
                    </Button>
                  </div>
                </div>

                {editingIndex === index ? (
                  <div className="space-y-2 mt-2 p-3 bg-slate-50 rounded">
                    {ex.timed ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Duration (seconds)</Label>
                          <Input
                            type="number"
                            value={ex.seconds ?? ""}
                            onChange={(e) =>
                              updateExercise(index, { seconds: e.target.value ? Number(e.target.value) : "" })
                            }
                          />
                        </div>
                        <div>
                          <Label>Rest (seconds)</Label>
                          <Input
                            type="number"
                            value={ex.restSec ?? ""}
                            onChange={(e) =>
                              updateExercise(index, { restSec: e.target.value ? Number(e.target.value) : undefined })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label>Sets</Label>
                            <Input
                              type="number"
                              value={ex.sets.length}
                              onChange={(e) => {
                                const sets = Number(e.target.value) || 1;
                                const currentSet = ex.sets[0];
                                updateExercise(index, {
                                  sets: Array.from({ length: sets }, () => ({
                                    reps: currentSet?.reps ?? "",
                                    weight: currentSet?.weight ?? "",
                                  })),
                                });
                              }}
                            />
                          </div>
                          <div>
                            <Label>Reps</Label>
                            <Input
                              type="number"
                              value={typeof ex.sets[0]?.reps === "number" ? ex.sets[0].reps : ""}
                              onChange={(e) => {
                                const reps = e.target.value ? Number(e.target.value) : "";
                                updateExercise(index, {
                                  sets: ex.sets.map(() => ({ ...ex.sets[0], reps })),
                                });
                              }}
                            />
                          </div>
                          <div>
                            <Label>Rest (seconds)</Label>
                            <Input
                              type="number"
                              value={ex.restSec ?? ""}
                              onChange={(e) =>
                                updateExercise(index, { restSec: e.target.value ? Number(e.target.value) : undefined })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditExercise(-1)}
                      className="rounded-lg w-full"
                    >
                      Done Editing
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">
                    {ex.timed
                      ? `${ex.seconds}s × ${ex.sets.length} sets @ ${ex.restSec ?? 90}s rest`
                      : `${ex.sets.length} sets × ${typeof ex.sets[0]?.reps === "number" ? ex.sets[0].reps : "?"} reps @ ${ex.restSec ?? 90}s rest`}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditExercise(index)}
                      className="ml-2 rounded-lg"
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {editedPlan.length === 0 && (
            <div className="text-center py-4 text-slate-500 text-sm">
              No exercises. Add exercises to continue.
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={() => onStart(editedPlan)} className="rounded-xl" disabled={editedPlan.length === 0}>
            Start Workout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

