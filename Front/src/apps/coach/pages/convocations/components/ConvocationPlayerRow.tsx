import type { ReactNode } from "react";
import avatarFallback from "../../../../../assets/avatar.svg";
import PlayerFormBars from "../../../components/PlayerFormBars/PlayerFormBars";
import type { PlayerRating } from "../../../types/playerRating";
import styles from "./ConvocationPlayerRow.module.css";

type Props = {
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  rating?: Pick<PlayerRating, "technical" | "tactical" | "physical" | "competitiveness"> | null;
  injured?: boolean;
  /** Discharged from an injury of two weeks or more, within the recovery week. Ignored while injured. */
  recovering?: boolean;
  /** Consecutive past matches since the last technical deconvocation. */
  streakCount?: number | null;
  readiness?: number | null;
  fatigue?: number | null;
  formStatus?: number | null;
  selected?: boolean;
  actions?: ReactNode;
};

function averageRating(r: NonNullable<Props["rating"]>): number {
  return (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
}

function ratingColor(v: number): string {
  if (v >= 7) return "#66bb6a";
  if (v >= 5) return "#ffb300";
  return "#ef5350";
}

export default function ConvocationPlayerRow({
  displayName,
  alias,
  photoSrc,
  dorsal,
  position,
  rating,
  injured,
  recovering,
  streakCount,
  readiness,
  fatigue,
  formStatus,
  selected,
  actions,
}: Props) {
  const name = alias?.trim() ? alias.trim() : displayName;
  const average = rating ? Math.round(averageRating(rating)) : null;

  return (
    <div className={`${styles.row} ${selected ? styles.rowSelected : ""}`}>
      <div className={styles.photoWrap}>
        <img src={photoSrc || avatarFallback} alt={name} className={styles.photo} />
        {dorsal != null && <span className={styles.dorsal}>{dorsal}</span>}
      </div>

      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        <div className={styles.meta}>
          {position && <span className={styles.position}>{position}</span>}
          {average != null && (
            <span
              className={styles.rating}
              style={{ color: ratingColor(average) }}
              aria-label={`Valoración media: ${average}`}
            >
              {average}
            </span>
          )}
          {streakCount != null && (
            <span
              className={styles.streak}
              title="Jornadas desde la última decisión técnica"
              aria-label={`Jornadas desde la última decisión técnica: ${streakCount}`}
            >
              ↑ {streakCount}
            </span>
          )}
          {injured && <span className={`${styles.tag} ${styles.tagInjured}`}>Lesionado</span>}
          {recovering && !injured && (
            <span className={`${styles.tag} ${styles.tagRecovering}`}>En recuperación</span>
          )}
        </div>
        <PlayerFormBars
          variant="compact"
          readiness={readiness}
          fatigue={fatigue}
          formStatus={formStatus}
          fullWidth
          className={styles.formBars}
        />
      </div>

      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
