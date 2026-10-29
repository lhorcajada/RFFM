import React from "react";
import styles from "./TeamCrest.module.css";

type TeamCrestProps = {
  className?: string;
};

export default function TeamCrest({ className }: TeamCrestProps) {
  return (
    <svg
      viewBox="0 0 96 108"
      role="img"
      aria-label="Escudo genérico de equipo"
      className={`${styles.crest} ${className ?? ""}`.trim()}
    >
      <path
        className={styles.shield}
        d="M48 4 L88 18 V52 C88 78 70 94 48 104 C26 94 8 78 8 52 V18 Z"
      />
      <circle className={styles.primary} cx="36" cy="40" r="8" />
      <circle className={styles.secondary} cx="60" cy="40" r="8" />
      <circle className={styles.primary} cx="48" cy="34" r="9" />
      <path className={styles.primary} d="M22 76 C22 62 33 56 48 56 C63 56 74 62 74 76 Z" />
    </svg>
  );
}
