import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import avatarFallback from "../../../../../assets/avatar.svg";
import type { PlayerRating } from "../../../types/playerRating";
import { positionAccent } from "../rating/positionCategory";
import SubRatingsPanel from "./SubRatingsPanel";
import styles from "./RatingPlayerCard.module.css";

const RATING_BARS: { key: "physical" | "technical" | "tactical" | "competitiveness"; label: string }[] = [
  { key: "physical", label: "Físico" },
  { key: "technical", label: "Técnica" },
  { key: "tactical", label: "Táctica" },
  { key: "competitiveness", label: "Competitividad" },
];

const MAX_RATING = 10;

function formatRating(value: number): string {
  return String(Math.round(value * 10) / 10);
}

type Props = {
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  rating: PlayerRating | null;
  to?: string;
  expanded: boolean;
  onToggle: () => void;
  panelId: string;
  onEdit?: () => void;
  onHistory?: () => void;
  onPrint?: () => void;
};

export default function RatingPlayerCard({
  displayName,
  alias,
  photoSrc,
  dorsal,
  position,
  rating,
  to,
  expanded,
  onToggle,
  panelId,
  onEdit,
  onHistory,
  onPrint,
}: Props) {
  const resolvedName = alias?.trim() ? alias.trim() : displayName;
  const accentStyle = { "--card-accent": positionAccent(position) } as CSSProperties;
  const average = rating
    ? (rating.physical + rating.technical + rating.tactical + rating.competitiveness) / 4
    : null;

  return (
    <article className={styles.card} style={accentStyle} aria-label={resolvedName}>
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          <img src={photoSrc || avatarFallback} alt="" className={styles.avatar} />
          {dorsal != null && <span className={styles.dorsal}>{dorsal}</span>}
        </div>
        <div className={styles.identity}>
          {to ? (
            <Link to={to} className={styles.nameLink}>
              {resolvedName}
            </Link>
          ) : (
            <span className={styles.name}>{resolvedName}</span>
          )}
          {position && <span className={styles.position}>{position}</span>}
        </div>
        {average != null && (
          <div className={styles.average}>
            <span className={styles.averageValue}>{formatRating(average)}</span>
            <span className={styles.averageLabel}>Media</span>
          </div>
        )}
      </div>

      {rating ? (
        <div className={styles.bars}>
          {RATING_BARS.map(({ key, label }) => (
            <div key={key} className={styles.barRow}>
              <span className={styles.barLabel}>{label}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(rating[key] / MAX_RATING) * 100}%` }} />
              </div>
              <span className={styles.barValue}>{formatRating(rating[key])}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.unrated}>Sin valoración</div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggle}
          title={expanded ? "Ocultar subvaloraciones" : "Ver subvaloraciones"}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          {expanded ? "Ocultar subvaloraciones" : "Ver subvaloraciones"}
        </button>
        <div className={styles.iconActions}>
          {onEdit && (
            <button type="button" className={styles.iconButton} onClick={onEdit} aria-label="Editar valoración">
              <EditIcon fontSize="small" />
            </button>
          )}
          {onHistory && (
            <button type="button" className={styles.iconButton} onClick={onHistory} aria-label="Ver histórico">
              <HistoryIcon fontSize="small" />
            </button>
          )}
          {onPrint && (
            <button type="button" className={styles.iconButton} onClick={onPrint} aria-label="Exportar PDF">
              <PictureAsPdfOutlinedIcon fontSize="small" />
            </button>
          )}
        </div>
      </div>

      <div
        id={panelId}
        className={styles.panel}
        hidden={!expanded}
        role={expanded ? "region" : undefined}
        aria-label={expanded ? `Valoraciones detalladas de ${resolvedName}` : undefined}
      >
        {expanded && (
          <>
            <button type="button" className={styles.closeButton} onClick={onToggle} aria-label="Cerrar valoraciones">
              <CloseIcon fontSize="small" />
              Cerrar
            </button>
            <SubRatingsPanel rating={rating} />
          </>
        )}
      </div>
    </article>
  );
}
