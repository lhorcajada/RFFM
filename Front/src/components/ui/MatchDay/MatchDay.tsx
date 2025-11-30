import React from "react";
import styles from "./MatchDay.module.css";
import MatchesGrid from "../MatchesGrid/MatchesGrid";

export default function MatchDay({
  title,
  items,
}: {
  title: string;
  items: any[];
}) {
  return (
    <div className={styles.dayGroup}>
      <div className={styles.dateHeader}>{title}</div>
      <MatchesGrid items={items} />
    </div>
  );
}
