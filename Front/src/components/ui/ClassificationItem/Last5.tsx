import React from "react";
import styles from "./ClassificationItem.module.css";

export interface MatchResult {
  result: "G" | "E" | "P" | "W" | "D" | "L";
}

interface Props {
  last5: MatchResult[];
}

export default function Last5({ last5 }: Props) {
  return (
    <div className={styles.last5RowInline}>
      <span className={styles.last5Label}>Racha</span>
      <div className={styles.last5}>
        {[...last5].reverse().map((m, i) => {
          const normalized =
            m.result === "W" || m.result === "G"
              ? "G"
              : m.result === "D" || m.result === "E"
              ? "E"
              : "P";
          const spanClass =
            normalized === "G"
              ? styles.win
              : normalized === "E"
              ? styles.draw
              : styles.loss;
          const title =
            normalized === "G"
              ? "Ganado"
              : normalized === "E"
              ? "Empatado"
              : "Perdido";
          return (
            <span
              key={i}
              title={title}
              className={`${styles.pill} ${spanClass}`}
            >
              {normalized}
            </span>
          );
        })}
      </div>
    </div>
  );
}
