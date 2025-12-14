import React from "react";
import styles from "./GoalCard.module.css";
import type { GoalEvent } from "../../../types/acta";
import { Chip } from "@mui/material";

export default function GoalCard({
  goal,
  team,
  dorsal,
  teamType,
  scoreAtMoment,
}: {
  goal: GoalEvent;
  team?: string;
  dorsal?: string | number;
  teamType?: "local" | "away" | string;
  scoreAtMoment?: string;
}) {
  const tipo = String(goal.tipo_gol ?? "").trim();
  // Only accept canonical numeric types 100/101/102
  // 101 -> penalti, 102 -> en propia puerta
  const isOwnGoal = tipo === "102";
  const isPenalty = tipo === "101";

  return (
    <div className={styles.card}>
      <div className={styles.left}>
        <div className={styles.minuteRow}>
          <div className={styles.minuteAndScore}>
            <div className={styles.minute}>
              {String(goal.minuto ?? "") + "'"}
            </div>
            {scoreAtMoment ? (
              <div className={styles.scorePill} aria-hidden>
                {scoreAtMoment}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.playerRow}>
          <div className={styles.player}>{goal.nombre_jugador}</div>
          {isOwnGoal ? (
            <span className={styles.chipInlineWrap}>
              <Chip
                size="small"
                label="en propia puerta"
                className={styles.chipInlineOwn}
              />
            </span>
          ) : isPenalty ? (
            <span className={styles.chipInlineWrap}>
              <Chip
                size="small"
                label="penalti"
                className={styles.chipInlinePenal}
              />
            </span>
          ) : null}
        </div>
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
          {/* penalty/own-goal chip moved next to player name */}
        </div>
      </div>
    </div>
  );
}
