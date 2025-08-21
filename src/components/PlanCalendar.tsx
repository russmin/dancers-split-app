import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export interface PlanCalendarProps {
  month: Date; // any date inside the visible month
  onMonthChange: (d: Date) => void;

  // plan info
  planLengthDays: number;               // e.g., 4 for a 4-day split
  preferredDays: Weekday[];             // from profile (e.g., ["Mon","Tue","Thu","Sat"])
  programStartDate?: string;            // YYYY-MM-DD
  daysPerWeek?: number;                 // e.g., 4

  // already completed dates (YYYY-MM-DD)
  completedDates: Set<string>;

  // when user clicks a date that has a suggested plan-day
  onPickDate: (isoDate: string, suggestedPlanDay: number) => void;
}

const WEEKDAYS: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function getWeekday(d: Date): Weekday {
  return WEEKDAYS[d.getDay()];
}

// Count how many "workout-eligible" preferred days occur from (and including) startDate up to (and including) targetDate
function countEligibleDaysBetween(
  startISO: string,
  targetISO: string,
  preferred: Weekday[]
) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(targetISO + "T00:00:00");
  if (end < start) return 0;

  let count = 0;
  for (
    let d = new Date(start.getTime());
    d <= end;
    d = addDays(d, 1)
  ) {
    if (preferred.includes(getWeekday(d))) count++;
  }
  return count;
}

/**
 * Determine which Plan Day (1..planLengthDays) is scheduled on `dateISO`
 * based on programStartDate and preferred days. Returns null if:
 *  - date is before start
 *  - date is not a preferred day
 *  - planLengthDays <= 0
 */
function getPlannedDayForDate(
  dateISO: string,
  planLengthDays: number,
  preferredDays: Weekday[],
  programStartDate?: string
): number | null {
  if (!programStartDate || planLengthDays <= 0) return null;
  // Must be a preferred day
  const d = new Date(dateISO + "T00:00:00");
  if (!preferredDays.includes(getWeekday(d))) return null;
  // Must be on/after start
  if (dateISO < programStartDate) return null;

  // count eligible training days up to this date
  const k = countEligibleDaysBetween(programStartDate, dateISO, preferredDays);
  if (k <= 0) return null;

  // training day index is k-1; cycle through plan days
  const index0 = (k - 1) % planLengthDays; // 0-based index
  return index0 + 1; // 1..planLengthDays
}

export default function PlanCalendar({
  month,
  onMonthChange,
  planLengthDays,
  preferredDays,
  programStartDate,
  daysPerWeek,
  completedDates,
  onPickDate,
}: PlanCalendarProps) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);

  // Build visible grid (starts Sunday)
  const leading = first.getDay(); // 0..6
  const daysInMonth = last.getDate();

  // We’ll render 6 rows × 7 cols (42 cells) for stability
  const cells: (Date | null)[] = [];
  // days before the 1st
  for (let i = 0; i < leading; i++) cells.push(null);
  // month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), d));
  }
  // trailing to fill 42
  while (cells.length < 42) cells.push(null);

  function prevMonth() {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }
  function nextMonth() {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Training Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="rounded-xl" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <Button size="icon" variant="ghost" className="rounded-xl" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Preferred: {preferredDays.length > 0 ? preferredDays.join(" • ") : "—"} ·
          Start: {programStartDate || "—"} · Days/week: {daysPerWeek ?? "—"}
        </div>
      </CardHeader>

      <CardContent>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-xs text-slate-500 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center">{w}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} className="h-20 rounded-md bg-transparent" />;
            const iso = toISO(d);
            const wd = getWeekday(d);
            const isPreferred = preferredDays.includes(wd);
            const planned = getPlannedDayForDate(
              iso,
              planLengthDays,
              preferredDays,
              programStartDate
            );
            const completed = completedDates.has(iso);

            const base =
              "h-20 rounded-md border p-1 text-xs flex flex-col justify-between";
            const muted = "bg-slate-50";
            const pref = isPreferred ? "bg-emerald-50 border-emerald-200" : muted;
            const todayISO = toISO(new Date());
            const isToday = iso === todayISO;
            const ring = isToday ? "ring-2 ring-blue-300" : "";

            return (
              <button
                key={idx}
                className={`${base} ${pref} ${ring} hover:bg-emerald-100 transition`}
                disabled={!planned}
                title={
                  planned
                    ? `Plan Day ${planned}${completed ? " (completed)" : ""}`
                    : "No planned session"
                }
                onClick={() => {
                  if (planned) onPickDate(iso, planned);
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{d.getDate()}</span>
                  {completed && (
                    <span className="inline-flex items-center text-emerald-700">
                      <Check className="h-3.5 w-3.5 mr-0.5" /> Done
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  {planned ? (
                    <div className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-1.5 py-0.5">
                      <span className="text-emerald-700 font-medium">
                        Day {planned}
                      </span>
                    </div>
                  ) : (
                    <div className="text-slate-400">—</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
          <div className="inline-flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm border border-emerald-300 bg-emerald-50" />
            Preferred day
          </div>
          <div className="inline-flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm ring-2 ring-blue-300" />
            Today
          </div>
          <div className="inline-flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-700" />
            Completed
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
