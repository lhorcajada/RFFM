export interface Formation {
  id: string;
  name: string;
  description?: string | null;
}

/** One positional slot in a formation (coordinates in % relative to the field) */
export interface FormationSlotDef {
  slotIndex: number;
  label: string;
  /** Horizontal position 0–100% (0 = left, 100 = right) */
  x: number;
  /** Vertical position 0–100% (0 = top / attack end, 100 = bottom / GK end) */
  y: number;
}

/**
 * Hardcoded coordinates for each standard 11-a-side formation.
 * LANDSCAPE orientation: GK on the LEFT (x≈12), attack on the RIGHT (x≈78-82).
 * x = 0–100% horizontal (0=GK end, 100=attack end)
 * y = 0–100% vertical  (0=top touchline, 100=bottom touchline)
 * Derived from portrait coords via: new_x = 100 - old_y, new_y = old_x
 */
export const FORMATION_POSITIONS: Record<string, FormationSlotDef[]> = {
  "4-4-2": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 28, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 28, y: 36 },
    { slotIndex: 3,  label: "DCD", x: 28, y: 64 },
    { slotIndex: 4,  label: "DFD", x: 28, y: 85 },
    { slotIndex: 5,  label: "MCI", x: 52, y: 15 },
    { slotIndex: 6,  label: "MCI", x: 52, y: 36 },
    { slotIndex: 7,  label: "MCD", x: 52, y: 64 },
    { slotIndex: 8,  label: "MCD", x: 52, y: 85 },
    { slotIndex: 9,  label: "DC",  x: 78, y: 35 },
    { slotIndex: 10, label: "DC",  x: 78, y: 65 },
  ],
  "4-3-3": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 28, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 28, y: 36 },
    { slotIndex: 3,  label: "DCD", x: 28, y: 64 },
    { slotIndex: 4,  label: "DFD", x: 28, y: 85 },
    { slotIndex: 5,  label: "MCI", x: 50, y: 25 },
    { slotIndex: 6,  label: "MCC", x: 50, y: 50 },
    { slotIndex: 7,  label: "MCD", x: 50, y: 75 },
    { slotIndex: 8,  label: "EI",  x: 78, y: 20 },
    { slotIndex: 9,  label: "DC",  x: 78, y: 50 },
    { slotIndex: 10, label: "ED",  x: 78, y: 80 },
  ],
  "4-2-3-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "MPI", x: 44, y: 35 },
    { slotIndex: 6,  label: "MPD", x: 44, y: 65 },
    { slotIndex: 7,  label: "EI",  x: 62, y: 15 },
    { slotIndex: 8,  label: "SEC", x: 62, y: 50 },
    { slotIndex: 9,  label: "ED",  x: 62, y: 85 },
    { slotIndex: 10, label: "DC",  x: 80, y: 50 },
  ],
  "4-3-2-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "MCI", x: 45, y: 25 },
    { slotIndex: 6,  label: "MCC", x: 45, y: 50 },
    { slotIndex: 7,  label: "MCD", x: 45, y: 75 },
    { slotIndex: 8,  label: "SEI", x: 63, y: 35 },
    { slotIndex: 9,  label: "SED", x: 63, y: 65 },
    { slotIndex: 10, label: "DC",  x: 80, y: 50 },
  ],
  "4-5-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "EI",  x: 50, y: 10 },
    { slotIndex: 6,  label: "MCI", x: 50, y: 30 },
    { slotIndex: 7,  label: "MCC", x: 50, y: 50 },
    { slotIndex: 8,  label: "MCD", x: 50, y: 70 },
    { slotIndex: 9,  label: "ED",  x: 50, y: 90 },
    { slotIndex: 10, label: "DC",  x: 78, y: 50 },
  ],
  "4-1-4-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "MP",  x: 42, y: 50 },
    { slotIndex: 6,  label: "EI",  x: 58, y: 12 },
    { slotIndex: 7,  label: "MCI", x: 58, y: 35 },
    { slotIndex: 8,  label: "MCD", x: 58, y: 65 },
    { slotIndex: 9,  label: "ED",  x: 58, y: 88 },
    { slotIndex: 10, label: "DC",  x: 79, y: 50 },
  ],
  "4-4-1-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "EI",  x: 48, y: 12 },
    { slotIndex: 6,  label: "MCI", x: 48, y: 35 },
    { slotIndex: 7,  label: "MCD", x: 48, y: 65 },
    { slotIndex: 8,  label: "ED",  x: 48, y: 88 },
    { slotIndex: 9,  label: "SEC", x: 66, y: 50 },
    { slotIndex: 10, label: "DC",  x: 81, y: 50 },
  ],
  "3-5-2": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DCI", x: 27, y: 28 },
    { slotIndex: 2,  label: "DCC", x: 27, y: 50 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 72 },
    { slotIndex: 4,  label: "CAI", x: 50, y:  8 },
    { slotIndex: 5,  label: "MCI", x: 50, y: 30 },
    { slotIndex: 6,  label: "MCC", x: 50, y: 50 },
    { slotIndex: 7,  label: "MCD", x: 50, y: 70 },
    { slotIndex: 8,  label: "CAD", x: 50, y: 92 },
    { slotIndex: 9,  label: "DC",  x: 78, y: 34 },
    { slotIndex: 10, label: "DC",  x: 78, y: 66 },
  ],
  "3-4-3": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DCI", x: 27, y: 28 },
    { slotIndex: 2,  label: "DCC", x: 27, y: 50 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 72 },
    { slotIndex: 4,  label: "CAI", x: 48, y: 14 },
    { slotIndex: 5,  label: "MCI", x: 48, y: 37 },
    { slotIndex: 6,  label: "MCD", x: 48, y: 63 },
    { slotIndex: 7,  label: "CAD", x: 48, y: 86 },
    { slotIndex: 8,  label: "EI",  x: 78, y: 20 },
    { slotIndex: 9,  label: "DC",  x: 78, y: 50 },
    { slotIndex: 10, label: "ED",  x: 78, y: 80 },
  ],
  "3-6-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DCI", x: 27, y: 28 },
    { slotIndex: 2,  label: "DCC", x: 27, y: 50 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 72 },
    { slotIndex: 4,  label: "EI",  x: 50, y:  8 },
    { slotIndex: 5,  label: "MCI", x: 50, y: 27 },
    { slotIndex: 6,  label: "MI",  x: 50, y: 44 },
    { slotIndex: 7,  label: "MD",  x: 50, y: 56 },
    { slotIndex: 8,  label: "MCD", x: 50, y: 73 },
    { slotIndex: 9,  label: "ED",  x: 50, y: 92 },
    { slotIndex: 10, label: "DC",  x: 78, y: 50 },
  ],
  "3-4-2-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DCI", x: 27, y: 28 },
    { slotIndex: 2,  label: "DCC", x: 27, y: 50 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 72 },
    { slotIndex: 4,  label: "CAI", x: 45, y: 14 },
    { slotIndex: 5,  label: "MCI", x: 45, y: 37 },
    { slotIndex: 6,  label: "MCD", x: 45, y: 63 },
    { slotIndex: 7,  label: "CAD", x: 45, y: 86 },
    { slotIndex: 8,  label: "SEI", x: 63, y: 34 },
    { slotIndex: 9,  label: "SED", x: 63, y: 66 },
    { slotIndex: 10, label: "DC",  x: 80, y: 50 },
  ],
  "5-3-2": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "CAI", x: 28, y:  8 },
    { slotIndex: 2,  label: "DCI", x: 28, y: 28 },
    { slotIndex: 3,  label: "DCC", x: 28, y: 50 },
    { slotIndex: 4,  label: "DCD", x: 28, y: 72 },
    { slotIndex: 5,  label: "CAD", x: 28, y: 92 },
    { slotIndex: 6,  label: "MCI", x: 50, y: 28 },
    { slotIndex: 7,  label: "MCC", x: 50, y: 50 },
    { slotIndex: 8,  label: "MCD", x: 50, y: 72 },
    { slotIndex: 9,  label: "DC",  x: 78, y: 34 },
    { slotIndex: 10, label: "DC",  x: 78, y: 66 },
  ],
  "5-4-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "CAI", x: 28, y:  8 },
    { slotIndex: 2,  label: "DCI", x: 28, y: 28 },
    { slotIndex: 3,  label: "DCC", x: 28, y: 50 },
    { slotIndex: 4,  label: "DCD", x: 28, y: 72 },
    { slotIndex: 5,  label: "CAD", x: 28, y: 92 },
    { slotIndex: 6,  label: "EI",  x: 50, y: 14 },
    { slotIndex: 7,  label: "MCI", x: 50, y: 37 },
    { slotIndex: 8,  label: "MCD", x: 50, y: 63 },
    { slotIndex: 9,  label: "ED",  x: 50, y: 86 },
    { slotIndex: 10, label: "DC",  x: 78, y: 50 },
  ],
  "5-2-3": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "CAI", x: 28, y:  8 },
    { slotIndex: 2,  label: "DCI", x: 28, y: 28 },
    { slotIndex: 3,  label: "DCC", x: 28, y: 50 },
    { slotIndex: 4,  label: "DCD", x: 28, y: 72 },
    { slotIndex: 5,  label: "CAD", x: 28, y: 92 },
    { slotIndex: 6,  label: "MCI", x: 48, y: 34 },
    { slotIndex: 7,  label: "MCD", x: 48, y: 66 },
    { slotIndex: 8,  label: "EI",  x: 78, y: 18 },
    { slotIndex: 9,  label: "DC",  x: 78, y: 50 },
    { slotIndex: 10, label: "ED",  x: 78, y: 82 },
  ],
  "4-1-2-1-2": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "MP",  x: 40, y: 50 },
    { slotIndex: 6,  label: "MCI", x: 53, y: 30 },
    { slotIndex: 7,  label: "MCD", x: 53, y: 70 },
    { slotIndex: 8,  label: "SEC", x: 66, y: 50 },
    { slotIndex: 9,  label: "DC",  x: 80, y: 34 },
    { slotIndex: 10, label: "DC",  x: 80, y: 66 },
  ],
  "4-2-2-2": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "MPI", x: 44, y: 35 },
    { slotIndex: 6,  label: "MPD", x: 44, y: 65 },
    { slotIndex: 7,  label: "SEI", x: 62, y: 35 },
    { slotIndex: 8,  label: "SED", x: 62, y: 65 },
    { slotIndex: 9,  label: "DC",  x: 79, y: 35 },
    { slotIndex: 10, label: "DC",  x: 79, y: 65 },
  ],
  "4-3-1-2": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DFI", x: 27, y: 15 },
    { slotIndex: 2,  label: "DCI", x: 27, y: 37 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 63 },
    { slotIndex: 4,  label: "DFD", x: 27, y: 85 },
    { slotIndex: 5,  label: "MCI", x: 45, y: 25 },
    { slotIndex: 6,  label: "MCC", x: 45, y: 50 },
    { slotIndex: 7,  label: "MCD", x: 45, y: 75 },
    { slotIndex: 8,  label: "SEC", x: 62, y: 50 },
    { slotIndex: 9,  label: "DC",  x: 79, y: 34 },
    { slotIndex: 10, label: "DC",  x: 79, y: 66 },
  ],
  "3-3-3-1": [
    { slotIndex: 0,  label: "PT",  x: 12, y: 50 },
    { slotIndex: 1,  label: "DCI", x: 27, y: 28 },
    { slotIndex: 2,  label: "DCC", x: 27, y: 50 },
    { slotIndex: 3,  label: "DCD", x: 27, y: 72 },
    { slotIndex: 4,  label: "MCI", x: 44, y: 28 },
    { slotIndex: 5,  label: "MCC", x: 44, y: 50 },
    { slotIndex: 6,  label: "MCD", x: 44, y: 72 },
    { slotIndex: 7,  label: "SEI", x: 62, y: 28 },
    { slotIndex: 8,  label: "SEC", x: 62, y: 50 },
    { slotIndex: 9,  label: "SED", x: 62, y: 72 },
    { slotIndex: 10, label: "DC",  x: 79, y: 50 },
  ],
};

