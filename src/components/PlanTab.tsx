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
import PlanCalendar from "@/components/PlanCalendar";

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
}: Props) {
  const [month, setMonth] = React.useState(new Date());

  return (
    <div className="space-y-6">
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
