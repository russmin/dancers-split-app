import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Edit3, Save, X } from "lucide-react";
import { WorkoutEntry } from "@/components/WorkoutLogTable";
import { markPRsBeforeInsert } from "@/lib/pr";

function fromKg(kg: number, unit: "kg" | "lb") {
  return unit === "lb" ? kg / 0.45359237 : kg;
}

function toKg(value: number, unit: "kg" | "lb") {
  return unit === "lb" ? value * 0.45359237 : value;
}

function isThisWeek(dateISO: string): boolean {
  const date = new Date(dateISO + "T00:00:00");
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return date >= weekStart && date <= weekEnd;
}

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium text-emerald-700 border-emerald-200 bg-emerald-50">
    {children}
  </span>
);

interface Props {
  workouts: WorkoutEntry[];
  unit: "kg" | "lb";
  onChange?: (workouts: WorkoutEntry[]) => void;
}

function groupByWeek(workouts: WorkoutEntry[]) {
  const byWeek: Record<string, WorkoutEntry[]> = {};

  workouts.forEach((w) => {
    const date = new Date(w.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Sunday start
    const key = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(w);
  });

  return byWeek;
}

export default function WeeklyWorkoutLog({ workouts, unit, onChange }: Props) {
  const grouped = useMemo(() => groupByWeek(workouts), [workouts]);
  const weekKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // newest first
  const [activeWeek, setActiveWeek] = useState<string>(weekKeys[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, WorkoutEntry>>({});
  
  const display = grouped[activeWeek] ?? [];

  function startEdit(id: string) {
    setEditingId(id);
    const row = workouts.find(w => w.id === id);
    if (row) setEditDrafts(d => ({ ...d, [id]: { ...row } }));
  }

  function cancelEdit() {
    if (editingId) {
      setEditDrafts(d => {
        const copy = { ...d };
        delete copy[editingId];
        return copy;
      });
    }
    setEditingId(null);
  }

  function saveEdit(id: string) {
    if (!onChange) return;
    const patch = editDrafts[id];
    if (!patch) return setEditingId(null);
    
    // Remove the entry being edited from workouts to recalculate PRs correctly
    const workoutsWithoutEdited = workouts.filter(w => w.id !== id);
    
    // Recalculate PRs for the edited entry based on all other workouts
    const withPR = markPRsBeforeInsert(workoutsWithoutEdited, [patch]);
    
    // Replace the old entry with the new one (with updated PR flags)
    const updated = workouts.map(w => w.id === id ? withPR[0] : w);
    
    onChange(updated);
    setEditDrafts(d => {
      const copy = { ...d };
      delete copy[id];
      return copy;
    });
    setEditingId(null);
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle className="text-lg">Weekly Log</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          <Select value={activeWeek} onValueChange={(v) => setActiveWeek(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weekKeys.map((k, i) => (
                <SelectItem key={k} value={k}>
                  Week {weekKeys.length - i} ({k})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {display.length === 0 ? (
          <div className="text-sm text-slate-500">No workouts logged this week.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Exercise</th>
                  <th className="py-2 pr-4">Sets</th>
                  <th className="py-2 pr-4">Reps</th>
                  <th className="py-2 pr-4">Weight ({unit})</th>
                  {onChange && <th className="py-2 pr-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {display.map((w) => {
                  const isEditing = editingId === w.id;
                  const draft = editDrafts[w.id] ?? w;
                  const isPRThisWeek = isThisWeek(w.date) && (w.isPRMaxWeight || w.isPRVolume);
                  const rowClass = isPRThisWeek ? "bg-emerald-50 border-l-4 border-l-emerald-500" : "";

                  return (
                    <tr key={w.id} className={`border-b last:border-0 ${rowClass}`}>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={draft.date}
                            onChange={(e) =>
                              setEditDrafts(d => ({ ...d, [w.id]: { ...draft, date: e.target.value } }))
                            }
                            className="w-32"
                          />
                        ) : (
                          w.date
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {w.name}
                        {isPRThisWeek && (
                          <span className="ml-2 space-x-1">
                            {w.isPRMaxWeight && <Badge>PR (Max Wt)</Badge>}
                            {w.isPRVolume && <Badge>PR (Volume)</Badge>}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <Input
                            inputMode="numeric"
                            value={String(draft.sets)}
                            onChange={(e) =>
                              setEditDrafts(d => ({ ...d, [w.id]: { ...draft, sets: Number(e.target.value) || 0 } }))
                            }
                            className="w-16"
                          />
                        ) : (
                          w.sets
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <Input
                            inputMode="numeric"
                            value={String(draft.reps)}
                            onChange={(e) =>
                              setEditDrafts(d => ({ ...d, [w.id]: { ...draft, reps: Number(e.target.value) || 0 } }))
                            }
                            className="w-16"
                          />
                        ) : (
                          w.reps
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <Input
                            inputMode="numeric"
                            value={
                              draft.weightKg === undefined ? "" :
                              String(Math.round(fromKg(draft.weightKg, unit) * 10) / 10)
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const next: WorkoutEntry = {
                                ...draft,
                                weightKg: val === "" ? undefined
                                  : Math.round(toKg(Number(val), unit) * 100) / 100
                              };
                              setEditDrafts(d => ({ ...d, [w.id]: next }));
                            }}
                            className="w-20"
                          />
                        ) : (
                          w.weightKg
                            ? unit === "kg"
                              ? Math.round(w.weightKg)
                              : Math.round(w.weightKg / 0.45359237)
                            : "—"
                        )}
                      </td>
                      {onChange && (
                        <td className="py-2 pr-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Button size="icon" className="rounded-xl" onClick={() => saveEdit(w.id)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="rounded-xl" onClick={cancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => startEdit(w.id)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
