import React from "react";
import styles from "./ClassificationItem.module.css";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

interface Props {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
}

export default function TeamMeta({ played, goalsFor, goalsAgainst }: Props) {
  return (
    <div className={styles.teamMeta}>
      <span className={styles.goalIconWrap} title="Partidos jugados">
        <span className={styles.iconCircleWhite} aria-hidden>
          <CalendarTodayIcon className={styles.iconInner} fontSize="small" />
        </span>
        <span className={styles.goalText}>
          <strong>{played}</strong>
        </span>
      </span>

      <span className={styles.goalIconWrap} title="Goles a favor">
        <span className={styles.iconCircleWhite} aria-hidden>
          <SportsSoccerIcon className={styles.iconInner} fontSize="small" />
        </span>
        <span className={styles.goalText}>{goalsFor}</span>
      </span>

      <span className={styles.goalIconWrap} title="Goles en contra">
        <span className={styles.iconCircleRed} aria-hidden>
          <SportsSoccerIcon className={styles.iconInner} fontSize="small" />
        </span>
        <span className={styles.goalText}>{goalsAgainst}</span>
      </span>
    </div>
  );
}
