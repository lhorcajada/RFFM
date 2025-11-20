import React, { useEffect } from "react";
import styles from "./ClassificationItem.module.css";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";

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
          <div className={styles.teamName}>{teamName}</div>
          <div className={styles.teamMeta}>
            <span className={styles.goalIconWrap} title="Partidos jugados">
              <span className={styles.iconCircleWhite} aria-hidden>
                <CalendarTodayIcon
                  className={styles.iconInner}
                  fontSize="small"
                />
              </span>
              <span className={styles.goalText}>
                <strong>{played}</strong>
              </span>
            </span>

            <span className={styles.goalIconWrap} title="Goles a favor">
              <span className={styles.iconCircleWhite} aria-hidden>
                <SportsSoccerIcon
                  className={styles.iconInner}
                  fontSize="small"
                />
              </span>
              <span className={styles.goalText}>{goalsFor}</span>
            </span>

            <span className={styles.goalIconWrap} title="Goles en contra">
              <span className={styles.iconCircleRed} aria-hidden>
                <SportsSoccerIcon
                  className={styles.iconInner}
                  fontSize="small"
                />
              </span>
              <span className={styles.goalText}>{goalsAgainst}</span>
            </span>
          </div>

          <div className={styles.statsAndLast5}>
            <div className={styles.statsRowInline}>
              <div className={styles.statItem} title="Ganados">
                <div className={styles.statIcon} aria-hidden>
                  <EmojiEventsIcon
                    fontSize="small"
                    style={{ color: "#059669" }}
                  />
                </div>
                <div className={`${styles.statCircle} ${styles.win}`}>
                  <strong>{won}</strong>
                </div>
              </div>
              <div className={styles.statItem} title="Empatados">
                <div className={styles.statIcon} aria-hidden>
                  <HandshakeOutlinedIcon
                    fontSize="small"
                    style={{ color: "#f59e0b" }}
                  />
                </div>
                <div className={`${styles.statCircle} ${styles.draw}`}>
                  {drawn}
                </div>
              </div>
              <div className={styles.statItem} title="Perdidos">
                <div className={styles.statIcon} aria-hidden>
                  <ThumbDownOffAltIcon
                    fontSize="small"
                    style={{ color: "#ef4444" }}
                  />
                </div>
                <div className={`${styles.statCircle} ${styles.loss}`}>
                  {lost}
                </div>
              </div>
            </div>

            <div className={styles.last5RowInline}>
              <span className={styles.last5Label}>Racha</span>
              <div className={styles.last5}>
                {[...last5].reverse().map((m, i) => {
                  const normalized =
                    m.result === "W" || m.result === "G"
                      ? "G"
                      : m.result === "D" || m.result === "E"
                      ? "E"
                      : "P";
                  const spanClass =
                    normalized === "G"
                      ? styles.win
                      : normalized === "E"
                      ? styles.draw
                      : styles.loss;
                  const title =
                    normalized === "G"
                      ? "Ganado"
                      : normalized === "E"
                      ? "Empatado"
                      : "Perdido";
                  return (
                    <span
                      key={i}
                      title={title}
                      className={`${styles.pill} ${spanClass}`}
                    >
                      {normalized}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.points}>
        <div className={styles.pointsValue}>
          {(() => {
            const pos = Number(position) || 0;
            const total =
              typeof totalTeams !== "undefined"
                ? Number(totalTeams) || 0
                : undefined;
            let badgeClass = styles.pointsBadgeNeutral;
            if (pos >= 1 && pos <= 4) badgeClass = styles.pointsBadgeBlue;
            else if (pos === 5) badgeClass = styles.pointsBadgeOrange;
            else if (pos === 6) badgeClass = styles.pointsBadgeGreen;
            else if (typeof total === "number" && total > 0 && pos > total - 3)
              badgeClass = styles.pointsBadgeRed;
            return (
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}
