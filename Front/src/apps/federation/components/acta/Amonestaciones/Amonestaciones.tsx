import React from "react";
import styles from "./Amonestaciones.module.css";
import type { CardEvent, PlayerActa } from "../../../types/acta";
import { Paper, Typography } from "@mui/material";
import AmonestacionCard from "./AmonestacionCard";

export default function Amonestaciones({
  local,
  away,
  others,
  localPlayers,
  awayPlayers,
  localTeamName,
  awayTeamName,
  onPlayerClick,
}: {
  local?: CardEvent[];
  away?: CardEvent[];
  others?: CardEvent[];
  localPlayers?: PlayerActa[];
  awayPlayers?: PlayerActa[];
  localTeamName?: string;
  awayTeamName?: string;
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
}) {
  const playerMap: Record<
    string,
    { dorsal?: string; name?: string; teamName?: string }
  > = {};
  (localPlayers || []).forEach((p) => {
    if (p.codjugador)
      playerMap[String(p.codjugador)] = {
        dorsal: p.dorsal,
        name: p.nombre_jugador,
        teamName:
          (p as Record<string, unknown>).teamName?.toString() ??
          (p as Record<string, unknown>).equipo?.toString() ??
          undefined,
      };
  });
  (awayPlayers || []).forEach((p) => {
    if (p.codjugador)
      playerMap[String(p.codjugador)] = {
        dorsal: p.dorsal,
        name: p.nombre_jugador,
        teamName:
          (p as Record<string, unknown>).teamName?.toString() ??
          (p as Record<string, unknown>).equipo?.toString() ??
          undefined,
      };
  });

  function renderCards(
    items?: CardEvent[],
    defaultTeamName?: string,
    teamType?: string,
  ) {
    if (!items || items.length === 0) return null;
    return (
      <div className={styles.cards}>
        {items.map((t, idx) => {
          const playerName =
            t.nombre_jugador ||
            playerMap[String(t.codjugador ?? "") as string]?.name ||
            "";
          const dorsal =
            (t as Record<string, unknown>).dorsal?.toString() ||
            playerMap[String(t.codjugador ?? "") as string]?.dorsal;
          const teamName =
            (t as Record<string, unknown>).equipo?.toString() ||
            playerMap[String(t.codjugador ?? "") as string]?.teamName ||
            defaultTeamName ||
            undefined;
          return (
            <AmonestacionCard
              key={idx}
              event={t}
              playerCode={t.codjugador}
              playerName={playerName}
              dorsal={dorsal}
              teamName={teamName}
              teamType={teamType}
              onPlayerClick={onPlayerClick}
            />
          );
        })}
      </div>
    );
  }

  return (
    <Paper className={styles.root} elevation={0}>
      <Typography variant="subtitle1">Amonestaciones</Typography>
      <div className={styles.rowGroup}>
        <div className={styles.col}>
          {renderCards(local || [], localTeamName, "local")}
          {renderCards(away || [], awayTeamName, "away")}
          {renderCards(others || [], undefined, undefined)}
        </div>
      </div>
    </Paper>
  );
}
