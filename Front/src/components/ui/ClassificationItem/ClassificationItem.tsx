import React, { useEffect } from "react";
import styles from "./ClassificationItem.module.css";
import TeamName from "./TeamName";
import TeamMeta from "./TeamMeta";
import WinDrawLoss from "./WinDrawLoss";
import Last5 from "./Last5";
import PointsBadge from "./PointsBadge";

export interface MatchResult {
  result: "G" | "E" | "P" | "W" | "D" | "L";
}

export interface ClassificationItemProps {
  position: number;
  teamName: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  last5: MatchResult[];
  totalTeams?: number;
}

export default function ClassificationItem({
  position,
  teamName,
  points,
  played,
  won,
  drawn,
  lost,
  goalsFor,
  goalsAgainst,
  last5,
  totalTeams,
}: ClassificationItemProps) {
  const goalAverage = goalsFor - goalsAgainst;
  const pos = Number(position) || 0;
  const total =
    typeof totalTeams !== "undefined" ? Number(totalTeams) || 0 : undefined;
  let badgeClass = styles.pointsBadgeNeutral;
  if (pos >= 1 && pos <= 4) badgeClass = styles.pointsBadgeBlue;
  else if (pos === 5) badgeClass = styles.pointsBadgeOrange;
  else if (pos === 6) badgeClass = styles.pointsBadgeGreen;
  else if (typeof total === "number" && total > 0 && pos > total - 3)
    badgeClass = styles.pointsBadgeRed;
  let posClass = styles.positionNeutral as string;
  if (pos >= 1 && pos <= 4) posClass = styles.positionBlue as string;
  else if (pos === 5) posClass = styles.positionOrange as string;
  else if (pos === 6) posClass = styles.positionGreen as string;
  else if (typeof total === "number" && total > 0 && pos > total - 3)
    posClass = styles.positionRed as string;

  return (
    <div className={styles.item}>
      <div className={`${styles.position} ${posClass}`}>{position}</div>
      <div className={styles.team}>
        <div className={styles.teamInfo}>
          <TeamName teamName={teamName} />
          <TeamMeta
            played={played}
            goalsFor={goalsFor}
            goalsAgainst={goalsAgainst}
          />
          <WinDrawLoss won={won} drawn={drawn} lost={lost} />
          <Last5 last5={last5} />
        </div>
      </div>
      <PointsBadge
        position={position}
        points={points}
        totalTeams={totalTeams}
      />
    </div>
  );
}
