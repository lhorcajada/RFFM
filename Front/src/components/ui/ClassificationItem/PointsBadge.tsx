import React from "react";
import styles from "./ClassificationItem.module.css";

interface Props {
  position: number;
  points: number;
  totalTeams?: number;
}

export default function PointsBadge({ position, points, totalTeams }: Props) {
  const pos = Number(position) || 0;
  const total =
    typeof totalTeams !== "undefined" ? Number(totalTeams) || 0 : undefined;
  let badgeClass = styles.pointsBadgeNeutral;
  if (pos >= 1 && pos <= 4) badgeClass = styles.pointsBadgeBlue;
  else if (pos === 5) badgeClass = styles.pointsBadgeOrange;
  else if (pos === 6) badgeClass = styles.pointsBadgeGreen;
  else if (typeof total === "number" && total > 0 && pos > total - 3)
    badgeClass = styles.pointsBadgeRed;

  return (
    <div className={styles.points}>
      <div className={styles.pointsValue}>
        <div style={{ textAlign: "center" }}>
          <div
            className={`${styles.pointsBadge} ${badgeClass}`}
            title={`Puntos: ${points}`}
            aria-label={`Puntos: ${points}`}
          >
            {points}
          </div>
          <div className={styles.pointsLabel} aria-hidden>
            PTS
          </div>
        </div>
      </div>
    </div>
  );
}
