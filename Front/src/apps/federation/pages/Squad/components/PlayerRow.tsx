import React, { useState } from "react";
import {
  ListItem,
  ListItemText,
  IconButton,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import {
  YellowCardIcon,
  RedCardIcon,
} from "../../../../../shared/components/ui/CardIcons/CardIcons";
import type { Player } from "../playersTypes";
import { extractPlayerIdFromUrl } from "../usePlayers";
import PlayerSeasonsDetail from "./PlayerSeasonsDetail";

type Props = {
  player: Player;
  season: string;
  initiallyExpanded?: boolean;
};

function resolvePlayerId(player: Player): string | null {
  if (player.playerId) return String(player.playerId);
  return (
    extractPlayerIdFromUrl(player.url || (player.raw && player.raw.url)) ??
    extractPlayerIdFromUrl((player.raw && player.raw.link) || undefined)
  );
}

export default function PlayerRow({ player, season }: Props) {
  const [expanded, setExpanded] = useState(false);
  const playerId = resolvePlayerId(player);

  const goals =
    (player as any).matches?.totalGoals ??
    (player as any).matches?.goles ??
    (player as any).matches?.goals ??
    0;
  const yellow =
    (player as any).cards?.yellow ?? (player as any).cards?.amarillas ?? 0;
  const red = (player as any).cards?.red ?? (player as any).cards?.rojas ?? 0;

  return (
    <div>
      <ListItem
        divider
        secondaryAction={
          <IconButton
            size="small"
            aria-label={expanded ? "Ocultar estadísticas" : "Ver estadísticas"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <VisibilityOffIcon fontSize="small" sx={{ color: 'white' }} />
            ) : (
              <VisibilityIcon fontSize="small" sx={{ color: 'white' }} />
            )}
          </IconButton>
        }
      >
        <ListItemText
          primary={<span style={{ fontWeight: 700 }}>{player.name}</span>}
          secondary={
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span>{player.email || ""}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: 6,
                }}
              >
                <SportsSoccerIcon
                  fontSize="small"
                  style={{ color: "#ffffff" }}
                />
                <span
                  style={{ color: "#ffffff", fontWeight: 900, fontSize: 16 }}
                >
                  {goals}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginLeft: 8,
                  }}
                >
                  <YellowCardIcon />
                  <span
                    style={{ color: "#ffffff", fontWeight: 700, fontSize: 13 }}
                  >
                    {yellow}
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RedCardIcon />
                  <span
                    style={{ color: "#ffffff", fontWeight: 700, fontSize: 13 }}
                  >
                    {red}
                  </span>
                </span>
              </span>
            </span>
          }
        />
      </ListItem>

      {expanded && (
        <div style={{ padding: 8 }}>
          {playerId ? (
            <PlayerSeasonsDetail playerId={playerId} season={season} />
          ) : (
            <EmptyState
              description={"No hay detalles disponibles para este jugador."}
            />
          )}
        </div>
      )}
    </div>
  );
}
