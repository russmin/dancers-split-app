import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, User } from "lucide-react";

type Goal = "strength" | "hypertrophy" | "endurance" | "general" | "";

export interface ProfileShape {
  name: string;
  age?: number | "";
  heightCm?: number | "";
  weightKg?: number | "";
  goal?: Goal;
  unit?: "kg" | "lb";
  programName?: string;
  programDurationWeeks?: number | "";
  daysPerWeek?: number | "";
  preferredDays?: string[];
}

interface Props {
  profile: ProfileShape;
  unit: "kg" | "lb";
  profileComplete: boolean;
  onChange: <K extends keyof ProfileShape>(key: K, value: ProfileShape[K]) => void;

  // program-preference helpers
  onTogglePreferredDay: (day: string) => void;

  // import/export
  onExport: () => void;
  onImportClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // unit conversion helpers
  fromKg: (kg: number, unit: "kg" | "lb") => number;
  toKg: (val: number, unit: "kg" | "lb") => number;
}

export default function ProfileTab({
  profile,
  unit,
  profileComplete,
  onChange,
  onTogglePreferredDay,
  onExport,
  onImportClick,
  fileInputRef,
  onImportFile,
  fromKg,
  toKg,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" /> Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g., Jordan" value={profile.name}
              onChange={(e) => onChange("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" inputMode="numeric" placeholder="32"
                value={profile.age ?? ""}
                onChange={(e) => onChange("age", e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="goal">Goal</Label>
              <Select value={(profile.goal ?? "") as string}
                onValueChange={(v) => onChange("goal", v as Goal)}>
                <SelectTrigger id="goal"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                  <SelectItem value="endurance">Endurance</SelectItem>
                  <SelectItem value="general">General fitness</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="height">Height (cm)</Label>
              <Input id="height" inputMode="numeric" placeholder="170"
                value={profile.heightCm ?? ""}
                onChange={(e) => onChange("heightCm", e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="weight">Weight ({unit})</Label>
              <Input
                id="weight"
                inputMode="numeric"
                placeholder={unit === "kg" ? "70" : "155"}
                value={
                  profile.weightKg === "" || profile.weightKg === undefined
                    ? ""
                    : String(Math.round(fromKg(Number(profile.weightKg), unit) * 10) / 10)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") return onChange("weightKg", "");
                  const num = Number(val);
                  if (!Number.isFinite(num) || num < 0) return;
                  onChange("weightKg", Math.round(toKg(num, unit) * 100) / 100);
                }}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="unit">Units</Label>
            <Select value={unit} onValueChange={(v) => onChange("unit", v as "kg" | "lb") }>
              <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Metric (kg)</SelectItem>
                <SelectItem value="lb">Imperial (lb)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!profileComplete && (
            <p className="text-xs text-slate-500">Tip: add your name to personalize your log.</p>
          )}
        </CardContent>
      </Card>

      {/* Program settings */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle className="text-lg">Program</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label htmlFor="programName">Program Name</Label>
            <Input id="programName" placeholder="e.g., Final 4-Day Dancer's Split"
              value={profile.programName as any}
              onChange={(e) => onChange("programName" as any, e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="duration">Duration (weeks)</Label>
              <Input id="duration" inputMode="numeric"
                value={profile.programDurationWeeks as any}
                onChange={(e) => onChange("programDurationWeeks" as any, e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="dpw">Days / week</Label>
              <Input id="dpw" inputMode="numeric"
                value={profile.daysPerWeek as any}
                onChange={(e) => onChange("daysPerWeek" as any, e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label>&nbsp;</Label>
              <div className="text-xs text-slate-500">Choose preferred days below</div>
            </div>
          </div>

          <div>
            <Label>Preferred Workout Days</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <Button key={d} type="button"
                  variant={profile.preferredDays?.includes(d) ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => onTogglePreferredDay(d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" /> Export JSON
            </Button>
            <input type="file" accept="application/json" className="hidden" ref={fileInputRef} onChange={onImportFile} />
            <Button variant="outline" className="rounded-xl" onClick={onImportClick}>
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
