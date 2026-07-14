import { IconButton, Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import avatarFallback from "../../../../../assets/avatar.svg";
import type { SeasonPlayerStats } from "../../convocations/components/simulation/liveMatch.types";
import styles from "./PlayerCromo.module.css";

type RatingData = {
  technical: number;
  tactical: number;
  physical: number;
  competitiveness: number;
};

type Props = {
  /** Full name of the player, used as a fallback when there is no alias. */
  displayName: string;
  /** Player's alias/nickname. When present (non-empty), it takes priority over displayName. */
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  details?: Array<string | null | undefined>;
  rating?: RatingData | null;
  rank?: number | null;
  injured?: boolean;
  onClearInjury?: () => void;
  to?: string;
  onEdit?: () => void;
  onHistory?: () => void;
  onPrint?: () => void;
  actions?: React.ReactNode;
  hidePhoto?: boolean;
  selected?: boolean;
  onClick?: () => void;
  seasonStats?: SeasonPlayerStats | null;
  /** Consecutive past matches since the last technical deconvocation. Shown as a small badge. */
  streakCount?: number | null;
};

const STATS: { key: keyof RatingData; label: string }[] = [
  { key: "technical", label: "Téc" },
  { key: "tactical", label: "Tác" },
  { key: "physical", label: "Fís" },
  { key: "competitiveness", label: "Com" },
];

function avgRating(r: RatingData): number {
  return (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
}

function ratingColor(v: number): string {
  if (v >= 8.5) return "#29b6f6";
  if (v >= 7) return "#66bb6a";
  if (v >= 5) return "#ffb300";
  return "#ef5350";
}

function formatAvg(v: number): string {
  return `Nivel ${Math.round(v)}`;
}

function formatStat(v: number): string {
  return String(Math.round(v));
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PlayerCromo({
  displayName,
  alias,
  photoSrc,
  dorsal,
  position,
  details,
  rating,
  rank,
  injured,
  onClearInjury,
  to,
  onEdit,
  onHistory,
  onPrint,
  actions,
  hidePhoto,
  selected,
  onClick,
  seasonStats,
  streakCount,
}: Props) {
  const resolvedName = alias?.trim() ? alias.trim() : displayName;
  const initial = resolvedName.trim().charAt(0).toUpperCase();
  const showActions =
    actions != null || onEdit != null || onHistory != null || onPrint != null;

  const card = (
    <div
      className={`${styles.card} ${selected ? styles.cardSelected : ""} ${onClick ? styles.cardClickable : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Edit button — top-right corner */}
      {onEdit && (
        <Tooltip title="Editar valoración">
          <IconButton
            size="small"
            className={styles.editCornerBtn}
            onClick={(e) => {
              e.preventDefault();
              onEdit();
            }}
          >
            <EditIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Photo area */}
      {!hidePhoto ? (
        <div className={styles.photoArea}>
          {photoSrc ? (
            <img src={photoSrc} alt={resolvedName} className={styles.photo} />
          ) : (
            <img src={avatarFallback} alt={resolvedName} className={styles.photoAvatar} />
          )}
          <div className={styles.photoGradient} />

          {rating && (
            <div
              className={styles.avgBadge}
              style={{ color: ratingColor(avgRating(rating)) }}
            >
              {formatAvg(avgRating(rating))}
            </div>
          )}

          {injured && (
            <div
              className={`${styles.injuredBadge} ${onClearInjury ? styles.injuredBadgeClickable : ""}`}
              onClick={onClearInjury ? (e) => { e.preventDefault(); onClearInjury(); } : undefined}
              title={onClearInjury ? "Dar de alta" : undefined}
            >
              🩹 Lesionado{onClearInjury && <span className={styles.injuredAltaHint}>· Alta</span>}
            </div>
          )}

          {rank != null && (
            <div className={`${styles.rankBadge} ${rank > 3 ? styles.rankOther : ""}`}>
              {rank <= 3 ? MEDALS[rank - 1] : rank}
            </div>
          )}
        </div>
      ) : null}

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.accentLine} />
        <div className={styles.playerName}>
          {dorsal != null && <span className={styles.dorsalInline}>{dorsal}</span>}
          {resolvedName}
        </div>
        {position && <div className={styles.positionTag}>{position}</div>}
        {details && details.some((detail) => Boolean(detail?.trim())) ? (
          <div className={styles.detailsRow}>
            {details
              .filter((detail): detail is string => Boolean(detail?.trim()))
              .map((detail) => (
                <span key={detail} className={styles.detailPill}>
                  {detail}
                </span>
              ))}
          </div>
        ) : null}

        {rating ? (
          <div className={styles.statsRow}>
            {STATS.map(({ key, label }) => (
              <div key={key} className={styles.statItem}>
                <span
                  className={styles.statValue}
                  style={{ color: ratingColor(rating[key]) }}
                >
                  {formatStat(rating[key])}{/* Nivel X.X shown per category */}
                </span>
                <span className={styles.statLabel}>{label}</span>
              </div>
            ))}
          </div>
        ) : showActions ? (
          <div className={styles.noRatingTag}>Sin valoración</div>
        ) : null}

        {seasonStats && (seasonStats.totalMatches > 0) && (
          <div className={styles.seasonStatsRow}>
            <span className={styles.seasonStatItem}>⏱ {seasonStats.totalMinutes}&apos;</span>
            <span className={styles.seasonStatSep}>·</span>
            <span className={styles.seasonStatItem}>⚽ {seasonStats.totalGoals}</span>
            <span className={styles.seasonStatSep}>·</span>
            <span className={styles.seasonStatItem}>{seasonStats.totalStarts} tit.</span>
          </div>
        )}

        {streakCount != null && (
          <div className={styles.streakBadge} title="Jornadas desde la última decisión técnica">
            <span className={styles.streakIcon}>↑</span>
            {streakCount}
          </div>
        )}

        {showActions && (
          <div className={styles.cardActions}>
            {actions}
            {onHistory && (
              <Tooltip title="Ver histórico">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    onHistory();
                  }}
                >
                  <HistoryIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {onPrint && (
              <Tooltip title="Exportar PDF">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    onPrint();
                  }}
                >
                  <PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className={styles.link}>
        {card}
      </Link>
    );
  }
  return card;
}
