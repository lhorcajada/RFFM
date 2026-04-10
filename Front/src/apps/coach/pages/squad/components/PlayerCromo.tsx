import { IconButton, Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import avatarFallback from "../../../../../assets/avatar.svg";
import styles from "./PlayerCromo.module.css";

type RatingData = {
  technical: number;
  tactical: number;
  physical: number;
  competitiveness: number;
};

type Props = {
  displayName: string;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  rating?: RatingData | null;
  rank?: number | null;
  injured?: boolean;
  onClearInjury?: () => void;
  to?: string;
  onEdit?: () => void;
  onHistory?: () => void;
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
  if (v >= 90) return "#29b6f6";
  if (v >= 70) return "#66bb6a";
  if (v >= 50) return "#ffb300";
  return "#ef5350";
}

function formatStat(v: number): string {
  return String(Math.round(v));
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PlayerCromo({
  displayName,
  photoSrc,
  dorsal,
  position,
  rating,
  rank,
  injured,
  onClearInjury,
  to,
  onEdit,
  onHistory,
}: Props) {
  const initial = displayName.trim().charAt(0).toUpperCase();
  const showActions = onEdit != null || onHistory != null;

  const card = (
    <div className={styles.card}>
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
      <div className={styles.photoArea}>
        {photoSrc ? (
          <img src={photoSrc} alt={displayName} className={styles.photo} />
        ) : (
          <img src={avatarFallback} alt={displayName} className={styles.photoAvatar} />
        )}
        <div className={styles.photoGradient} />

        {rating && (
          <div
            className={styles.avgBadge}
            style={{ color: ratingColor(avgRating(rating)) }}
          >
            {formatStat(avgRating(rating))}
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

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.accentLine} />
        <div className={styles.playerName}>
          {dorsal != null && <span className={styles.dorsalInline}>{dorsal}</span>}
          {displayName}
        </div>
        {position && <div className={styles.positionTag}>{position}</div>}

        {rating ? (
          <div className={styles.statsRow}>
            {STATS.map(({ key, label }) => (
              <div key={key} className={styles.statItem}>
                <span
                  className={styles.statValue}
                  style={{ color: ratingColor(rating[key]) }}
                >
                  {formatStat(rating[key])}
                </span>
                <span className={styles.statLabel}>{label}</span>
              </div>
            ))}
          </div>
        ) : showActions ? (
          <div className={styles.noRatingTag}>Sin valoración</div>
        ) : null}

        {showActions && (
          <div className={styles.cardActions}>
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
