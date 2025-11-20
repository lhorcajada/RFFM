import React from "react";
import styles from "./Goals.module.css";
import type { GoalEvent, PlayerActa } from "../../../types/acta";
import { Paper, Typography } from "@mui/material";
import GoalCard from "../GoalCard/GoalCard";

export default function Goals({
  localGoals,
  awayGoals,
  localPlayers,
  awayPlayers,
  className,
  localTeamName,
  awayTeamName,
}: {
  localGoals: GoalEvent[];
  awayGoals: GoalEvent[];
  localPlayers?: PlayerActa[];
  awayPlayers?: PlayerActa[];
  className?: string;
  localTeamName?: string;
  awayTeamName?: string;
}) {
  const combined = [
    ...(localGoals || []).map((g) => ({ ...g, teamType: "local" })),
    ...(awayGoals || []).map((g) => ({ ...g, teamType: "away" })),
  ];
  // Parse minute as number when possible
  combined.sort((a: any, b: any) => {
    const na = parseInt(String(a.minuto || "0"), 10) || 0;
    const nb = parseInt(String(b.minuto || "0"), 10) || 0;
    return na - nb;
  });

  // Build lookup for dorsals/team by codjugador
  const playerMap: Record<string, { dorsal?: string; teamName?: string }> = {};
  (localPlayers || []).forEach((p) => {
    if (p.codjugador)
      playerMap[String(p.codjugador)] = {
        dorsal: p.dorsal ?? p.dorsal,
        teamName: p.teamName ?? p.equipo ?? undefined,
      };
  });
  (awayPlayers || []).forEach((p) => {
    if (p.codjugador)
      playerMap[String(p.codjugador)] = {
        dorsal: p.dorsal ?? p.dorsal,
        teamName: p.teamName ?? p.equipo ?? undefined,
      };
  });

  return (
    <Paper className={`${styles.root} ${className || ""}`} elevation={0}>
      <Typography variant="subtitle1">Goles</Typography>
      <div className={styles.list}>
        {combined.map((g, idx) => {
          const cod = String(g.codjugador ?? "");
          const dorsal =
            (g as any).dorsal ?? playerMap[cod]?.dorsal ?? (g as any).numero;
          const teamLabel =
            (g as any).equipo ||
            (g as any).team ||
            (g as any).teamName ||
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
            />
          );
        })}
      </div>
    </Paper>
  );
}
