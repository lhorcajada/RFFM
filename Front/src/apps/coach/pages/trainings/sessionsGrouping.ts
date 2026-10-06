import type { TrainingSession } from "../../types/training";

export type MicrocicloGroup = {
  id: string;
  label: string;
  order: number;
  startDate: string | null;
  endDate: string | null;
  sessions: TrainingSession[];
};

export type MesocicloGroup = {
  id: string;
  name: string;
  order: number;
  microciclos: MicrocicloGroup[];
};

export type MacrocicloGroup = {
  id: string;
  name: string;
  order: number;
  mesociclos: MesocicloGroup[];
};

export type SessionGroups = {
  macrociclos: MacrocicloGroup[];
  free: TrainingSession[];
};

/** Most recent first; unscheduled sessions (no date) go first, as they are still pending. */
function byDateDescUnscheduledFirst(a: TrainingSession, b: TrainingSession) {
  if (a.date === null && b.date === null) return 0;
  if (a.date === null) return -1;
  if (b.date === null) return 1;
  return b.date.localeCompare(a.date);
}

/** Most recent first; inside a plan week an unscheduled session goes last. */
function byDateDescUnscheduledLast(a: TrainingSession, b: TrainingSession) {
  if (a.date === null && b.date === null) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return b.date.localeCompare(a.date);
}

const byOrderDesc = <T extends { order: number }>(a: T, b: T) => b.order - a.order;

export function groupSessions(sessions: TrainingSession[]): SessionGroups {
  const macros = new Map<string, MacrocicloGroup>();
  const free: TrainingSession[] = [];

  for (const s of sessions) {
    if (!s.microcicloId || !s.mesocicloId || !s.macrocicloId) {
      free.push(s);
      continue;
    }

    let macro = macros.get(s.macrocicloId);
    if (!macro) {
      macro = { id: s.macrocicloId, name: s.macrocicloName ?? "", order: s.macrocicloOrder ?? 0, mesociclos: [] };
      macros.set(s.macrocicloId, macro);
    }

    let meso = macro.mesociclos.find((m) => m.id === s.mesocicloId);
    if (!meso) {
      meso = { id: s.mesocicloId, name: s.mesocicloName ?? "", order: s.mesocicloOrder ?? 0, microciclos: [] };
      macro.mesociclos.push(meso);
    }

    let micro = meso.microciclos.find((m) => m.id === s.microcicloId);
    if (!micro) {
      micro = {
        id: s.microcicloId,
        label: s.microcicloWeekLabel ?? "",
        order: s.microcicloOrder ?? 0,
        startDate: s.microcicloStartDate ?? null,
        endDate: s.microcicloEndDate ?? null,
        sessions: [],
      };
      meso.microciclos.push(micro);
    }

    micro.sessions.push(s);
  }

  const macrociclos = [...macros.values()].sort(byOrderDesc);
  for (const macro of macrociclos) {
    macro.mesociclos.sort(byOrderDesc);
    for (const meso of macro.mesociclos) {
      meso.microciclos.sort(byOrderDesc);
      for (const micro of meso.microciclos) micro.sessions.sort(byDateDescUnscheduledLast);
    }
  }

  return { macrociclos, free: free.sort(byDateDescUnscheduledFirst) };
}
