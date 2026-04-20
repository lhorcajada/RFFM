import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./DashboardCard.module.css";

export default function DashboardCard({
  title,
  description,
  icon,
  to,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
}) {
  return (
    <Link to={to} className={styles.card} aria-label={title}>
      <div className={styles.iconWrap}>{icon}</div>
      <span className={styles.title}>{title}</span>
      {description && <span className={styles.description}>{description}</span>}
    </Link>
  );
}
