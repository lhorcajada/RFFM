import React from "react";
import styles from "./MatchCard.module.css";

export default function ScoreChip({
  value,
  variantClass,
}: {
  value: any;
  variantClass?: string;
}) {
  return (
    <span className={`${styles.resultChip} ${variantClass ?? ""}`}>
      {value}
    </span>
  );
}
