import React from "react";
import styles from "./Goals.module.css";
import type { GoalEvent, PlayerActa } from "../../../types/acta";
import { Paper, Typography } from "@mui/material";
import GoalCard from "../GoalCard/GoalCard";

type TeamType = "local" | "away";

type GoalWithTeamType = GoalEvent & {
  teamType: TeamType;
  scoreAtMoment: string;
};

export default function Goals({
  localGoals,
  awayGoals,
  localPlayers,
  awayPlayers,
  className,
  localTeamName,
  awayTeamName,
  onPlayerClick,
}: {
  localGoals: GoalEvent[];
  awayGoals: GoalEvent[];
  localPlayers?: PlayerActa[];
  awayPlayers?: PlayerActa[];
  className?: string;
  localTeamName?: string;
  awayTeamName?: string;
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
}) {
  const combined: Array<GoalEvent & { teamType: TeamType }> = [
    ...(localGoals || []).map((g) => ({ ...g, teamType: "local" as const })),
    ...(awayGoals || []).map((g) => ({ ...g, teamType: "away" as const })),
  ];

  combined.sort((a, b) => {
    const na = parseInt(String(a.minuto ?? "0"), 10) || 0;
    const nb = parseInt(String(b.minuto ?? "0"), 10) || 0;
    return na - nb;
  });

  // Build lookup for dorsals/team by codjugador
  const playerMap: Record<string, { dorsal?: string; teamName?: string }> = {};
  (localPlayers || []).forEach((p) => {
    if (p.codjugador)
      playerMap[String(p.codjugador)] = {
        dorsal: p.dorsal,
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
        teamName:
          (p as Record<string, unknown>).teamName?.toString() ??
          (p as Record<string, unknown>).equipo?.toString() ??
          undefined,
      };
  });

  // Compute score at each goal moment while preserving order
  let localCount = 0;
  let awayCount = 0;

  const withScore: GoalWithTeamType[] = combined.map((g) => {
    if (g.teamType === "local") {
      localCount += 1;
    } else {
      awayCount += 1;
    }
    return { ...g, scoreAtMoment: `${localCount} - ${awayCount}` };
  });

  return (
    <Paper className={`${styles.root} ${className || ""}`} elevation={0}>
      <Typography variant="subtitle1">Goles</Typography>
      <div className={styles.list}>
        {withScore.map((g, idx) => {
          const cod = String(g.codjugador ?? "");
          const dorsal =
            (g as Record<string, unknown>).dorsal?.toString() ??
            playerMap[cod]?.dorsal ??
            (g as Record<string, unknown>).numero?.toString();
          const teamLabel =
            (g as Record<string, unknown>).equipo?.toString() ||
            (g as Record<string, unknown>).team?.toString() ||
            (g as Record<string, unknown>).teamName?.toString() ||
            playerMap[cod]?.teamName ||
            (g.teamType === "local"
              ? localTeamName || "Local"
              : awayTeamName || "Visitante");
          return (
            <GoalCard
              key={idx}
              goal={g}
              team={teamLabel}
              dorsal={dorsal}
              teamType={g.teamType}
              scoreAtMoment={g.scoreAtMoment}
              onPlayerClick={onPlayerClick}
            />
          );
        })}
      </div>
    </Paper>
  );
}
