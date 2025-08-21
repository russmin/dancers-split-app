export type Unit = "kg" | "lb";

export interface WorkoutEntry {
  id: string;
  date: string;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number;
  notes?: string;
  // optional flags
  isPRMaxWeight?: boolean;
  isPRVolume?: boolean;
}

export type PRMap = Record<
  string,
  { maxWeightKg?: number; maxVolumeKg?: number } // per exercise
>;

// compute current PRs from historical entries
export function computePRs(entries: WorkoutEntry[]): PRMap {
  const map: PRMap = {};
  for (const w of entries) {
    const vol = w.reps * (w.weightKg ?? 1);
    const m = map[w.name] ?? {};
    if (w.weightKg !== undefined) {
      if (m.maxWeightKg === undefined || w.weightKg > m.maxWeightKg) m.maxWeightKg = w.weightKg;
    }
    if (m.maxVolumeKg === undefined || vol > m.maxVolumeKg) m.maxVolumeKg = vol;
    map[w.name] = m;
  }
  return map;
}

// mark PR flags for a new batch of entries BEFORE inserting into history
export function markPRsBeforeInsert(
  history: WorkoutEntry[],
  incoming: WorkoutEntry[]
): WorkoutEntry[] {
  const prs = computePRs(history);
  return incoming.map((w) => {
    const prev = prs[w.name] ?? {};
    const vol = w.reps * (w.weightKg ?? 1);
    const isPRMaxWeight =
      w.weightKg !== undefined &&
      (prev.maxWeightKg === undefined || w.weightKg > prev.maxWeightKg);
    const isPRVolume =
      prev.maxVolumeKg === undefined || vol > prev.maxVolumeKg;
    return { ...w, isPRMaxWeight, isPRVolume };
  });
}
