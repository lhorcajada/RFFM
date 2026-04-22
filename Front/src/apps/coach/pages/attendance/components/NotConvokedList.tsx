import React from "react";
import { Link } from "react-router-dom";
import styles from "../AttendanceTabs.module.css";
import defaultAvatar from "../../../../../assets/avatar.svg";
import type { PlayerSimple } from "../../services/convocationService";

type Props = {
  players: PlayerSimple[];
  photos: Record<string, string | null>;
  onAdd: (playerId?: string) => void;
  onReject?: (playerId: string) => void;
  canEdit: boolean;
  adding?: boolean;
};

export default function NotConvokedList({
  players,
  photos,
  onAdd,
  onReject,
  canEdit,
  adding = false,
}: Props) {
  return (
    <div>
      <div className={styles.list}>
        {players.length === 0 && (
          <div className={styles.cardWrap}>
            <div style={{ padding: 8 }}>Todos los jugadores están convocados.</div>
          </div>
        )}
        {players.map((p) => {
          const key = p.id ?? p.alias ?? JSON.stringify(p);
          const byId = p.id != null ? photos[String(p.id)] : null;
          const byUrl = p.urlPhoto ? photos[String(p.urlPhoto)] : null;
          const rawPhotoSrc = byId ?? byUrl ?? null;
          const photo = rawPhotoSrc ?? defaultAvatar;
          const rawName = ((p.name ?? "") + " " + (p.lastName ?? "")).trim();
          const displayName = rawName || p.alias || "Jugador";
          const dorsalValue =
            typeof p.dorsal === "number"
              ? p.dorsal
              : p.dorsal
              ? Number(p.dorsal)
              : null;
          const hasDorsal =
            typeof dorsalValue === "number" && Number.isFinite(dorsalValue);

          return (
            <div key={key} className={styles.cardWrap}>
              <div className={styles.cromoCard}>
                {p.id ? (
                  <Link to={`/coach/player/${p.id}`} className={styles.cromoPhotoLink}>
                    <div className={styles.cromoPhotoArea}>
                      <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                      <div className={styles.cromoGradient} />
                      {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                      <div className={`${styles.cromoStatusStripe} ${styles.cromoStatusStripeTeal}`} />
                    </div>
                  </Link>
                ) : (
                  <div className={styles.cromoPhotoArea}>
                    <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                    <div className={styles.cromoGradient} />
                    {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                    <div className={`${styles.cromoStatusStripe} ${styles.cromoStatusStripeTeal}`} />
                  </div>
                )}
                <div className={styles.cromoBody}>
                  <div className={styles.cromoAccentLine} />
                  <div className={styles.cromoName}>{displayName}</div>
                  {p.position && <div className={styles.cromoPosition}>{p.position}</div>}
                  <div className={styles.cromoActions}>
                    {canEdit ? (
                      <div className={styles.optionGroup}>
                        <button
                          disabled={adding}
                          className={`${styles.optionBtn} ${styles.optionBtnTeal} ${styles.optionBtnActive}`}
                          onClick={() => onAdd(p.id)}
                        >
                          Convocar
                        </button>
                        {onReject && p.id && (
                          <button
                            disabled={adding}
                            className={`${styles.optionBtn} ${styles.optionBtnRed}`}
                            onClick={() => onReject(p.id!)}
                          >
                            Rechazado
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={styles.tagBadgeRow}>
                        <span className={`${styles.tagBadge} ${styles.tagWaiting}`}>En espera</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
