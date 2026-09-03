import type { MatchAttendanceCellState } from "./types";

export type ExcuseTypeInfo = {
  name: string;
  justified?: boolean;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Classifies a non-called match cell into one of the four "not called up" sub-states,
 * based on the excuse type recorded for the player's convocation:
 * - No excuseTypeId, an unjustified one (e.g. "Decisión técnica"), or an id not present
 *   in the catalog -> technicalDecision (keeps the original meaning of "D").
 * - Excuse name matching "lesión"/"injury" -> injury.
 * - Excuse name matching "enfermedad"/"ill(ness)"/"sick" -> illness.
 * - Any other justified excuse (Estudios, Problema familiar, Evento familiar,
 *   Cumpleaños, or any future one not recognized above) -> unavailable.
 */
export function classifyNotCalledState(
  excuseTypeId: number | null | undefined,
  excuseTypesById: ReadonlyMap<number, ExcuseTypeInfo>
): "technicalDecision" | "injury" | "illness" | "unavailable" {
  if (excuseTypeId == null) return "technicalDecision";

  const excuseType = excuseTypesById.get(excuseTypeId);
  if (!excuseType || excuseType.justified === false) return "technicalDecision";

  const name = normalizeText(excuseType.name);
  if (/lesion|injury/.test(name)) return "injury";
  if (/enfermedad|illness|\bill\b|sick/.test(name)) return "illness";
  return "unavailable";
}

export const MATCH_STATE_ABBREV: Record<MatchAttendanceCellState, string> = {
  starter: "T",
  called: "C",
  technicalDecision: "D",
  unavailable: "ND",
  injury: "L",
  illness: "E",
  absent: "—",
};

export const MATCH_STATE_LABELS: Record<MatchAttendanceCellState, string> = {
  starter: "Titular",
  called: "Convocado",
  technicalDecision: "Decisión técnica",
  unavailable: "No disponible",
  injury: "Lesión",
  illness: "Enfermedad",
  absent: "No convocado",
};

export const MATCH_STATE_RGB: Record<MatchAttendanceCellState, [number, number, number]> = {
  starter: [46, 125, 50],
  called: [21, 101, 192],
  technicalDecision: [230, 81, 0],
  unavailable: [96, 125, 139],
  injury: [123, 31, 162],
  illness: [255, 143, 0],
  absent: [150, 150, 150],
};

// The 6 states shown to the coach (in the compact strip, the expanded badge and the
// legend) — "absent" (no convocation record at all for that event) is not one of them.
export const MATCH_LEGEND_STATES: readonly Exclude<MatchAttendanceCellState, "absent">[] = [
  "starter",
  "called",
  "technicalDecision",
  "unavailable",
  "injury",
  "illness",
];