// ─── Reduced formations (after own-team expulsions) ──────────────────────────

export type ReducedPlayerCount = 7 | 8 | 9 | 10;

export const MIN_ON_FIELD_PLAYERS = 7;
export const FULL_TEAM_PLAYERS = 11;

const REDUCED_FORMATION_ID_PREFIX = "reduced:";

/** Outfield line sizes (defenders-midfielders-forwards); the first one of each size is its default. */
const REDUCED_FORMATION_NAMES: Record<ReducedPlayerCount, string[]> = {
  10: ["4-4-1", "4-3-2", "4-2-3", "3-4-2", "3-5-1", "5-3-1"],
  9: ["4-3-1", "4-2-2", "3-4-1", "3-3-2", "5-2-1"],
  8: ["4-2-1", "3-3-1", "3-2-2", "4-3-0"],
  7: ["3-2-1", "2-3-1", "2-2-2", "3-3-0"],
};

const LINE_X = [28, 52, 78];
const LINE_LABELS = ["DF", "MC", "DC"];
const LINE_Y: Record<number, number[]> = {
  1: [50],
  2: [35, 65],
  3: [25, 50, 75],
  4: [15, 38, 62, 85],
  5: [10, 30, 50, 70, 90],
};

function buildReducedSlotDefs(name: string): FormationSlotDef[] {
  const defs: FormationSlotDef[] = [{ slotIndex: 0, label: "PT", x: 12, y: 50 }];
  name.split("-").map(Number).forEach((lineSize, lineIndex) => {
    for (const y of LINE_Y[lineSize] ?? []) {
      defs.push({ slotIndex: defs.length, label: LINE_LABELS[lineIndex], x: LINE_X[lineIndex], y });
    }
  });
  return defs;
}

