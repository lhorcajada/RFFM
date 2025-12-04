import React from "react";
import styles from "./ClassificationItem.module.css";

interface Props {
  teamName: string;
}

export default function TeamName({ teamName }: Props) {
  return <div className={styles.teamName}>{teamName}</div>;
}
