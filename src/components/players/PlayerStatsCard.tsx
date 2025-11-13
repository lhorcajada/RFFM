import React from "react";
import { Paper, Typography } from "@mui/material";
import styles from "./PlayerStatsCard.module.css";
import type { StatisticsBySeason } from "../../types/player";

export default function PlayerStatsCard({
  stat,
}: {
  stat: StatisticsBySeason;
}) {
  return (
    <Paper className={styles.card} elevation={0}>
      <div className={styles.header}>
        <Typography variant="subtitle2">{stat.seasonName}</Typography>
        <Typography variant="caption">
          {stat.competitionName} — {stat.groupName}
        </Typography>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <strong>Equipo</strong>
          <br />
          {stat.teamName}
        </div>
        <div className={styles.field}>
          <strong>Puntos equipo</strong>
          <br />
          {stat.teamPoints}
        </div>
        <div className={styles.field}>
          <strong>Dorsal</strong>
          <br />
          {stat.dorsalNumber || "-"}
        </div>
        <div className={styles.field}>
          <strong>Posición</strong>
          <br />
          {stat.position || "-"}
        </div>

        <div className={styles.field}>
          <strong>Partidos</strong>
          <br />
          {stat.matchesPlayed}
        </div>
        <div className={styles.field}>
          <strong>Goles</strong>
          <br />
          {stat.goals}
        </div>
        <div className={styles.field}>
          <strong>Titular</strong>
          <br />
          {stat.headLine}
        </div>

        <div className={styles.field}>
          <strong>Suplente</strong>
          <br />
          {stat.substitute}
        </div>
        <div className={styles.field}>
          <strong>Amarillas</strong>
          <br />
          {stat.yellowCards}
        </div>
        <div className={styles.field}>
          <strong>Rojas</strong>
          <br />
          {stat.redCards}
        </div>
        <div className={styles.field}>
          <strong>Doble amarilla</strong>
          <br />
          {stat.doubleYellowCards ?? 0}
        </div>
      </div>
      {stat.teamParticipations && stat.teamParticipations.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Typography variant="subtitle2">Participaciones equipo</Typography>
          {stat.teamParticipations.map((tp, idx) => (
            <div key={idx} className={styles.field}>
              <strong>{tp.teamName}</strong>
              <br />
              {tp.competitionName} — {tp.groupName} — Puntos: {tp.teamPoints}
            </div>
          ))}
        </div>
      )}
    </Paper>
  );
}
