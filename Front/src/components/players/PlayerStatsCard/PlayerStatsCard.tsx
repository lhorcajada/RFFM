import React from "react";
import { Paper, Typography } from "@mui/material";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import StarIcon from "@mui/icons-material/Star";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EventIcon from "@mui/icons-material/Event";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import RoomIcon from "@mui/icons-material/Room";
import GroupIcon from "@mui/icons-material/Group";
import LensIcon from "@mui/icons-material/Lens";
import {
  YellowCardIcon,
  RedCardIcon,
  DoubleYellowIcon,
  SubstituteIcon,
  JerseyIcon,
} from "../../ui/CardIcons/CardIcons";
import styles from "./PlayerStatsCard.module.css";
import type { StatisticsBySeason } from "../../../types/player";

export default function PlayerStatsCard({
  stat,
}: {
  stat: StatisticsBySeason;
}) {
  return (
    <Paper className={styles.card} elevation={0}>
      <div className={styles.header}>
        <Typography variant="subtitle2">{stat.competitionName}</Typography>
        <Typography variant="caption">{stat.groupName}</Typography>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <strong>
            <GroupIcon className={styles.icon} /> Equipo
          </strong>
          <br />
          {stat.teamName}
        </div>
        <div className={styles.field}>
          <strong>
            <ConfirmationNumberIcon className={styles.icon} /> Puntos equipo
          </strong>
          <br />
          {stat.teamPoints}
        </div>
        <div className={styles.field}>
          <strong>
            <JerseyIcon
              className={`${styles.icon} ${styles.forcedIcon}`}
              number={stat.dorsalNumber ?? undefined}
            />{" "}
            Dorsal
          </strong>
          <br />
          {stat.dorsalNumber || "-"}
        </div>
        <div className={styles.field}>
          <strong>
            <LensIcon className={styles.icon} /> Posición
          </strong>
          <br />
          {stat.position || "-"}
        </div>

        <div className={styles.field}>
          <strong>Edad</strong>
          <br />
          {stat.age ?? "-"}
        </div>

        <div className={styles.field}>
          <strong>
            <EventIcon className={styles.icon} /> Partidos
          </strong>
          <br />
          {stat.matchesPlayed}
        </div>
        <div className={styles.field}>
          <strong>
            <SportsSoccerIcon className={styles.icon} /> Goles
          </strong>
          <br />
          {stat.goals}
        </div>
        <div className={styles.field}>
          <strong>
            <StarIcon className={styles.icon} /> Titular
          </strong>
          <br />
          {stat.headLine}
        </div>

        <div className={styles.field}>
          <strong>
            <SubstituteIcon className={styles.icon} /> Suplente
          </strong>
          <br />
          {stat.substitute}
        </div>
        <div className={styles.field}>
          <strong>
            <YellowCardIcon className={styles.icon} /> Amarillas
          </strong>
          <br />
          {stat.yellowCards}
        </div>
        <div className={styles.field}>
          <strong>
            <RedCardIcon className={styles.icon} /> Rojas
          </strong>
          <br />
          {stat.redCards}
        </div>
        <div className={styles.field}>
          <strong>
            <DoubleYellowIcon className={styles.icon} /> Doble amarilla
          </strong>
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
