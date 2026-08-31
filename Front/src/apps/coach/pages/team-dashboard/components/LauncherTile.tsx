import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./LauncherTile.module.css";

interface LauncherTileProps {
  title: string;
  illustration: ReactNode;
  gradient: string;
  to: string;
}

/**
 * "App launcher" tile — a small illustrated cover (gradient + composed SVG
 * scene, mirrors EventCard's generic header) over a label. Fixed to the same
 * 220px height as the compact EventCard/NewsListCard used by the widgets
 * above it, so the whole team dashboard (widgets + quick-access grid) reads
 * as one uniform card size.
 */
export default function LauncherTile({ title, illustration, gradient, to }: LauncherTileProps) {
  return (
    <Link to={to} className={styles.tile} aria-label={title}>
      <div className={styles.cover} style={{ background: gradient }}>
        <div className={styles.coverShine} />
        <div className={styles.illustration}>{illustration}</div>
      </div>
      <span className={styles.label}>{title}</span>
    </Link>
  );
}
