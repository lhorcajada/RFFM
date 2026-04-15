import type { PlayerEvaluation, AttributeScore, PoolPlayer } from "../SeasonPrep";

export type { AttributeScore };
export type AttributeKey = keyof Omit<PlayerEvaluation, "notes">;

export function playerIsGk(player: PoolPlayer): boolean {
  if (player.isGoalkeeper) return true;
  const pos = player.position?.toLowerCase() ?? "";
  return pos.includes("portero") || pos.includes("keeper") || pos.includes("arquero");
}

// ── Goalkeeper attribute groups ───────────────────────────────────────────────

export const GK_PHYSICAL: { key: AttributeKey; label: string }[] = [
  { key: "velocidad", label: "Velocidad" },
  { key: "reflejos", label: "Reflejos" },
  { key: "altura", label: "Altura" },
];
export const GK_TECHNIQUE: { key: AttributeKey; label: string }[] = [
  { key: "blocajes", label: "Blocajes" },
  { key: "rechaces", label: "Rechaces" },
  { key: "desvios", label: "Desvíos" },
  { key: "prolongaciones", label: "Prolongaciones" },
  { key: "salto", label: "Salto" },
  { key: "controlOrientado", label: "Control orientado" },
  { key: "saqueLargo", label: "Saque en largo" },
  { key: "saqueMano", label: "Saque con la mano" },
];
export const GK_COMPETITION: { key: AttributeKey; label: string }[] = [
  { key: "unVsUno", label: "1 vs 1" },
  { key: "balonesAereos", label: "Balones aéreos" },
  { key: "valentia", label: "Valentía" },
];
export const GK_GROUPS = [
  { title: "💪 Físico", attrs: GK_PHYSICAL },
  { title: "🧤 Técnica", attrs: GK_TECHNIQUE },
  { title: "⚔️ Competitividad", attrs: GK_COMPETITION },
];
export const GK_ALL_KEYS: AttributeKey[] = [
  ...GK_PHYSICAL,
  ...GK_TECHNIQUE,
  ...GK_COMPETITION,
].map((a) => a.key);

// ── Field player attribute groups ─────────────────────────────────────────────

export const FP_DEFENSE: { key: AttributeKey; label: string }[] = [
  { key: "valentia", label: "Valentía" },
  { key: "duelosGanados", label: "Ganador de duelos" },
  { key: "balonesDivididos", label: "Balones divididos" },
  { key: "marcajeFerreo", label: "Marcaje férreo" },
  { key: "pressingTrasPerdida", label: "Pressing tras pérdida" },
];
export const FP_ATTACK: { key: AttributeKey; label: string }[] = [
  { key: "visionDeJuego", label: "Visión de juego" },
  { key: "atraviesaLineas", label: "Atraviesa líneas" },
  { key: "centrosLargos", label: "Centros largos" },
  { key: "tiroAPuerta", label: "Tiro a puerta" },
  { key: "segundasJugadas", label: "Segundas jugadas" },
  { key: "controlOrientado", label: "Control orientado" },
];
export const FP_PHYSICAL: { key: AttributeKey; label: string }[] = [
  { key: "velocidad", label: "Velocidad" },
  { key: "fuerza", label: "Fuerza" },
  { key: "altura", label: "Altura" },
];
export const FP_GROUPS = [
  { title: "⚔️ Defensa", attrs: FP_DEFENSE },
  { title: "⚡ Ataque", attrs: FP_ATTACK },
  { title: "💪 Físico", attrs: FP_PHYSICAL },
];
export const FP_ALL_KEYS: AttributeKey[] = [
  ...FP_DEFENSE,
  ...FP_ATTACK,
  ...FP_PHYSICAL,
].map((a) => a.key);

// ── Score scale ───────────────────────────────────────────────────────────────

export const SCORE_COLORS: Record<AttributeScore, string> = {
  1:  "#dc2626",
  2:  "#ef4444",
  3:  "#f97316",
  4:  "#fb923c",
  5:  "#f59e0b",
  6:  "#a3e635",
  7:  "#84cc16",
  8:  "#22c55e",
  9:  "#4ec9b0",
  10: "#0ea5e9",
};

export const SCORE_LABEL: Record<AttributeScore, string> = {
  1:  "Insuf.",
  2:  "Insuf.",
  3:  "Insuf.",
  4:  "Insuf.",
  5:  "Suf.",
  6:  "Bien",
  7:  "Notable",
  8:  "Notable",
  9:  "Sobres.",
  10: "Sobres.",
};

export const ALL_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as AttributeScore[];
