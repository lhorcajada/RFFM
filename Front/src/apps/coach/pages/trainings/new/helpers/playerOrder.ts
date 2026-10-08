import type { PlayerResponse } from "../../../../services/teamplayerService";

const POSITION_GROUP_KEYWORDS: string[][] = [
  ["portero", "keeper", "arquero"],
  ["defensa", "central", "lateral", "libero", "líbero", "carrilero", "stopper"],
  ["centrocampista", "medio", "pivote", "interior", "volante", "mediapunta"],
  ["delantero", "extremo", "punta", "ariete", "winger"],
];

export function positionRank(position: string | null | undefined): number {
  const normalized = (position ?? "").toLowerCase();
  if (!normalized) return POSITION_GROUP_KEYWORDS.length;
  const index = POSITION_GROUP_KEYWORDS.findIndex((keywords) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  return index === -1 ? POSITION_GROUP_KEYWORDS.length : index;
}

const POSITION_GROUP_LABELS = ["Porteros", "Defensas", "Medios", "Delanteros", "Otros"];

export type PlayerPositionGroup = {
  label: string;
  players: PlayerResponse[];
};

export function groupPlayersByPosition(players: PlayerResponse[]): PlayerPositionGroup[] {
  const groups = new Map<number, PlayerResponse[]>();
  players.forEach((player) => {
    const rank = positionRank(player.position);
    groups.set(rank, [...(groups.get(rank) ?? []), player]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rank, groupPlayers]) => ({ label: POSITION_GROUP_LABELS[rank], players: groupPlayers }));
}

export function comparePlayersByPosition(a: PlayerResponse, b: PlayerResponse): number {
  const byPosition = positionRank(a.position) - positionRank(b.position);
  if (byPosition !== 0) return byPosition;
  const byDorsal = (a.dorsal ?? Number.MAX_SAFE_INTEGER) - (b.dorsal ?? Number.MAX_SAFE_INTEGER);
  if (byDorsal !== 0) return byDorsal;
  return (a.alias ?? "").localeCompare(b.alias ?? "", "es");
}
