import React from "react";
import { Goleador } from "../../../services/api";
import styles from "./GoleadoresList.module.css";
import Chip from "@mui/material/Chip";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

interface GoleadoresListProps {
  goleador: Goleador;
  position: number;
  totalPlayers?: number;
}

const GoleadoresList: React.FC<GoleadoresListProps> = ({
  goleador,
  position,
  totalPlayers,
}) => {
  const isPrimaryTeam = React.useMemo(() => {
    try {
      const raw = localStorage.getItem("rffm.current_selection");
      if (!raw) return false;
      const combo = JSON.parse(raw as string);
      const savedTeamId =
        combo?.team?.id ?? combo?.teamId ?? combo?.teamId ?? null;
      return String(savedTeamId) === String(goleador.teamId);
    } catch (e) {
      return false;
    }
  }, [goleador.teamId]);

  const average = (goleador.scores / goleador.matchesPlayed).toFixed(2);
  const pos = Number(position) || 0;
  const total =
    typeof totalPlayers !== "undefined" ? Number(totalPlayers) || 0 : undefined;

  let posClass = styles.positionNeutral;
  if (pos === 1) posClass = styles.positionGold;
  else if (pos === 2) posClass = styles.positionSilver;
  else if (pos === 3) posClass = styles.positionBronze;
  else if (pos >= 4 && pos <= 10) posClass = styles.positionBlue;

  let badgeClass = styles.pointsBadgeNeutral;
  if (pos === 1) badgeClass = styles.pointsBadgeGold;
  else if (pos === 2) badgeClass = styles.pointsBadgeSilver;
  else if (pos === 3) badgeClass = styles.pointsBadgeBronze;
  else if (pos >= 4 && pos <= 10) badgeClass = styles.pointsBadgeBlue;

  return (
    <div className={styles.item}>
      <div className={`${styles.position} ${posClass}`}>{position}</div>
      <div className={styles.player}>
        <div className={styles.playerInfo}>
          <div className={styles.playerName}>{goleador.playerName}</div>
          {/* team name (optional) */}
          {goleador.teamName &&
            (isPrimaryTeam ? (
              <Chip
                label={goleador.teamName}
                size="small"
                className={`${styles.teamChip} ${styles.teamChipPrimary}`}
                aria-hidden
              />
            ) : (
              <span className={styles.teamText} aria-hidden>
                {goleador.teamName}
              </span>
            ))}
          <div className={styles.playerMeta}>
            <span className={styles.iconWrap} title="Partidos jugados">
              <span className={styles.iconCircle} aria-hidden>
                <CalendarTodayIcon
                  className={styles.iconInner}
                  fontSize="small"
                />
              </span>
              <span className={styles.metaText}>
                <strong>{goleador.matchesPlayed}</strong>
              </span>
            </span>
            <span
              className={styles.iconWrap}
              title="Media de goles por partido"
            >
              <span className={styles.iconCircle} aria-hidden>
                <SportsSoccerIcon
                  className={styles.iconInner}
                  fontSize="small"
                />
              </span>
              <span className={styles.metaText}>{average} por partido</span>
            </span>
            {goleador.penaltyScores > 0 && (
              <>
                <span className={styles.iconWrap} title="Goles de penalti">
                  <span className={styles.iconCirclePenalty} aria-hidden>
                    <SportsSoccerIcon
                      className={styles.iconInner}
                      fontSize="small"
                    />
                  </span>
                  <span className={styles.metaText}>
                    ({goleador.penaltyScores} de penalti)
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={styles.goals}>
        <div className={styles.goalsValue}>
          <div
            className={`${styles.goalsBadge} ${badgeClass}`}
            title={`Goles: ${goleador.scores}`}
          >
            <EmojiEventsIcon className={styles.trophyIcon} fontSize="small" />
            {goleador.scores}
          </div>
          <div className={styles.goalsLabel} aria-hidden>
            GOLES
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoleadoresList;
