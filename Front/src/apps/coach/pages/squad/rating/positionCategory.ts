export const GOALKEEPER_CATEGORY = 0;
export const DEFENDER_CATEGORY = 1;
export const MIDFIELDER_CATEGORY = 2;
export const FORWARD_CATEGORY = 3;
export const UNKNOWN_CATEGORY = 4;

export function positionCategory(position?: string | null): number {
  const p = (position ?? "").toLowerCase();
  if (!p) return UNKNOWN_CATEGORY;
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return GOALKEEPER_CATEGORY;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero") || p.includes("stopper")) return DEFENDER_CATEGORY;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return MIDFIELDER_CATEGORY;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return FORWARD_CATEGORY;
  return UNKNOWN_CATEGORY;
}

export function isGoalkeeperPosition(position?: string | null): boolean {
  return positionCategory(position) === GOALKEEPER_CATEGORY;
}

export function categoryAccent(category: number): string {
  if (category === GOALKEEPER_CATEGORY) return "#f59e0b";
  if (category === DEFENDER_CATEGORY) return "#3b82f6";
  if (category === MIDFIELDER_CATEGORY) return "#10b981";
  if (category === FORWARD_CATEGORY) return "#ef4444";
  return "#6b7280";
}

export function positionAccent(position?: string | null): string {
  return categoryAccent(positionCategory(position));
}