function toReducedFormations(names: string[]): Formation[] {
  return names.map((name) => ({ id: `${REDUCED_FORMATION_ID_PREFIX}${name}`, name }));
}

/** Formations for a team playing with fewer than 11 players; they only exist in the live match. */
export const REDUCED_FORMATIONS: Record<ReducedPlayerCount, Formation[]> = {
  10: toReducedFormations(REDUCED_FORMATION_NAMES[10]),
  9: toReducedFormations(REDUCED_FORMATION_NAMES[9]),
  8: toReducedFormations(REDUCED_FORMATION_NAMES[8]),
  7: toReducedFormations(REDUCED_FORMATION_NAMES[7]),
};

for (const names of Object.values(REDUCED_FORMATION_NAMES)) {
  for (const name of names) {
    FORMATION_POSITIONS[name] = buildReducedSlotDefs(name);
  }
}

function toReducedCount(count: number): ReducedPlayerCount {
  return Math.min(10, Math.max(MIN_ON_FIELD_PLAYERS, count)) as ReducedPlayerCount;
}

/** Formations a team allowed to field `count` players can use. */
export function formationsForPlayerCount(count: number, fullTeamFormations: Formation[]): Formation[] {
  if (count >= FULL_TEAM_PLAYERS) return fullTeamFormations;
  return REDUCED_FORMATIONS[toReducedCount(count)];
}

/** Formation applied right after an expulsion: keeps the current number of defenders when possible. */
export function defaultReducedFormation(count: number, currentFormationName: string | null): Formation {
  const candidates = REDUCED_FORMATIONS[toReducedCount(count)];
  const currentDefenders = currentFormationName?.split("-")[0];
  return candidates.find((f) => f.name.split("-")[0] === currentDefenders) ?? candidates[0];
}
