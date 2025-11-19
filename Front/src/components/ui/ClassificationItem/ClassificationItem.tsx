import React, { useEffect } from "react";
import styles from "./ClassificationItem.module.css";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
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
}: ClassificationItemProps) {
  const goalAverage = goalsFor - goalsAgainst;
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("ClassificationItem props:", {
          teamName,
          won,
          drawn,
          lost,
          goalsFor,
          goalsAgainst,
          last5,
        });
      }
    } catch (e) {
      // ignore
    }
  }, [teamName, won, drawn, lost, goalsFor, goalsAgainst, last5]);
  return (
    <div className={styles.item}>
      <div className={styles.position}>{position}</div>
      <div className={styles.team}>
        <div className={styles.teamInfo}>
          <div className={styles.teamName}>{teamName}</div>
          <div className={styles.teamMeta}>
            Jugados {played} ·
            <span className={styles.goalIconWrap} title="Goles a favor">
              <span className={styles.iconCircleWhite} aria-hidden>
                <SportsSoccerIcon
                  className={styles.iconInner}
                  fontSize="small"
                />
              </span>
              <span className={styles.goalText}>{goalsFor}</span>
            </span>
            ·
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
        <div className={styles.pointsValue}>{points}</div>
      </div>
    </div>
  );
}
