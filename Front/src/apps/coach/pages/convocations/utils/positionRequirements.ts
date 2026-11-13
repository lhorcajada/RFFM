import type { PlayerResponse } from "../../../services/teamplayerService";

export type PositionRole =
  | "goalkeeper"
  | "fullBack"
  | "centreBack"
  | "centralMid"
  | "wide"
  | "forward";

export type RequirementKey = PositionRole;

export type PositionPlayer = {
  id: string;
  role: PositionRole | null;
  possibleRoles: PositionRole[];
};

export type PositionShortfall = {
  requirement: RequirementKey;
  label: string;
  required: number;
  remaining: number;
};

export type RequirementsEvaluation = {
  shortfalls: PositionShortfall[];
  deficit: number;
  /** Players counted through a possible (non-active) demarcation, by the role they cover. */
  coverAssignments: Map<string, PositionRole>;
  /** Players available for each requirement, cover included. */
  available: Map<RequirementKey, number>;
};

export const ROLE_MINIMUMS: Record<PositionRole, number> = {
  goalkeeper: 2,
  fullBack: 3,
  centreBack: 3,
  centralMid: 4,
  wide: 2,
  forward: 1,
};

const ROLE_ORDER: PositionRole[] = [
  "goalkeeper",
  "fullBack",
  "centreBack",
  "centralMid",
  "wide",
  "forward",
];

const REQUIREMENT_LABELS: Record<RequirementKey, string> = {
  goalkeeper: "Porteros",
  fullBack: "Laterales",
  centreBack: "Centrales",
  centralMid: "Medios centro",
  wide: "Bandas",
  forward: "Delanteros",
};

const ROLE_LABELS: Record<PositionRole, string> = {
  goalkeeper: "Portero",
  fullBack: "Lateral",
  centreBack: "Central",
  centralMid: "Medio centro",
  wide: "Banda",
  forward: "Delantero",
};

// DemarcationMaster ids (backend catalog).
const ROLE_BY_DEMARCATION_ID: Record<number, PositionRole> = {
  1: "goalkeeper",
  2: "fullBack",
  3: "fullBack",
  4: "centreBack",
  5: "centreBack",
  6: "centralMid",
  7: "centralMid",
  8: "centralMid",
  9: "wide",
  10: "wide",
  11: "forward",
  12: "forward",
  13: "wide",
  14: "wide",
};

const ROLE_BY_CATALOG_NAME: Record<string, PositionRole> = {
  "portero": "goalkeeper",
  "lateral izquierdo": "fullBack",
  "lateral derecho": "fullBack",
  "defensa central": "centreBack",
  "libero": "centreBack",
  "medio centro": "centralMid",
  "medio centro defensivo": "centralMid",
  "mediocampista ofensivo": "centralMid",
  "mediocampista izquierdo": "wide",
  "mediocampista derecho": "wide",
  "delantero centro": "forward",
  "segundo delantero": "forward",
  "extremo izquierdo": "wide",
  "extremo derecho": "wide",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function roleFromDemarcationId(id: number | null | undefined): PositionRole | null {
  if (id == null) return null;
  return ROLE_BY_DEMARCATION_ID[id] ?? null;
}

export function roleFromPositionName(name: string | null | undefined): PositionRole | null {
  const p = normalize(name);
  if (!p) return null;
  const exact = ROLE_BY_CATALOG_NAME[p];
  if (exact) return exact;
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return "goalkeeper";
  if (p.includes("lateral") || p.includes("carrilero")) return "fullBack";
  if (p.includes("central") || p.includes("libero") || p.includes("stopper") || p.includes("defensa")) return "centreBack";
  if (p.includes("mediapunta") || p.includes("ofensivo") || p.includes("enganche")) return "centralMid";
  if (p.includes("extremo") || p.includes("banda") || p.includes("izquierdo") || p.includes("derecho")) return "wide";
  if (p.includes("delantero") || p.includes("punta") || p.includes("ariete")) return "forward";
  if (p.includes("medio") || p.includes("pivote") || p.includes("centrocampista")) return "centralMid";
  return null;
}

export function toPositionPlayer(
  player: Pick<PlayerResponse, "id" | "position" | "activePositionId" | "possibleDemarcationIds">,
): PositionPlayer {
  const role = roleFromDemarcationId(player.activePositionId) ?? roleFromPositionName(player.position);
  const possibleRoles: PositionRole[] = [];
  for (const id of player.possibleDemarcationIds ?? []) {
    const r = roleFromDemarcationId(id);
    if (r && !possibleRoles.includes(r)) possibleRoles.push(r);
  }
  return { id: player.id, role, possibleRoles };
}

export function roleLabel(role: PositionRole | null): string {
  return role ? ROLE_LABELS[role] : "Sin posición";
}

export function protectionReason(requirement: RequirementKey, remaining: number): string {
  const required = requiredCount(requirement);
  return `Protegido: quedan ${remaining} de ${required} ${REQUIREMENT_LABELS[requirement].toLowerCase()} disponibles`;
}

export function requiredCount(requirement: RequirementKey): number {
  return ROLE_MINIMUMS[requirement];
}

export function formatShortfall(shortfall: PositionShortfall): string {
  return `${shortfall.label}: quedan ${shortfall.remaining} de ${shortfall.required}`;
}

export function evaluateRequirements(players: PositionPlayer[]): RequirementsEvaluation {
  const counts = new Map<PositionRole, number>(ROLE_ORDER.map((r) => [r, 0]));
  for (const p of players) {
    if (p.role) counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
  }
  const surplus = new Map<PositionRole, number>(
    ROLE_ORDER.map((r) => [r, (counts.get(r) ?? 0) - ROLE_MINIMUMS[r]]),
  );

  // Possible demarcations fill a role when its specialists are not enough, and only
  // from players whose own role keeps its minimum without them.
  const coverAssignments = new Map<string, PositionRole>();
  const remaining = new Map<PositionRole, number>(counts);
  for (const role of ROLE_ORDER) {
    let missing = ROLE_MINIMUMS[role] - (remaining.get(role) ?? 0);
    for (const p of players) {
      if (missing <= 0) break;
      if (p.role === role || coverAssignments.has(p.id) || !p.possibleRoles.includes(role)) continue;
      const ownSurplus = p.role ? surplus.get(p.role) ?? 0 : Infinity;
      if (ownSurplus <= 0) continue;
      if (p.role) surplus.set(p.role, ownSurplus - 1);
      coverAssignments.set(p.id, role);
      remaining.set(role, (remaining.get(role) ?? 0) + 1);
      missing--;
    }
  }

  const shortfalls = ROLE_ORDER.map((role) => ({
    requirement: role as RequirementKey,
    required: ROLE_MINIMUMS[role],
    remaining: remaining.get(role) ?? 0,
  }))
    .filter((c) => c.remaining < c.required)
    .map((c) => ({ ...c, label: REQUIREMENT_LABELS[c.requirement] }));

  return {
    shortfalls,
    deficit: shortfalls.reduce((sum, s) => sum + (s.required - s.remaining), 0),
    coverAssignments,
    available: new Map<RequirementKey, number>(ROLE_ORDER.map((role) => [role, remaining.get(role) ?? 0])),
  };
}
