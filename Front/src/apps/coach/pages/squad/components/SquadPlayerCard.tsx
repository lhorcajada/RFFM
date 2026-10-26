import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import avatarFallback from "../../../../../assets/avatar.svg";
import PlayerFormBars from "../../../components/PlayerFormBars/PlayerFormBars";
import type { LeaguePlayerStats } from "../../../services/leagueStatsService";
import { positionAccent } from "../rating/positionCategory";
import LeagueStatsBlock from "./LeagueStatsBlock";
import styles from "./SquadPlayerCard.module.css";

type Props = {
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  injured?: boolean;
  onClearInjury?: () => void;
  leagueStats?: LeaguePlayerStats | null;
  /** Oculta los minutos del bloque de liga (jugadores y familiares, de momento). */
  hideMinutes?: boolean;
  readiness?: number | null;
  fatigue?: number | null;
  formStatus?: number | null;
  to?: string;
};

export default function SquadPlayerCard({
  displayName,
  alias,
  photoSrc,
  dorsal,
  position,
  injured,
  onClearInjury,
  leagueStats,
  hideMinutes,
  readiness,
  fatigue,
  formStatus,
  to,
}: Props) {
  const resolvedName = alias?.trim() ? alias.trim() : displayName;
  const accentStyle = { "--card-accent": positionAccent(position) } as CSSProperties;

  return (
    <article className={styles.card} style={accentStyle}>
      {to && (
        <Link to={to} className={styles.overlayLink} aria-label={`Abrir ficha de ${resolvedName}`} />
      )}

      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          <img src={photoSrc || avatarFallback} alt={resolvedName} className={styles.avatar} />
          {dorsal != null && <span className={styles.dorsal}>{dorsal}</span>}
        </div>
        <div className={styles.identity}>
          <span className={styles.name}>{resolvedName}</span>
          {position && <span className={styles.position}>{position}</span>}
        </div>
      </div>

      {injured && (
        <div className={styles.injuryRow}>
          <span className={styles.injuredChip}>Lesionado</span>
          {onClearInjury && (
            <button type="button" className={styles.dischargeButton} onClick={onClearInjury} aria-label="Dar de alta">
              Dar de alta
            </button>
          )}
        </div>
      )}

      <PlayerFormBars
        variant="compact"
        readiness={readiness}
        fatigue={fatigue}
        formStatus={formStatus}
        fullWidth
      />

      {leagueStats && <LeagueStatsBlock stats={leagueStats} hideMinutes={hideMinutes} />}
    </article>
  );
}
