import React, { useEffect } from "react";
import styles from "./ClassificationItem.module.css";
import TeamName from "./TeamName";
import TeamMeta from "./TeamMeta";
import WinDrawLoss from "./WinDrawLoss";
import Last5 from "./Last5";
import PointsBadge from "./PointsBadge";
import Button from "@mui/material/Button";
import EmptyState from "../EmptyState/EmptyState";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";

export interface MatchResult {
  result: "G" | "E" | "P" | "W" | "D" | "L";
}

export interface ClassificationItemProps {
  teamId?: string;
  teamMatches?: any[];
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
  teamId,
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
  teamMatches,
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
      <div className={styles.pointsWrap}>
        <PointsBadge
          position={position}
          points={points}
          totalTeams={totalTeams}
        />
      </div>
      <div className={styles.controls}>
        <ResultsToggle
          teamId={teamId}
          teamName={teamName}
          items={teamMatches}
        />
      </div>
    </div>
  );
}

function ResultsToggle({
  teamId,
  teamName,
  items,
}: {
  teamId?: string;
  teamName: string;
  items?: any[] | null;
}) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const now = new Date();
  const rawList: any[] = items || [];
  const list: any[] = rawList
    .filter((it) => {
      // remove 'descansa' matches (either opponent name or match visitor/local containing 'descansa')
      const opponent = (
        it.opponent ||
        it.match?.localTeamName ||
        it.match?.visitorTeamName ||
        it.match?.equipo_local ||
        it.match?.equipo_visitante ||
        ""
      )
        .toString()
        .toLowerCase();
      if (opponent.includes("descans") || opponent.includes("descansa"))
        return false;
      return true;
    })
    .filter((it) => {
      const d = new Date(it.date || it.match?.date || it.match?.fecha || null);
      if (!d || isNaN(d.getTime())) return true;
      return d.getTime() <= now.getTime();
    });

  // disable body scroll while modal open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    }
    return;
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const modal = (
    <div
      className={styles.modalOverlay}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={popupRef}
        className={styles.resultsPanel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.resultsHeader}>
          <div>
            <div className={styles.resultsTeamName}>{teamName}</div>
            <div className={styles.resultsTitle}>Resultados</div>
          </div>
          <Button
            size="small"
            className={styles.resultsClose}
            onClick={() => setOpen(false)}
            aria-label="Cerrar resultados"
          >
            Cerrar
          </Button>
        </div>
        {list.length === 0 ? (
          <div className={styles.resultsEmpty}>
            <EmptyState description={"No hay resultados."} />
          </div>
        ) : (
          <ul className={styles.resultsList}>
            {list.map((it: any, idx: number) => (
              <li key={idx} className={styles.resultItem}>
                <div className={styles.resultOpponent}>
                  {it.opponent ||
                    (it.match?.localTeamName ??
                      it.match?.equipo_local ??
                      it.match?.local) ||
                    "Rival"}
                </div>
                <div className={styles.resultScore}>
                  {typeof it.localGoals !== "undefined" ||
                  typeof it.visitorGoals !== "undefined" ? (
                    <div className={styles.scoreRow}>
                      <span
                        className={
                          it.isLocal ? styles.teamScore : styles.opponentScore
                        }
                      >
                        {it.localGoals == null ? "" : String(it.localGoals)}
                      </span>
                      <span className={styles.scoreSeparator}>-</span>
                      <span
                        className={
                          it.isLocal ? styles.opponentScore : styles.teamScore
                        }
                      >
                        {it.visitorGoals == null ? "" : String(it.visitorGoals)}
                      </span>
                    </div>
                  ) : (
                    it.score || ""
                  )}
                </div>
                <div
                  className={`${styles.resultChip} ${
                    it.result === "G"
                      ? styles.resultG
                      : it.result === "E"
                      ? styles.resultE
                      : styles.resultP
                  }`}
                >
                  {it.result}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.resultsToggle}>
      <Button
        size="small"
        variant="outlined"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{ padding: "4px 8px", fontSize: "0.75rem" }}
      >
        {open ? (
          <ExpandLessIcon fontSize="small" />
        ) : (
          <ExpandMoreIcon fontSize="small" />
        )}{" "}
        Ver Resultados
      </Button>
      {open ? createPortal(modal, document.body) : null}
    </div>
  );
}
