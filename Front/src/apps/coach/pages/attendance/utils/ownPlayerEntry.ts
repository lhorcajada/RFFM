import type { ConvocationItem, PlayerSimple } from "../../../services/convocationService";

export type OwnPlayerPlayerKind = "waiting" | "availabilityPending" | "available" | "injured";
export type OwnPlayerConvocationKind = "pending" | "accepted" | "injuredWithConv" | "declined";

export type OwnPlayerEntry =
  | { kind: OwnPlayerPlayerKind; player: PlayerSimple }
  | { kind: OwnPlayerConvocationKind; conv: ConvocationItem };

export type OwnPlayerLists = Record<OwnPlayerPlayerKind, PlayerSimple[]> &
  Record<OwnPlayerConvocationKind, ConvocationItem[]>;

const PLAYER_KINDS: OwnPlayerPlayerKind[] = ["waiting", "availabilityPending", "available"];
const CONVOCATION_KINDS: OwnPlayerConvocationKind[] = ["pending", "accepted", "injuredWithConv", "declined"];

export function matchesAssociatedPlayer(
  entity: { id?: string | null; playerId?: string | null } | null | undefined,
  associatedPlayerId: string | null
): boolean {
  if (!entity || !associatedPlayerId) return false;
  const { id, playerId } = entity;
  return (
    (playerId != null && String(playerId) === String(associatedPlayerId)) ||
    (id != null && String(id) === String(associatedPlayerId))
  );
}

export function findOwnPlayerEntry(lists: OwnPlayerLists, associatedPlayerId: string | null): OwnPlayerEntry | null {
  if (!associatedPlayerId) return null;
  for (const kind of PLAYER_KINDS) {
    const player = lists[kind].find((p) => matchesAssociatedPlayer(p, associatedPlayerId));
    if (player) return { kind, player };
  }
  for (const kind of CONVOCATION_KINDS) {
    const conv = lists[kind].find((c) => matchesAssociatedPlayer(c.player, associatedPlayerId));
    if (conv) return { kind, conv };
  }
  const injured = lists.injured.find((p) => matchesAssociatedPlayer(p, associatedPlayerId));
  return injured ? { kind: "injured", player: injured } : null;
}
