import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./LauncherTile.module.css";

interface LauncherTileProps {
  title: string;
  icon: ReactNode;
  to: string;
}

/**
 * Compact "app launcher" style tile — icon + short label only, no
 * description. Used by TeamDashboardCards for the quick-access grid, which
 * sits below the "A la vista" widgets and shouldn't compete visually with
 * them. Mirrors DashboardCard's FC26 visual language (dark background,
 * accent stripe/corner via the shared --rffm-dash-* tokens) but in a denser,
 * icon-forward layout — kept as its own component instead of a DashboardCard
 * variant because the two layouts (left-aligned icon+title+description vs.
 * centered icon+label-only) differ enough that forcing one component to
 * serve both would need a pile of conditional styling for little reuse.
 */
export default function LauncherTile({ title, icon, to }: LauncherTileProps) {
  return (
    <Link to={to} className={styles.tile} aria-label={title}>
      <span className={styles.iconWrap}>{icon}</span>
      <span className={styles.label}>{title}</span>
    </Link>
  );
}
