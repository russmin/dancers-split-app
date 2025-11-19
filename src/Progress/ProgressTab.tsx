// components/ProgressTab.tsx
import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ProgressChart from "./ProgressChart";
import WeeklyWorkoutLog from "./WeeklyWorkoutLog";
import { aggregatePRsByWeek } from "@/lib/utils";
import { WorkoutEntry } from "@/components/WorkoutLogTable";
import { WorkoutPlan } from "@/lib/workoutLibrary";

interface ProgressTabProps {
  workouts: WorkoutEntry[];
  unit: "kg" | "lb";
  exerciseFilter: string;
  setExerciseFilter: (value: string) => void;
  uniqueExercises: string[];
  activePlan: WorkoutPlan | null;
  programStartDate?: string;
  preferredDays?: string[];
  daysPerWeek?: number;
  setWorkouts: (workouts: WorkoutEntry[]) => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function countDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function countPreferredDaysInPeriod(startISO: string, endISO: string, preferredDays: string[]): number {
  if (!preferredDays || preferredDays.length === 0) return 0;
  
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  
  const preferredNums = preferredDays.map(d => dayMap[d]).filter(n => n !== undefined);
  if (preferredNums.length === 0) return 0;
  
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  let count = 0;
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (preferredNums.includes(d.getDay())) {
      count++;
    }
  }
  
  return count;
}

export default function ProgressTab({
  workouts,
  unit,
  exerciseFilter,
  setExerciseFilter,
  uniqueExercises,
  activePlan,
  programStartDate,
  preferredDays,
  daysPerWeek,
  setWorkouts,
}: ProgressTabProps) {
  // Aggregate all PRs by week and exercise
  const weeklyData = useMemo(() => aggregatePRsByWeek(workouts), [workouts]);
  type WeeklyPR = {
    week: string;
    maxVolume?: number;
    maxWeight?: number;
  };

  const selectedData: WeeklyPR[] = useMemo(() => {
    if (exerciseFilter === "__all") return [];
    return weeklyData[exerciseFilter] ?? [];
  }, [weeklyData, exerciseFilter]);

  // Plan adherence metrics
  const planMetrics = useMemo(() => {
    if (!activePlan || !programStartDate) {
      return null;
    }

    const today = todayISO();
    const startDate = programStartDate;
    const daysSinceStart = countDaysBetween(startDate, today);
    const expectedDaysPerWeek = daysPerWeek || activePlan.daysPerWeek || 4;
    const weeksElapsed = Math.floor(daysSinceStart / 7);
    const expectedWorkouts = weeksElapsed * expectedDaysPerWeek;
    
    // Count unique workout dates
    const uniqueWorkoutDates = new Set(workouts.map(w => w.date));
    const completedWorkouts = uniqueWorkoutDates.size;
    
    // Count workouts in preferred days
    const preferredWorkouts = preferredDays && preferredDays.length > 0
      ? Array.from(uniqueWorkoutDates).filter(date => {
          const d = new Date(date + "T00:00:00");
          const dayMap: Record<string, number> = {
            Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
          };
          const dayNum = d.getDay();
          return preferredDays.some(pd => dayMap[pd] === dayNum);
        }).length
      : completedWorkouts;
    
    const completionRate = expectedWorkouts > 0 
      ? Math.round((completedWorkouts / expectedWorkouts) * 100)
      : 0;
    
    // This week's workouts (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - dayOfWeek); // Sunday
    weekStartDate.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    const weekStartISO = weekStartDate.toISOString().slice(0, 10);
    
    const thisWeekWorkouts = Array.from(uniqueWorkoutDates).filter(
      date => date >= weekStartISO
    ).length;
    
    // Count PRs from this week
    const thisWeekPRs = workouts.filter(w => {
      const workoutDate = new Date(w.date + "T00:00:00");
      return workoutDate >= weekStartDate && workoutDate <= weekEndDate && (w.isPRMaxWeight || w.isPRVolume);
    }).length;
    
    const thisWeekWeightPRs = workouts.filter(w => {
      const workoutDate = new Date(w.date + "T00:00:00");
      return workoutDate >= weekStartDate && workoutDate <= weekEndDate && w.isPRMaxWeight;
    }).length;
    
    const thisWeekVolumePRs = workouts.filter(w => {
      const workoutDate = new Date(w.date + "T00:00:00");
      return workoutDate >= weekStartDate && workoutDate <= weekEndDate && w.isPRVolume;
    }).length;
    
    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().slice(0, 10);
    const recentWorkouts = Array.from(uniqueWorkoutDates).filter(
      date => date >= weekAgoISO
    ).length;

    return {
      completedWorkouts,
      expectedWorkouts,
      completionRate,
      thisWeekWorkouts,
      thisWeekPRs,
      thisWeekWeightPRs,
      thisWeekVolumePRs,
      recentWorkouts,
      weeksElapsed,
      preferredWorkouts,
      planDays: activePlan.days.length,
    };
  }, [activePlan, programStartDate, daysPerWeek, workouts, preferredDays]);

  return (
    <>
      {/* Plan Adherence Section */}
      {planMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Plan Adherence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Completion Rate</span>
                  <span className="text-lg font-semibold">{planMetrics.completionRate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, planMetrics.completionRate))}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {planMetrics.completedWorkouts} of {planMetrics.expectedWorkouts} workouts completed
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`rounded-2xl shadow-sm ${planMetrics.thisWeekPRs > 0 ? "border-2 border-emerald-500 bg-emerald-50/30" : ""}`}>
            <CardHeader>
              <CardTitle className="text-base">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Workouts</span>
                  <span className="text-lg font-semibold">{planMetrics.thisWeekWorkouts}</span>
                </div>
                {daysPerWeek && (
                  <div className="text-xs text-slate-500">
                    Target: {daysPerWeek} per week
                  </div>
                )}
                {planMetrics.thisWeekPRs > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <div className="text-xs font-semibold text-emerald-700 mb-1">🏆 PRs This Week!</div>
                    <div className="text-xs text-emerald-600 space-y-0.5">
                      {planMetrics.thisWeekWeightPRs > 0 && (
                        <div>• {planMetrics.thisWeekWeightPRs} Max Weight PR{planMetrics.thisWeekWeightPRs > 1 ? "s" : ""}</div>
                      )}
                      {planMetrics.thisWeekVolumePRs > 0 && (
                        <div>• {planMetrics.thisWeekVolumePRs} Volume PR{planMetrics.thisWeekVolumePRs > 1 ? "s" : ""}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Last 7 Days</span>
                  <span className="text-lg font-semibold">{planMetrics.recentWorkouts}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {planMetrics.weeksElapsed} weeks into program
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weekly PRs Chart */}
      <Card className="rounded-2xl shadow-sm mb-6">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg">Progress (Weekly PRs)</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Label className="mr-1">Exercise</Label>
            <Select value={exerciseFilter} onValueChange={setExerciseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All exercises" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All exercises</SelectItem>
                {uniqueExercises.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-64 w-full">
            {selectedData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-slate-500">
                No data yet — add a workout to see progress.
              </div>
            ) : (
              <ProgressChart
                data={selectedData.map((d) => ({
                  week: d.week,
                  volume: d.maxVolume ?? 0,
                  weight: d.maxWeight ?? 0,
                }))}
                unit={unit}
              />

            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Tracks your highest recorded volume and weight each week ({unit}).
          </p>
        </CardContent>
      </Card>

      <WeeklyWorkoutLog workouts={workouts} unit={unit} onChange={setWorkouts} />
    </>
  );
}
