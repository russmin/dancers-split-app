import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PlanCalendar from "@/components/PlanCalendar";
import { WorkoutPlan } from "@/lib/workoutLibrary";

export interface PlanDay {
  day: number;
  title: string;
  exercises: ReadonlyArray<string>;
}

interface Props {
  plan: ReadonlyArray<PlanDay>;
  activePlanDay: string;
  onChangeActivePlanDay: (v: string) => void;
  onStartSession: (day: number) => void;

  // calendar props
  preferredDays: Array<"Sun"|"Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat">;
  programStartDate?: string;
  daysPerWeek?: number;
  completedDates: Set<string>;
  onPickDate: (isoDate: string, suggestedPlanDay: number) => void;

  // plan management
  activePlan: WorkoutPlan | null;
  availablePlans: WorkoutPlan[];
  onCancelPlan: () => void;
  onStartNewPlan: (planId: string) => void;
}

export default function PlanTab({
  plan,
  activePlanDay,
  onChangeActivePlanDay,
  onStartSession,
  preferredDays,
  programStartDate,
  daysPerWeek,
  completedDates,
  onPickDate,
  activePlan,
  availablePlans,
  onCancelPlan,
  onStartNewPlan,
}: Props) {
  const [month, setMonth] = React.useState(new Date());
  const [showPlanSelector, setShowPlanSelector] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");

  return (
    <div className="space-y-6">
      {/* Active Plan Management */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Active Workout Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePlan ? (
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-lg">{activePlan.name}</div>
                {activePlan.description && (
                  <div className="text-sm text-slate-600 mt-1">{activePlan.description}</div>
                )}
                <div className="text-xs text-slate-500 mt-2">
                  {activePlan.days.length} days • {activePlan.daysPerWeek ?? "?"} days/week • {activePlan.durationWeeks ?? "?"} weeks
                  {activePlan.startDate && ` • Started: ${new Date(activePlan.startDate).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("Cancel current plan? This will stop tracking progress for this plan.")) {
                      onCancelPlan();
                    }
                  }}
                  className="rounded-lg"
                >
                  Cancel Plan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPlanSelector(true)}
                  className="rounded-lg"
                >
                  Start New Plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-600">No active plan. Start a plan to begin tracking workouts.</p>
              <Button
                onClick={() => setShowPlanSelector(true)}
                className="rounded-lg"
              >
                Start a Plan
              </Button>
            </div>
          )}

          {showPlanSelector && (
            <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
              <div>
                <Label>Select Plan</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Choose a plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.days.length} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (selectedPlanId) {
                      onStartNewPlan(selectedPlanId);
                      setShowPlanSelector(false);
                      setSelectedPlanId("");
                    }
                  }}
                  className="rounded-lg"
                  disabled={!selectedPlanId}
                >
                  Start Plan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPlanSelector(false);
                    setSelectedPlanId("");
                  }}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar */}
      <PlanCalendar
        month={month}
        onMonthChange={setMonth}
        planLengthDays={plan.length}
        preferredDays={preferredDays}
        programStartDate={programStartDate}
        daysPerWeek={daysPerWeek}
        completedDates={completedDates}
        onPickDate={onPickDate}
      />

      {/* Plan tabs */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activePlanDay}
            onValueChange={onChangeActivePlanDay}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 gap-2 mb-4">
              {plan.map((d) => (
                <TabsTrigger
                  key={d.day}
                  value={d.day.toString()}
                  className="rounded-lg"
                >
                  Day {d.day}
                </TabsTrigger>
              ))}
            </TabsList>

            {plan.map((d) => (
              <TabsContent key={d.day} value={d.day.toString()}>
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle>{d.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside mb-4">
                      {d.exercises.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => onStartSession(d.day)}
                      className="rounded-lg"
                    >
                      Start Session
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
