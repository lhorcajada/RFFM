import type { GridCell } from "../components/convocationMatchDetail.types";

export type CauseColor = { bg: string; text: string };

const EXCUSE_TYPE_COLORS: Record<number, CauseColor> = {
  1: { bg: "rgba(240, 100, 100, 0.18)", text: "#f06464" },  // Injury
  2: { bg: "rgba(106, 180, 240, 0.18)", text: "#6ab4f0" },  // Study
  3: { bg: "rgba(255, 150, 64, 0.18)",  text: "#ff9640" },  // Ill
  4: { bg: "rgba(201, 136, 245, 0.18)", text: "#c988f5" },  // Family Problem
  5: { bg: "rgba(95, 212, 168, 0.18)",  text: "#5fd4a8" },  // Family Event
  6: { bg: "rgba(245, 200, 66, 0.18)",  text: "#f5c842" },  // Birthday Event
  8: { bg: "rgba(255, 64, 96, 0.2)",    text: "#ff4060" },  // Sanción deportiva (forced Deconvoke)
};

const FALLBACK_PALETTE: CauseColor[] = [
  { bg: "rgba(255, 100, 200, 0.18)", text: "#ff64c8" },
  { bg: "rgba(100, 240, 240, 0.18)", text: "#64f0f0" },
  { bg: "rgba(200, 200, 100, 0.18)", text: "#c8c864" },
];

const NO_DISPONIBLE_COLOR: CauseColor = { bg: "rgba(150, 150, 185, 0.18)", text: "#9696b9" };
const DECISION_TECNICA_COLOR: CauseColor = { bg: "rgba(255, 128, 64, 0.18)", text: "#ff8040" };

/** True when the cell represents a coach-initiated technical decision (no player excuse). */
export function isTechnicalDecisionCell(cell: GridCell): boolean {
  if (cell.statusName === "No disponible") return false;
  if (!cell.excuseTypeId) return true;
  // excuseTypeId=7 is "Decisión técnica" — treat same as no excuse
  if (cell.excuseName?.toLowerCase().includes("decisi") ) return true;
  return false;
}

export function getCauseColor(cell: GridCell): CauseColor {
  if (cell.statusName === "No disponible") return NO_DISPONIBLE_COLOR;
  if (isTechnicalDecisionCell(cell)) return DECISION_TECNICA_COLOR;
  if (EXCUSE_TYPE_COLORS[cell.excuseTypeId!]) return EXCUSE_TYPE_COLORS[cell.excuseTypeId!];
  return FALLBACK_PALETTE[(cell.excuseTypeId! - 7) % FALLBACK_PALETTE.length] ?? FALLBACK_PALETTE[0];
}

export function getCauseLabel(cell: GridCell): string {
  if (cell.statusName === "No disponible") return "No disponible";
  if (isTechnicalDecisionCell(cell)) return "Decisión técnica";
  return cell.excuseName || "Causa desconocida";
}
