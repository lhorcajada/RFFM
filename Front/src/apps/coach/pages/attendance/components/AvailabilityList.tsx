import React from "react";
import { Link } from "react-router-dom";
import styles from "../AttendanceTabs.module.css";
import defaultAvatar from "../../../../../assets/avatar.svg";
import type { PlayerSimple } from "../../../services/convocationService";
import PositionGroupedList from "./PositionGroupedList";

export type AvailabilityAction = {
  label: string;
  tone: "teal" | "red";
  onClick: () => void;
};

type Props = {
  players: PlayerSimple[];
  photos: Record<string, string | null>;
  stripeClassName: string;
  emptyText: string;
  getActions: (player: PlayerSimple) => AvailabilityAction[];
  badgeText: string;
  disabled?: boolean;
};

export default function AvailabilityList({
  players,
  photos,
  stripeClassName,
  emptyText,
  getActions,
  badgeText,
  disabled = false,
}: Props) {
  if (players.length === 0) {
    return (
      <div className={styles.list}>
        <div className={styles.cardWrap}>
          <div style={{ padding: 8 }}>{emptyText}</div>
        </div>
      </div>
    );
  }

  const renderPlayer = (p: PlayerSimple) => {
    const photo = (p.id != null ? photos[String(p.id)] : null) ?? (p.urlPhoto ? photos[String(p.urlPhoto)] : null) ?? defaultAvatar;
    const displayName = p.alias || "Jugador";
    const actions = getActions(p);
    const photoArea = (
      <div className={styles.cromoPhotoArea}>
        <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
        <div className={styles.cromoGradient} />
        <div className={`${styles.cromoStatusStripe} ${stripeClassName}`} />
      </div>
    );

    return (
      <div key={p.id ?? displayName} className={styles.cardWrap} data-testid="availability-card">
        <div className={styles.cromoCard}>
          {p.id ? (
            <Link to={`/coach/player/${p.id}`} className={styles.cromoPhotoLink}>
              {photoArea}
            </Link>
          ) : (
            photoArea
          )}
          <div className={styles.cromoBody}>
            <div className={styles.cromoAccentLine} />
            <div className={styles.cromoName}>{displayName}</div>
            {p.position && <div className={styles.cromoPosition}>{p.position}</div>}
            <div className={styles.cromoActions}>
              {actions.length > 0 ? (
                <div className={styles.optionGroup}>
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={disabled}
                      className={`${styles.optionBtn} ${action.tone === "teal" ? `${styles.optionBtnTeal} ${styles.optionBtnActive}` : styles.optionBtnRed}`}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.tagBadgeRow}>
                  <span className={`${styles.tagBadge} ${styles.tagWaiting}`}>{badgeText}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PositionGroupedList items={players} getPosition={(p) => p.position} renderItem={renderPlayer} listClassName={styles.list} />
  );
}
