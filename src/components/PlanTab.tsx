import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export interface PlanDay {
  day: number;
  title: string;
  exercises: ReadonlyArray<string>; // readonly-friendly
}

interface Props {
  plan: ReadonlyArray<PlanDay>;      //  readonly-friendly
  activePlanDay: string;
  onChangeActivePlanDay: (v: string) => void;
  onStartSession: (day: number) => void;
}

export default function PlanTab({
  plan,
  activePlanDay,
  onChangeActivePlanDay,
  onStartSession,
}: Props) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">The Final 4-Day Dancer&apos;s Split (&lt;70 mins/session)</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activePlanDay} onValueChange={onChangeActivePlanDay} className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-3">
            {plan.map((d) => (
              <TabsTrigger key={d.day} value={String(d.day)}>Day {d.day}</TabsTrigger>
            ))}
          </TabsList>

          {plan.map((d) => (
            <TabsContent key={d.day} value={String(d.day)}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-600">{d.title}</div>
                <Button className="rounded-xl" onClick={() => onStartSession(d.day)}>Start Session</Button>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                {d.exercises.map((ex, i) => {
                  const [namePart, restPart] = ex.split(":");
                  return (
                    <li key={i}>
                      <span className="font-medium">{namePart}:</span>
                      {restPart ? ` ${restPart}` : ""}
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
