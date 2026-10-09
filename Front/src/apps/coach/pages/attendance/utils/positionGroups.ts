export type PositionGroupKey = "goalkeepers" | "defenders" | "midfielders" | "wingers" | "forwards" | "unknown";

export const POSITION_GROUPS: { key: PositionGroupKey; label: string }[] = [
  { key: "goalkeepers", label: "Porteros" },
  { key: "defenders", label: "Defensas" },
  { key: "midfielders", label: "Medios" },
  { key: "wingers", label: "Extremos" },
  { key: "forwards", label: "Delanteros" },
  { key: "unknown", label: "Sin posición" },
];

// Matched against DemarcationMaster names. Wingers and forwards go before midfielders so
// that no future "medio…" spelling of a winger/forward falls into the wrong group.
const RULES: { key: PositionGroupKey; keywords: string[] }[] = [
  { key: "goalkeepers", keywords: ["portero"] },
  { key: "defenders", keywords: ["lateral", "central", "libero", "carrilero", "defensa"] },
  { key: "wingers", keywords: ["extremo"] },
  { key: "forwards", keywords: ["delantero"] },
  { key: "midfielders", keywords: ["medio", "mediocampista", "pivote", "interior", "mediapunta"] },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function positionGroupOf(position?: string | null): PositionGroupKey {
  if (!position) return "unknown";
  const normalized = normalize(position);
  const rule = RULES.find((r) => r.keywords.some((k) => normalized.includes(k)));
  return rule?.key ?? "unknown";
}

export function groupByPosition<T>(
  items: T[],
  getPosition: (item: T) => string | null | undefined
): { key: PositionGroupKey; label: string; items: T[] }[] {
  return POSITION_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => positionGroupOf(getPosition(item)) === group.key),
  })).filter((group) => group.items.length > 0);
}
