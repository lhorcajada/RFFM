import type { CSSProperties } from "react";
import avatarFallback from "../../../../../assets/avatar.svg";
import { positionAccent } from "../rating/positionCategory";
import styles from "./RankingPlayerRow.module.css";

type Props = {
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  /** Si el jugador ya tiene valoración, la acción es editarla; si no, valorarlo. */
  rated?: boolean;
  onAction: () => void;
  dashed?: boolean;
};

export default function RankingPlayerRow({
  displayName,
  alias,
  photoSrc,
  dorsal,
  position,
  rated = false,
  onAction,
  dashed = false,
}: Props) {
  const resolvedName = alias?.trim() ? alias.trim() : displayName;
  const accentStyle = { "--player-accent": positionAccent(position) } as CSSProperties;
  const subtitle = [position, dorsal != null ? `dorsal ${dorsal}` : null].filter(Boolean).join(" · ");

  return (
    <div className={`${styles.row} ${dashed ? styles.dashed : ""}`} style={accentStyle}>
      <img src={photoSrc || avatarFallback} alt="" className={styles.avatar} />
      <div className={styles.identity}>
        <span className={styles.name}>{resolvedName}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      <button
        type="button"
        className={styles.action}
        onClick={onAction}
        aria-label={rated ? `Editar valoración de ${resolvedName}` : `Valorar a ${resolvedName}`}
      >
        {rated ? "Editar" : "Valorar"}
      </button>
    </div>
  );
}
