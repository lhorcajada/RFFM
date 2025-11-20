import React from "react";
import styles from "./GoalCard.module.css";
import type { GoalEvent } from "../../../types/acta";
import { Chip } from "@mui/material";

export default function GoalCard({
  goal,
  team,
  dorsal,
  teamType,
}: {
  goal: GoalEvent;
  team?: string;
  dorsal?: string | number;
  teamType?: "local" | "away" | string;
}) {
  const tipo = String(goal.tipo_gol ?? "");

  return (
    <div className={styles.card}>
      <div className={styles.left}>
        <div className={styles.minute}>{String(goal.minuto ?? "") + "'"}</div>
      </div>

      <div className={styles.center}>
        <div className={styles.player}>{goal.nombre_jugador}</div>
        <div className={styles.meta}>{goal.estado || ""}</div>
      </div>

      <div className={styles.right}>
        <div className={styles.rightInner}>
          {dorsal ? (
            <Chip
              size="small"
              className={styles.chipDorsalRoot}
              label={
                <span className={styles.chipDorsal}>
                  <span className={styles.chipDorsalLabel}>Dorsal</span>
                  <span className={styles.chipDorsalNumber}>{dorsal}</span>
                </span>
              }
            />
          ) : null}

          {team ? (
            <Chip
              label={<span className={styles.teamChipLabel}>{team}</span>}
              className={`${styles.chipTeamRoot} ${
                teamType === "local" ? styles.teamLocal : styles.teamAway
              }`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
