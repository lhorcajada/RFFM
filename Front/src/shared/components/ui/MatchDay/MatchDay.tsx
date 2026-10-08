import React from "react";
import styles from "./MatchDay.module.css";
import MatchesGrid from "../MatchesGrid/MatchesGrid";

export default function MatchDay({
  title,
  items,
  hideActaButton,
  resolveActaLink,
}: {
  title: string;
  items: any[];
  hideActaButton?: boolean;
  resolveActaLink?: (codacta: string) => string | null;
}) {
  return (
    <div className={styles.dayGroup}>
      <div className={styles.dateHeader}>{title}</div>
      <MatchesGrid items={items} hideActaButton={hideActaButton} resolveActaLink={resolveActaLink} />
    </div>
  );
}
