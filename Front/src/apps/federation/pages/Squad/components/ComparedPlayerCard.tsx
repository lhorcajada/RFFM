import React, { useState } from "react";
import { Avatar, Chip, IconButton, Paper, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import {
  YellowCardIcon,
  RedCardIcon,
} from "../../../../../shared/components/ui/CardIcons/CardIcons";
import PlayerSeasonsDetail from "./PlayerSeasonsDetail";
import styles from "./ComparedPlayerCard.module.css";
import type {
  ComparedPlayer,
  ComparedPlayerStatus,
} from "../../../services/squadComparisonService";

type Props = {
  player: ComparedPlayer;
  season: string;
};

const STATUS_TAGS: Record<ComparedPlayerStatus, string> = {
  Licensed: "Con ficha",
  Unlicensed: "Sin ficha",
  NotInTeam: "No está en el equipo",
};

function initials(name: string): string {
  return name
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export default function ComparedPlayerCard({ player, season }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isUnlicensed = player.status === "Unlicensed";
  const { stats, rffmPlayerId } = player;

  return (
    <Paper
      className={`${styles.card} ${isUnlicensed ? styles.unlicensed : ""}`}
      elevation={0}
    >
      <Avatar
        className={styles.avatar}
        src={player.photoUrl ?? undefined}
        alt={player.name}
      >
        {initials(player.name)}
      </Avatar>
      <span className={styles.dorsal} aria-label="Dorsal">
        {player.jerseyNumber ?? "–"}
      </span>
      <Typography className={styles.name}>{player.name}</Typography>
      {stats && (
        <span className={styles.stats}>
          <span className={styles.stat}>
            <SportsSoccerIcon fontSize="small" />
            <span className={styles.goals} aria-label="Goles">
              {stats.goals}
            </span>
          </span>
          <span className={styles.stat}>
            <YellowCardIcon />
            <span aria-label="Amarillas">{stats.yellow}</span>
          </span>
          <span className={styles.stat}>
            <RedCardIcon />
            <span aria-label="Rojas">{stats.red}</span>
          </span>
        </span>
      )}
      <span className={styles.actions}>
        <Chip
          className={`${styles.tag} ${isUnlicensed ? styles.tagUnlicensed : ""}`}
          size="small"
          label={STATUS_TAGS[player.status]}
          variant={player.status === "NotInTeam" ? "outlined" : "filled"}
        />
        {rffmPlayerId && (
          <IconButton
            size="small"
            className={styles.toggle}
            aria-label={expanded ? "Ocultar estadísticas" : "Ver estadísticas"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <VisibilityOffIcon fontSize="small" />
            ) : (
              <VisibilityIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </span>
      {expanded && rffmPlayerId && (
        <div className={styles.detail}>
          <PlayerSeasonsDetail playerId={rffmPlayerId} season={season} />
        </div>
      )}
    </Paper>
  );
}
