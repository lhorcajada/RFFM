import type { PlayerResponse } from "../../../services/teamplayerService";

export type PositionRole =
  | "goalkeeper"
  | "fullBack"
  | "centreBack"
  | "centralMid"
  | "attackingMid"
  | "wide"
  | "forward";

export type RequirementKey = PositionRole | "wideCover" | "forwardCover";

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
  /** Role minimums counting only active positions (no cover from possible demarcations). */
  specialistShortfalls: PositionShortfall[];
  specialistDeficit: number;
  /** Players counted through a possible (non-active) demarcation, by the role they cover. */
  coverAssignments: Map<string, PositionRole>;
};

export const ROLE_MINIMUMS: Record<PositionRole, number> = {
  goalkeeper: 1,
  fullBack: 2,
  centreBack: 3,
  centralMid: 3,
  attackingMid: 1,
  wide: 3,
  forward: 1,
};

/** Players able to play the position, on top of the role minimum. */
export const EXTRA_COVER = { wide: 1, forward: 1 } as const;

const ROLE_ORDER: PositionRole[] = [
  "goalkeeper",
  "fullBack",
  "centreBack",
  "centralMid",
  "attackingMid",
  "wide",
  "forward",
];

const REQUIREMENT_LABELS: Record<RequirementKey, string> = {
  goalkeeper: "Porteros",
  fullBack: "Laterales",
  centreBack: "Centrales",
  centralMid: "Medios centro",
  attackingMid: "Mediapuntas",
  wide: "Bandas",
  wideCover: "Cobertura de banda",
  forward: "Delanteros",
  forwardCover: "Cobertura de delantero",
};

const ROLE_LABELS: Record<PositionRole, string> = {
  goalkeeper: "Portero",
  fullBack: "Lateral",
  centreBack: "Central",
  centralMid: "Medio centro",
  attackingMid: "Mediapunta",
  wide: "Banda",
  forward: "Delantero",
};

const PROTECTION_REASONS: Record<RequirementKey, string> = {
  goalkeeper: `mínimo de ${ROLE_MINIMUMS.goalkeeper} portero`,
  fullBack: `mínimo de ${ROLE_MINIMUMS.fullBack} laterales`,
  centreBack: `mínimo de ${ROLE_MINIMUMS.centreBack} centrales`,
  centralMid: `mínimo de ${ROLE_MINIMUMS.centralMid} medios centro`,
  attackingMid: `mínimo de ${ROLE_MINIMUMS.attackingMid} mediapunta`,
  wide: `mínimo de ${ROLE_MINIMUMS.wide} de banda`,
  wideCover: "cobertura de banda",
  forward: `mínimo de ${ROLE_MINIMUMS.forward} delantero`,
  forwardCover: "cobertura de delantero",
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
  8: "attackingMid",
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
  "mediocampista ofensivo": "attackingMid",
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
  if (p.includes("mediapunta") || p.includes("ofensivo") || p.includes("enganche")) return "attackingMid";
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

export function protectionReason(requirement: RequirementKey): string {
  return `Protegido: ${PROTECTION_REASONS[requirement]}`;
}

export function requiredCount(requirement: RequirementKey): number {
  if (requirement === "wideCover") return ROLE_MINIMUMS.wide + EXTRA_COVER.wide;
  if (requirement === "forwardCover") return ROLE_MINIMUMS.forward + EXTRA_COVER.forward;
  return ROLE_MINIMUMS[requirement];
}

export function formatShortfall(shortfall: PositionShortfall): string {
  return `${shortfall.label}: quedan ${shortfall.remaining} de ${shortfall.required}`;
}

function canPlay(player: PositionPlayer, role: PositionRole): boolean {
  return player.role === role || player.possibleRoles.includes(role);
}

export function evaluateRequirements(players: PositionPlayer[]): RequirementsEvaluation {
  const counts = new Map<PositionRole, number>(ROLE_ORDER.map((r) => [r, 0]));
  for (const p of players) {
    if (p.role) counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
  }
  const surplus = new Map<PositionRole, number>(
    ROLE_ORDER.map((r) => [r, (counts.get(r) ?? 0) - ROLE_MINIMUMS[r]]),
  );

  // Possible demarcations only fill a role when its specialists are not enough, and only
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

  const ableToPlay = (role: PositionRole) =>
    players.filter((p) => {
      const coveredRole = coverAssignments.get(p.id);
      if (coveredRole && coveredRole !== role) return false;
      return canPlay(p, role);
    }).length;

  const checks: Array<{ requirement: RequirementKey; required: number; remaining: number }> = [
    ...ROLE_ORDER.map((role) => ({
      requirement: role as RequirementKey,
      required: ROLE_MINIMUMS[role],
      remaining: remaining.get(role) ?? 0,
    })),
    { requirement: "wideCover", required: ROLE_MINIMUMS.wide + EXTRA_COVER.wide, remaining: ableToPlay("wide") },
    { requirement: "forwardCover", required: ROLE_MINIMUMS.forward + EXTRA_COVER.forward, remaining: ableToPlay("forward") },
  ];

  // Keep cover warnings right after their role.
  const order: RequirementKey[] = [
    "goalkeeper", "fullBack", "centreBack", "centralMid", "attackingMid",
    "wide", "wideCover", "forward", "forwardCover",
  ];
  const shortfalls = order
    .map((key) => checks.find((c) => c.requirement === key)!)
    .filter((c) => c.remaining < c.required)
    .map((c) => ({ ...c, label: REQUIREMENT_LABELS[c.requirement] }));

  const specialistShortfalls = ROLE_ORDER
    .filter((role) => (counts.get(role) ?? 0) < ROLE_MINIMUMS[role])
    .map((role) => ({
      requirement: role as RequirementKey,
      label: REQUIREMENT_LABELS[role],
      required: ROLE_MINIMUMS[role],
      remaining: counts.get(role) ?? 0,
    }));

  const sumGaps = (list: PositionShortfall[]) => list.reduce((sum, s) => sum + (s.required - s.remaining), 0);
  return {
    shortfalls,
    deficit: sumGaps(shortfalls),
    specialistShortfalls,
    specialistDeficit: sumGaps(specialistShortfalls),
    coverAssignments,
  };
}
