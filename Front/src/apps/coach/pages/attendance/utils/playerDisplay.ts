import type { PlayerSimple } from "../../../services/convocationService";

type DisplayablePlayer = PlayerSimple & {
  name?: string | null;
  lastName?: string | null;
  dorsal?: number | string | null;
};

export function playerDisplayName(player: PlayerSimple): string {
  const p = player as DisplayablePlayer;
  return p.alias || `${p.name ?? ""} ${p.lastName ?? ""}`.trim() || "Jugador";
}

export function playerDorsal(player: PlayerSimple): number | null {
  const raw = (player as DisplayablePlayer).dorsal;
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function playerDetailHref(player: PlayerSimple): string | null {
  return player.id ? `/coach/player/${player.id}` : null;
}
