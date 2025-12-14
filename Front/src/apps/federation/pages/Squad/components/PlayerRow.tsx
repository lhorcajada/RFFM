import React, { useState } from "react";
import {
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import PlayerStatsCard from "../../../components/players/PlayerStatsCard/PlayerStatsCard";
import {
  YellowCardIcon,
  RedCardIcon,
} from "../../../../../shared/components/ui/CardIcons/CardIcons";
import type { Player } from "../playersTypes";
import type { PlayerDetailsResponse } from "../../../types/player";
import { getPlayer } from "../../../services/api";
import { extractPlayerIdFromUrl } from "../usePlayers";

type Props = {
  player: Player;
  initiallyExpanded?: boolean;
};

export default function PlayerRow({ player }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<PlayerDetailsResponse | null>(null);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      setDetails(null);
      return;
    }
    try {
      setLoading(true);
      // Try to use available id or fallback to url extraction
      let id = player.playerId ? String(player.playerId) : undefined;
      if (!id)
        id =
          extractPlayerIdFromUrl(
            player.url || (player.raw && player.raw.url)
          ) ?? undefined;
      if (!id)
        id =
          extractPlayerIdFromUrl(
            (player.raw && player.raw.link) || undefined
          ) ?? undefined;
      if (!id) {
        // still no id: show expanded area but without fetching
        setDetails(null);
        setExpanded(true);
        return;
      }
      const data = await getPlayer(id);
      // Normalize response: some backends return the player directly, others wrap
      const raw = (data && (data.player || data)) as any;

      // If the backend returns a flat object with season fields (no statistics array),
      // build a single-element statistics array from those fields so the UI can render it.
      let sourceStats: any[] = [];
      if (
        Array.isArray(raw.statisticsBySeason) &&
        raw.statisticsBySeason.length > 0
      ) {
        sourceStats = raw.statisticsBySeason;
      } else if (Array.isArray(raw.statistics) && raw.statistics.length > 0) {
        sourceStats = raw.statistics;
      } else if (raw.seasonId || raw.seasonName || raw.competitionName) {
        // single-season flattened response
        sourceStats = [raw];
      } else {
        sourceStats = [];
      }

      const stats: PlayerDetailsResponse = {
        statisticsBySeason: sourceStats.map((s: any) => ({
          seasonId: Number(s.seasonId ?? s.temporadaId ?? s.season ?? 0),
          seasonName: s.seasonName ?? s.temporadaNombre ?? s.season ?? "",
          dorsalNumber: s.dorsalNumber ?? s.jerseyNumber ?? s.dorsal ?? "",
          position: s.position ?? s.posicion ?? s.position ?? "",
          categoryName: s.categoryName ?? s.categoriaNombre ?? "",
          competitionName:
            s.competitionName ?? s.competicionNombre ?? s.competitionName ?? "",
          groupName: s.groupName ?? s.groupName ?? s.group ?? "",
          teamName: s.teamName ?? s.teamName ?? s.team ?? "",
          teamPoints: s.teamPoints ?? s.teamPoints ?? s.puntos ?? 0,
          age: s.age ?? s.edad ?? s.playerAge ?? undefined,
          matchesPlayed: s.matchesPlayed ?? s.partidos ?? s.appearances ?? 0,
          goals: s.goals ?? s.goles ?? s.goalsCount ?? 0,
          headLine: s.headLine ?? s.titular ?? s.start ?? 0,
          substitute: s.substitute ?? s.suplente ?? s.subs ?? 0,
          yellowCards: s.yellowCards ?? s.amarillas ?? s.yellows ?? 0,
          redCards: s.redCards ?? s.rojas ?? s.reds ?? 0,
          doubleYellowCards:
            s.doubleYellowCards ?? s.doble_amarilla ?? s.doubleYellows ?? 0,
          teamParticipations:
            s.teamParticipations ||
            s.participaciones ||
            s.participacionesEquipo ||
            [],
        })),
        playerId: Number(raw.playerId ?? raw.id ?? raw.playerId ?? id),
        playerName:
          raw.playerName ?? raw.name ?? raw.nombre ?? raw.playerName ?? "",
        ace: raw.ace ?? raw.age ?? raw.edad ?? 0,
      };

      setDetails(stats ?? null);
      setExpanded(true);
    } catch (e) {
      setDetails(null);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

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
          <IconButton size="small" disabled={loading} onClick={handleToggle}>
            {loading ? (
              <CircularProgress size={16} />
            ) : expanded ? (
              <VisibilityOffIcon fontSize="small" />
            ) : (
              <VisibilityIcon fontSize="small" />
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
          {!details ? (
            <Typography variant="body2">
              No hay detalles disponibles para este jugador.
            </Typography>
          ) : (details.statisticsBySeason || []).length === 0 ? (
            <Typography variant="body2">
              No hay estadísticas por temporada para este jugador.
            </Typography>
          ) : (
            (details.statisticsBySeason || []).map((s) => (
              <PlayerStatsCard
                key={(s && s.seasonId) || Math.random()}
                stat={s}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
