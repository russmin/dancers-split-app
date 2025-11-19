import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit3, Save, X, Trash2 } from "lucide-react";
import { markPRsBeforeInsert } from "@/lib/pr";

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium text-emerald-700 border-emerald-200 bg-emerald-50">
    {children}
  </span>
);

export interface WorkoutEntry {
  id: string;
  date: string;      // YYYY-MM-DD
  name: string;      // exercise name
  sets: number;      // per-set logs may be 1; manual logs can be >1
  reps: number;      // per-set reps or seconds if timed entry "(sec)"
  weightKg?: number; // always stored in kg
  notes?: string;
  isPRMaxWeight?: boolean;
  isPRVolume?: boolean;
}

type SortBy = "date" | "name" | "volume";

function fromKg(kg: number, unit: "kg" | "lb") {
  return unit === "lb" ? kg / 0.45359237 : kg;
}
function toKg(value: number, unit: "kg" | "lb") {
  return unit === "lb" ? value * 0.45359237 : value;
}

interface Props {
  workouts: WorkoutEntry[];
  unit: "kg" | "lb";
  onChange: (next: WorkoutEntry[]) => void; // usually setWorkouts
}

export default function WorkoutLogTable({ workouts, unit, onChange }: Props) {
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, WorkoutEntry>>({});

  const sorted = useMemo(() => {
    const copy = [...workouts];
    switch (sortBy) {
      case "name":
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "volume":
        copy.sort((a, b) =>
          (b.sets * b.reps * (b.weightKg ?? 1)) - (a.sets * a.reps * (a.weightKg ?? 1))
        );
        break;
      default:
        copy.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
    }
    return copy;
  }, [workouts, sortBy]);

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
  function removeWorkout(id: string) {
    onChange(workouts.filter(w => w.id !== id));
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Workout Log</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          <Label className="mr-1">Sort</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date (newest)</SelectItem>
              <SelectItem value="name">Workout name</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {sorted.length === 0 ? (
          <div className="text-sm text-slate-500">No workouts logged yet.</div>
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
                  <th className="py-2 pr-4">Volume</th>
                  <th className="py-2 pr-4">Notes</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((w) => {
                  const isEditing = editingId === w.id;
                  const draft = editDrafts[w.id] ?? w;
                  const volumeKg = draft.sets * draft.reps * (draft.weightKg ?? 1);
                  const weightDisplay = draft.weightKg === undefined
                    ? "—"
                    : (Math.round(fromKg(draft.weightKg, unit) * 10) / 10).toString();

                  // Check if this is a PR from this week
                  const isPRThisWeek = (() => {
                    const date = new Date(w.date + "T00:00:00");
                    const today = new Date();
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay()); // Sunday
                    weekStart.setHours(0, 0, 0, 0);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    weekEnd.setHours(23, 59, 59, 999);
                    const isThisWeek = date >= weekStart && date <= weekEnd;
                    return isThisWeek && (w.isPRMaxWeight || w.isPRVolume);
                  })();

                  const rowClass = isPRThisWeek ? "bg-emerald-50 border-l-4 border-l-emerald-500" : "";

                  return (
                    <tr key={w.id} className={`border-b last:border-0 ${rowClass}`}>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={draft.date}
                            onChange={(e) =>
                              setEditDrafts(d => ({ ...d, [w.id]: { ...draft, date: e.target.value } }))
                            }
                          />
                        ) : (
                          w.date
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {w.name}
                        <span className="ml-2 space-x-1">
                          {w.isPRMaxWeight && <Badge>PR (Max Wt)</Badge>}
                          {w.isPRVolume && <Badge>PR (Volume)</Badge>}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <Input
                            inputMode="numeric"
                            value={String(draft.sets)}
                            onChange={(e) =>
                              setEditDrafts(d => ({ ...d, [w.id]: { ...draft, sets: Number(e.target.value) || 0 } }))
                            }
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
                          />
                        ) : (
                          weightDisplay
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {unit === "kg" ? Math.round(volumeKg) : Math.round(fromKg(volumeKg, unit))}
                      </td>
                      <td className="py-2 pr-4 max-w-[260px] truncate" title={draft.notes ?? ""}>
                        {isEditing ? (
                          <Input
                            value={draft.notes ?? ""}
                            onChange={(e) =>
                              setEditDrafts(d => ({ ...d, [w.id]: { ...draft, notes: (e.target as any).value } }))
                            }
                          />
                        ) : (
                          w.notes ?? "—"
                        )}
                      </td>
                      <td className="py-2 pr-4 flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button size="icon" className="rounded-xl" onClick={() => saveEdit(w.id)}><Save className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-xl" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => startEdit(w.id)}><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="hover:bg-rose-50 hover:text-rose-600 rounded-xl" onClick={() => removeWorkout(w.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </td>
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