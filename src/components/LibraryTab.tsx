/**
 * Library Management Tab
 * 
 * UI for managing exercises, workouts, and plans in the library
 */

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Exercise,
  Workout,
  WorkoutPlan,
  ExerciseCategory,
  MuscleGroup,
  WorkoutMode,
  generateId,
} from "@/lib/workoutLibrary";

interface Props {
  exercises: Exercise[];
  workouts: Workout[];
  plans: WorkoutPlan[];
  onUpdateExercises: (exercises: Exercise[]) => void;
  onUpdateWorkouts: (workouts: Workout[]) => void;
  onUpdatePlans: (plans: WorkoutPlan[]) => void;
  onSelectPlan: (plan: WorkoutPlan | null) => void;
}

export default function LibraryTab({
  exercises,
  workouts,
  plans,
  onUpdateExercises,
  onUpdateWorkouts,
  onUpdatePlans,
  onSelectPlan,
}: Props) {
  const [activeTab, setActiveTab] = useState<"exercises" | "workouts" | "plans">("exercises");
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [exerciseFilter, setExerciseFilter] = useState<string>("all");
  const [exerciseSearch, setExerciseSearch] = useState<string>("");

  // Exercise management
  function handleCreateExercise() {
    const newExercise: Exercise = {
      id: generateId(),
      name: "",
      category: "strength",
      muscleGroups: [],
      defaultRepRange: [10, 12],
      defaultSets: 3,
      defaultRestSec: 90,
    };
    setEditingExercise(newExercise);
  }

  function handleSaveExercise(exercise: Exercise) {
    if (!exercise.name.trim()) return;

    const updated = editingExercise?.id
      ? exercises.map((e) => (e.id === exercise.id ? exercise : e))
      : [...exercises, exercise];

    onUpdateExercises(updated);
    setEditingExercise(null);
  }

  function handleDeleteExercise(id: string) {
    if (!confirm("Delete this exercise? This will remove it from all workouts.")) return;
    onUpdateExercises(exercises.filter((e) => e.id !== id));
  }

  // Workout management
  function handleCreateWorkout() {
    const newWorkout: Workout = {
      id: generateId(),
      name: "",
      description: "",
      mode: "sets-reps",
      exercises: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    setEditingWorkout(newWorkout);
  }

  function handleSaveWorkout(workout: Workout) {
    if (!workout.name.trim()) return;

    const updated = editingWorkout?.id
      ? workouts.map((w) => (w.id === workout.id ? { ...workout, updated: new Date().toISOString() } : w))
      : [...workouts, workout];

    onUpdateWorkouts(updated);
    setEditingWorkout(null);
  }

  function handleDeleteWorkout(id: string) {
    if (!confirm("Delete this workout? This will remove it from all plans.")) return;
    onUpdateWorkouts(workouts.filter((w) => w.id !== id));
  }

  // Plan management
  function handleCreatePlan() {
    const newPlan: WorkoutPlan = {
      id: generateId(),
      name: "",
      description: "",
      days: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    setEditingPlan(newPlan);
  }

  function handleSavePlan(plan: WorkoutPlan) {
    if (!plan.name.trim()) return;

    const updated = editingPlan?.id
      ? plans.map((p) => (p.id === plan.id ? { ...plan, updated: new Date().toISOString() } : p))
      : [...plans, plan];

    onUpdatePlans(updated);
    setEditingPlan(null);
  }

  function handleDeletePlan(id: string) {
    if (!confirm("Delete this plan?")) return;
    onUpdatePlans(plans.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Workout Library</CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Manage your exercise library, create workouts, and build workout plans.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="exercises">Exercises ({exercises.length})</TabsTrigger>
              <TabsTrigger value="workouts">Workouts ({workouts.length})</TabsTrigger>
              <TabsTrigger value="plans">Plans ({plans.length})</TabsTrigger>
            </TabsList>

            {/* Exercises Tab */}
            <TabsContent value="exercises" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="font-semibold">Exercise Library ({exercises.length} exercises)</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Search exercises..."
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    className="rounded-lg"
                  />
                  <Select value={exerciseFilter} onValueChange={setExerciseFilter}>
                    <SelectTrigger className="w-40 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      <SelectItem value="chest">Chest</SelectItem>
                      <SelectItem value="back">Back</SelectItem>
                      <SelectItem value="shoulders">Shoulders</SelectItem>
                      <SelectItem value="arms">Arms</SelectItem>
                      <SelectItem value="legs">Legs</SelectItem>
                      <SelectItem value="glutes">Glutes</SelectItem>
                      <SelectItem value="core">Core</SelectItem>
                      <SelectItem value="calves">Calves</SelectItem>
                      <SelectItem value="hamstrings">Hamstrings</SelectItem>
                      <SelectItem value="quads">Quads</SelectItem>
                      <SelectItem value="full-body">Full Body</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleCreateExercise} className="rounded-xl">
                    + Add
                  </Button>
                </div>
              </div>

              <Dialog open={!!editingExercise} onOpenChange={(open) => !open && setEditingExercise(null)}>
                <DialogContent onClose={() => setEditingExercise(null)}>
                  {editingExercise && (
                    <ExerciseEditor
                      exercise={editingExercise}
                      onSave={(ex) => handleSaveExercise(ex)}
                      onCancel={() => setEditingExercise(null)}
                    />
                  )}
                </DialogContent>
              </Dialog>

              <ExercisesByGroup
                exercises={exercises}
                filter={exerciseFilter}
                search={exerciseSearch}
                onEdit={(ex) => setEditingExercise(ex)}
                onDelete={(id) => handleDeleteExercise(id)}
              />
            </TabsContent>

            {/* Workouts Tab */}
            <TabsContent value="workouts" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Workout Library</h3>
                <Button onClick={handleCreateWorkout} className="rounded-xl">
                  + Create Workout
                </Button>
              </div>

              {editingWorkout && (
                <WorkoutEditor
                  workout={editingWorkout}
                  exercises={exercises}
                  onSave={(w) => handleSaveWorkout(w)}
                  onCancel={() => setEditingWorkout(null)}
                />
              )}

              <div className="grid gap-3">
                {workouts.map((w) => (
                  <Card key={w.id} className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{w.name}</div>
                          {w.description && (
                            <div className="text-sm text-slate-600 mt-1">{w.description}</div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {w.mode} • {w.exercises.length} exercises
                            {w.mode === "circuit" && w.rounds && ` • ${w.rounds} rounds`}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingWorkout(w)}
                            className="rounded-lg"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteWorkout(w.id)}
                            className="rounded-lg"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Plans Tab */}
            <TabsContent value="plans" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Workout Plans</h3>
                <Button onClick={handleCreatePlan} className="rounded-xl">
                  + Create Plan
                </Button>
              </div>

              {editingPlan && (
                <PlanEditor
                  plan={editingPlan}
                  workouts={workouts}
                  onSave={(p) => handleSavePlan(p)}
                  onCancel={() => setEditingPlan(null)}
                />
              )}

              <div className="grid gap-3">
                {plans.map((p) => (
                  <Card key={p.id} className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          {p.description && (
                            <div className="text-sm text-slate-600 mt-1">{p.description}</div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {p.days.length} days • {p.daysPerWeek ?? "?"} days/week • {p.durationWeeks ?? "?"} weeks
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPlan(p);
                              onSelectPlan(p);
                            }}
                            className="rounded-lg"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectPlan(p)}
                            className="rounded-lg"
                          >
                            Use Plan
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePlan(p.id)}
                            className="rounded-lg"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Exercises by Group Component
function ExercisesByGroup({
  exercises,
  filter,
  search,
  onEdit,
  onDelete,
}: {
  exercises: Exercise[];
  filter: string;
  search: string;
  onEdit: (ex: Exercise) => void;
  onDelete: (id: string) => void;
}) {
  const muscleGroupOrder: MuscleGroup[] = [
    "full-body",
    "chest",
    "back",
    "shoulders",
    "arms",
    "legs",
    "glutes",
    "quads",
    "hamstrings",
    "calves",
    "core",
  ];

  // Filter and search exercises
  const filteredExercises = exercises.filter((ex) => {
    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      if (
        !ex.name.toLowerCase().includes(searchLower) &&
        !ex.category.toLowerCase().includes(searchLower) &&
        !ex.muscleGroups.some((mg) => mg.toLowerCase().includes(searchLower)) &&
        !(ex.equipment?.some((eq) => eq.toLowerCase().includes(searchLower)) ?? false)
      ) {
        return false;
      }
    }

    // Muscle group filter
    if (filter !== "all") {
      return ex.muscleGroups.includes(filter as MuscleGroup);
    }

    return true;
  });

  // Group exercises by muscle group
  const groupedExercises: Record<string, Exercise[]> = {};

  filteredExercises.forEach((ex) => {
    // If filter is set, only show in that group
    if (filter !== "all") {
      const group = filter;
      if (!groupedExercises[group]) groupedExercises[group] = [];
      groupedExercises[group].push(ex);
    } else {
      // Show in all relevant groups
      ex.muscleGroups.forEach((mg) => {
        if (!groupedExercises[mg]) groupedExercises[mg] = [];
        // Only add if not already in this group (to avoid duplicates)
        if (!groupedExercises[mg].some((e) => e.id === ex.id)) {
          groupedExercises[mg].push(ex);
        }
      });

      // If no muscle groups, put in "uncategorized"
      if (ex.muscleGroups.length === 0) {
        if (!groupedExercises["uncategorized"]) groupedExercises["uncategorized"] = [];
        groupedExercises["uncategorized"].push(ex);
      }
    }
  });

  // Sort groups by order
  const sortedGroups = Object.keys(groupedExercises).sort((a, b) => {
    const indexA = muscleGroupOrder.indexOf(a as MuscleGroup);
    const indexB = muscleGroupOrder.indexOf(b as MuscleGroup);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // If filtered by a specific group or search, show flat list
  if (filter !== "all" || search.trim()) {
    return (
      <div className="grid gap-3">
        {filteredExercises.map((ex) => (
          <ExerciseCard key={ex.id} exercise={ex} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {filteredExercises.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No exercises found matching your criteria.
          </div>
        )}
      </div>
    );
  }

  // Show grouped view
  return (
    <div className="space-y-6">
      {sortedGroups.map((group) => {
        const groupExercises = groupedExercises[group];
        if (groupExercises.length === 0) return null;

        return (
          <div key={group} className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-lg capitalize">
                {group === "uncategorized" ? "Uncategorized" : group.replace("-", " ")}
              </h4>
              <span className="text-sm text-slate-500">({groupExercises.length})</span>
            </div>
            <div className="grid gap-3">
              {groupExercises.map((ex) => (
                <ExerciseCard key={ex.id} exercise={ex} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
      {sortedGroups.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No exercises found. Add your first exercise to get started.
        </div>
      )}
    </div>
  );
}

// Exercise Card Component
function ExerciseCard({
  exercise,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  onEdit: (ex: Exercise) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="font-semibold">{exercise.name}</div>
            <div className="text-sm text-slate-600 mt-1">
              {exercise.category} • {exercise.muscleGroups.join(", ") || "No muscle groups"}
            </div>
            {exercise.equipment && exercise.equipment.length > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                Equipment: {exercise.equipment.join(", ")}
              </div>
            )}
            {exercise.isTimed ? (
              <div className="text-xs text-slate-500 mt-1">
                Timed: {exercise.defaultSeconds}s × {exercise.defaultSets ?? 3} sets @ {exercise.defaultRestSec ?? 90}s rest
              </div>
            ) : exercise.defaultRepRange ? (
              <div className="text-xs text-slate-500 mt-1">
                Default: {exercise.defaultSets}x{exercise.defaultRepRange[0]}-{exercise.defaultRepRange[1]} @ {exercise.defaultRestSec ?? 90}s rest
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(exercise)}
              className="rounded-lg"
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(exercise.id)}
              className="rounded-lg"
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Exercise Editor Component
function ExerciseEditor({
  exercise,
  onSave,
  onCancel,
}: {
  exercise: Exercise;
  onSave: (ex: Exercise) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<Exercise>(exercise);

  const categories: ExerciseCategory[] = [
    "strength",
    "cardio",
    "mobility",
    "plyometric",
    "core",
    "dance-specific",
    "other",
  ];

  const muscleGroups: MuscleGroup[] = [
    "chest",
    "back",
    "shoulders",
    "arms",
    "legs",
    "glutes",
    "core",
    "full-body",
    "calves",
    "hamstrings",
    "quads",
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{exercise.id ? "Edit Exercise" : "Create Exercise"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name *</Label>
          <Input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Exercise name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select
              value={state.category}
              onValueChange={(v) => setState({ ...state, category: v as ExerciseCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Default Sets</Label>
            <Input
              type="number"
              value={state.defaultSets ?? ""}
              onChange={(e) =>
                setState({ ...state, defaultSets: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
        </div>

        <div>
          <Label>Muscle Groups</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 p-3 border rounded-lg bg-slate-50">
            {muscleGroups.map((mg) => {
              const isSelected = state.muscleGroups.includes(mg);
              return (
                <label
                  key={mg}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setState({
                          ...state,
                          muscleGroups: [...state.muscleGroups, mg],
                        });
                      } else {
                        setState({
                          ...state,
                          muscleGroups: state.muscleGroups.filter((g) => g !== mg),
                        });
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="capitalize">{mg.replace("-", " ")}</span>
                </label>
              );
            })}
          </div>
        </div>

        {!state.isTimed && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rep Range (min)</Label>
              <Input
                type="number"
                value={state.defaultRepRange?.[0] ?? ""}
                onChange={(e) =>
                  setState({
                    ...state,
                    defaultRepRange: [
                      Number(e.target.value) || 0,
                      state.defaultRepRange?.[1] ?? 12,
                    ],
                  })
                }
              />
            </div>
            <div>
              <Label>Rep Range (max)</Label>
              <Input
                type="number"
                value={state.defaultRepRange?.[1] ?? ""}
                onChange={(e) =>
                  setState({
                    ...state,
                    defaultRepRange: [
                      state.defaultRepRange?.[0] ?? 10,
                      Number(e.target.value) || 0,
                    ],
                  })
                }
              />
            </div>
          </div>
        )}

        <div>
          <Label>Default Rest (seconds)</Label>
          <Input
            type="number"
            value={state.defaultRestSec ?? ""}
            onChange={(e) =>
              setState({ ...state, defaultRestSec: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>

        <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
          <input
            type="checkbox"
            id="isTimed"
            checked={state.isTimed ?? false}
            onChange={(e) => {
              setState({ ...state, isTimed: e.target.checked });
              if (e.target.checked && !state.defaultSeconds) {
                setState({ ...state, isTimed: true, defaultSeconds: 30 });
              }
            }}
            className="w-4 h-4"
          />
          <Label htmlFor="isTimed" className="cursor-pointer font-medium">
            Timed Exercise
          </Label>
        </div>

        {state.isTimed && (
          <div>
            <Label>Default Duration (seconds)</Label>
            <Input
              type="number"
              value={state.defaultSeconds ?? ""}
              onChange={(e) =>
                setState({ ...state, defaultSeconds: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="e.g., 30 for 30 seconds"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={() => onSave(state)} className="rounded-xl">
            Save
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}

// Workout Editor Component - Advanced Editor
function WorkoutEditor({
  workout,
  exercises,
  onSave,
  onCancel,
}: {
  workout: Workout;
  exercises: Exercise[];
  onSave: (w: Workout) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<Workout>(workout);
  const [addingExercise, setAddingExercise] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [exerciseSearch, setExerciseSearch] = useState<string>("");
  const [exerciseGroupFilter, setExerciseGroupFilter] = useState<string>("all");

  function addExercise() {
    if (!selectedExerciseId) return;
    const exercise = exercises.find((e) => e.id === selectedExerciseId);
    if (!exercise) return;

    const newWorkoutExercise: import("@/lib/workoutLibrary").WorkoutExercise = {
      exerciseId: selectedExerciseId,
      exercise,
    };

    // Set defaults based on exercise and workout mode
    if (state.mode === "circuit") {
      newWorkoutExercise.circuitSeconds = exercise.defaultSeconds ?? exercise.defaultRepRange?.[0] ?? 45;
    } else if (state.mode === "timed") {
      newWorkoutExercise.seconds = exercise.defaultSeconds ?? 30;
      newWorkoutExercise.rounds = 1;
    } else {
      // sets-reps mode
      newWorkoutExercise.sets = exercise.defaultSets ?? 3;
      if (exercise.defaultRepRange) {
        newWorkoutExercise.repRange = exercise.defaultRepRange;
      } else if (exercise.defaultSeconds) {
        newWorkoutExercise.seconds = exercise.defaultSeconds;
      }
      newWorkoutExercise.restSec = exercise.defaultRestSec;
    }

    setState({
      ...state,
      exercises: [...state.exercises, newWorkoutExercise],
    });
    setSelectedExerciseId("");
    setAddingExercise(false);
  }

  function removeExercise(index: number) {
    setState({
      ...state,
      exercises: state.exercises.filter((_, i) => i !== index),
    });
  }

  function updateWorkoutExercise(index: number, updates: Partial<import("@/lib/workoutLibrary").WorkoutExercise>) {
    setState({
      ...state,
      exercises: state.exercises.map((ex, i) => (i === index ? { ...ex, ...updates } : ex)),
    });
  }

  function moveExercise(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= state.exercises.length) return;

    const newExercises = [...state.exercises];
    [newExercises[index], newExercises[newIndex]] = [newExercises[newIndex], newExercises[index]];
    setState({ ...state, exercises: newExercises });
  }

  return (
    <Card className="rounded-xl border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="text-base">Edit Workout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name *</Label>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              placeholder="Workout name"
            />
          </div>

          <div>
            <Label>Mode</Label>
            <Select
              value={state.mode}
              onValueChange={(v) => {
                const mode = v as WorkoutMode;
                // Clear exercise-specific data if mode changes
                setState({
                  ...state,
                  mode,
                  exercises: state.exercises.map((ex) => {
                    const clean: import("@/lib/workoutLibrary").WorkoutExercise = {
                      exerciseId: ex.exerciseId,
                    };
                    if (mode === "circuit") {
                      clean.circuitSeconds = ex.exercise?.defaultSeconds ?? 45;
                    } else if (mode === "timed") {
                      clean.seconds = ex.exercise?.defaultSeconds ?? 30;
                    } else {
                      clean.sets = ex.exercise?.defaultSets ?? 3;
                      if (ex.exercise?.defaultRepRange) {
                        clean.repRange = ex.exercise.defaultRepRange;
                      }
                      clean.restSec = ex.exercise?.defaultRestSec;
                    }
                    return clean;
                  }),
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sets-reps">Sets/Reps</SelectItem>
                <SelectItem value="timed">Timed</SelectItem>
                <SelectItem value="circuit">Circuit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Input
            value={state.description ?? ""}
            onChange={(e) => setState({ ...state, description: e.target.value })}
            placeholder="Workout description"
          />
        </div>

        {state.mode === "circuit" && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Rounds</Label>
              <Input
                type="number"
                value={state.rounds ?? ""}
                onChange={(e) =>
                  setState({ ...state, rounds: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </div>
            <div>
              <Label>Station Rest (seconds)</Label>
              <Input
                type="number"
                value={state.stationRestSec ?? ""}
                onChange={(e) =>
                  setState({
                    ...state,
                    stationRestSec: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label>Round Rest (seconds)</Label>
              <Input
                type="number"
                value={state.roundRestSec ?? ""}
                onChange={(e) =>
                  setState({
                    ...state,
                    roundRestSec: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <Label className="text-base font-semibold">Exercises ({state.exercises.length})</Label>
            {!addingExercise ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingExercise(true)}
                className="rounded-lg"
              >
                + Add Exercise
              </Button>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-slate-50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Search exercises..."
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    className="rounded-lg flex-1"
                  />
                  <Select value={exerciseGroupFilter} onValueChange={setExerciseGroupFilter}>
                    <SelectTrigger className="w-40 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      <SelectItem value="full-body">Full Body</SelectItem>
                      <SelectItem value="chest">Chest</SelectItem>
                      <SelectItem value="back">Back</SelectItem>
                      <SelectItem value="shoulders">Shoulders</SelectItem>
                      <SelectItem value="arms">Arms</SelectItem>
                      <SelectItem value="legs">Legs</SelectItem>
                      <SelectItem value="glutes">Glutes</SelectItem>
                      <SelectItem value="quads">Quads</SelectItem>
                      <SelectItem value="hamstrings">Hamstrings</SelectItem>
                      <SelectItem value="calves">Calves</SelectItem>
                      <SelectItem value="core">Core</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedExerciseId} onValueChange={setSelectedExerciseId}>
                    <SelectTrigger className="w-full rounded-lg">
                      <SelectValue placeholder="Select exercise" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(() => {
                        const availableExercises = exercises.filter(
                          (e) => !state.exercises.some((we) => we.exerciseId === e.id)
                        );

                        // Filter by search and group
                        let filtered = availableExercises.filter((ex) => {
                          // Search filter
                          if (exerciseSearch.trim()) {
                            const searchLower = exerciseSearch.toLowerCase();
                            if (
                              !ex.name.toLowerCase().includes(searchLower) &&
                              !ex.category.toLowerCase().includes(searchLower) &&
                              !ex.muscleGroups.some((mg) => mg.toLowerCase().includes(searchLower))
                            ) {
                              return false;
                            }
                          }

                          // Group filter
                          if (exerciseGroupFilter !== "all") {
                            return ex.muscleGroups.includes(exerciseGroupFilter as MuscleGroup);
                          }

                          return true;
                        });

                        // Group exercises
                        const grouped: Record<string, Exercise[]> = {};
                        filtered.forEach((ex) => {
                          if (exerciseGroupFilter !== "all") {
                            const group = exerciseGroupFilter;
                            if (!grouped[group]) grouped[group] = [];
                            grouped[group].push(ex);
                          } else {
                            ex.muscleGroups.forEach((mg) => {
                              if (!grouped[mg]) grouped[mg] = [];
                              if (!grouped[mg].some((e) => e.id === ex.id)) {
                                grouped[mg].push(ex);
                              }
                            });
                            if (ex.muscleGroups.length === 0) {
                              if (!grouped["uncategorized"]) grouped["uncategorized"] = [];
                              grouped["uncategorized"].push(ex);
                            }
                          }
                        });

                        const muscleGroupOrder: MuscleGroup[] = [
                          "full-body",
                          "chest",
                          "back",
                          "shoulders",
                          "arms",
                          "legs",
                          "glutes",
                          "quads",
                          "hamstrings",
                          "calves",
                          "core",
                        ];

                        const sortedGroups = Object.keys(grouped).sort((a, b) => {
                          const indexA = muscleGroupOrder.indexOf(a as MuscleGroup);
                          const indexB = muscleGroupOrder.indexOf(b as MuscleGroup);
                          if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                          if (indexA === -1) return 1;
                          if (indexB === -1) return -1;
                          return indexA - indexB;
                        });

                        if (exerciseGroupFilter === "all" && !exerciseSearch.trim()) {
                          // Show grouped
                          return sortedGroups.map((group) => (
                            <div key={group}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase bg-slate-100">
                                {group === "uncategorized" ? "Uncategorized" : group.replace("-", " ")}
                              </div>
                              {grouped[group].map((ex) => (
                                <SelectItem key={ex.id} value={ex.id}>
                                  {ex.name}
                                </SelectItem>
                              ))}
                            </div>
                          ));
                        } else {
                          // Show flat list
                          return filtered.map((ex) => (
                            <SelectItem key={ex.id} value={ex.id}>
                              {ex.name} {ex.muscleGroups.length > 0 && `(${ex.muscleGroups.join(", ")})`}
                            </SelectItem>
                          ));
                        }
                      })()}
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
                      setExerciseSearch("");
                      setExerciseGroupFilter("all");
                    }}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {state.exercises.map((we, index) => {
              const exercise = exercises.find((e) => e.id === we.exerciseId);
              if (!exercise) return null;

              return (
                <Card key={index} className="rounded-lg border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold">{exercise.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {exercise.category} • {exercise.muscleGroups.join(", ")}
                        </div>
                      </div>
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
                          disabled={index === state.exercises.length - 1}
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

                    {state.mode === "circuit" && (
                      <div>
                        <Label>Circuit Duration (seconds)</Label>
                        <Input
                          type="number"
                          value={we.circuitSeconds ?? ""}
                          onChange={(e) =>
                            updateWorkoutExercise(index, {
                              circuitSeconds: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>
                    )}

                    {state.mode === "timed" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Duration (seconds)</Label>
                          <Input
                            type="number"
                            value={we.seconds ?? ""}
                            onChange={(e) =>
                              updateWorkoutExercise(index, {
                                seconds: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Rounds</Label>
                          <Input
                            type="number"
                            value={we.rounds ?? ""}
                            onChange={(e) =>
                              updateWorkoutExercise(index, {
                                rounds: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {state.mode === "sets-reps" && (
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label>Sets</Label>
                          <Input
                            type="number"
                            value={we.sets ?? ""}
                            onChange={(e) =>
                              updateWorkoutExercise(index, {
                                sets: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        {exercise.isTimed ? (
                          <div className="col-span-3">
                            <Label>Duration (seconds)</Label>
                            <Input
                              type="number"
                              value={we.seconds ?? ""}
                              onChange={(e) =>
                                updateWorkoutExercise(index, {
                                  seconds: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <Label>Rep Min</Label>
                              <Input
                                type="number"
                                value={we.repRange?.[0] ?? we.reps ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  if (val !== undefined) {
                                    updateWorkoutExercise(index, {
                                      repRange: [val, we.repRange?.[1] ?? val],
                                      reps: undefined,
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <Label>Rep Max</Label>
                              <Input
                                type="number"
                                value={we.repRange?.[1] ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  if (val !== undefined && we.repRange?.[0] !== undefined) {
                                    updateWorkoutExercise(index, {
                                      repRange: [we.repRange[0], val],
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <Label>Rest (sec)</Label>
                              <Input
                                type="number"
                                value={we.restSec ?? ""}
                                onChange={(e) =>
                                  updateWorkoutExercise(index, {
                                    restSec: e.target.value ? Number(e.target.value) : undefined,
                                  })
                                }
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {state.exercises.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No exercises added yet. Click "Add Exercise" to get started.
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={() => onSave(state)} className="rounded-xl">
            Save Workout
          </Button>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Plan Editor Component (simplified)
function PlanEditor({
  plan,
  workouts,
  onSave,
  onCancel,
}: {
  plan: WorkoutPlan;
  workouts: Workout[];
  onSave: (p: WorkoutPlan) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<WorkoutPlan>(plan);

  return (
    <Card className="rounded-xl border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="text-base">Edit Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Name *</Label>
          <Input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Plan name"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Input
            value={state.description ?? ""}
            onChange={(e) => setState({ ...state, description: e.target.value })}
            placeholder="Plan description"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duration (weeks)</Label>
            <Input
              type="number"
              value={state.durationWeeks ?? ""}
              onChange={(e) =>
                setState({ ...state, durationWeeks: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <div>
            <Label>Days per Week</Label>
            <Input
              type="number"
              value={state.daysPerWeek ?? ""}
              onChange={(e) =>
                setState({ ...state, daysPerWeek: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
        </div>

        <div className="text-sm text-slate-600">
          {state.days.length} days in this plan
        </div>
        <p className="text-xs text-slate-500">
          Note: Full plan editing (adding/removing days) is available in the advanced editor.
        </p>

        <div className="flex gap-2">
          <Button onClick={() => onSave(state)} className="rounded-xl">
            Save
          </Button>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

