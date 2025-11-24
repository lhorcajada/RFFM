import React from "react";
import styles from "./MatchCard.module.css";

export default function MatchTime({ time }: { time?: string | null }) {
  return (
    <div className={styles.timeText}>
      <span className={styles.timeChip}>{time || "-"}</span>
    </div>
  );
}
