import React from "react";
import PlayerCard from "../../../components/PlayerCard/PlayerCard";
import styles from "../AttendanceTabs.module.css";
import defaultAvatar from "../../../../../assets/avatar.svg";
import type { PlayerSimple } from "../../services/convocationService";

type Props = {
  players: PlayerSimple[];
  photos: Record<string, string | null>;
  onAdd: (playerId?: string) => void;
  onDeconvoke?: (playerId: string) => void;
  canEdit: boolean;
  adding?: boolean;
};

export default function NotConvokedList({
  players,
  photos,
  onAdd,
  onDeconvoke,
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
          const photoSrc = byId ?? byUrl ?? defaultAvatar;
          return (
            <div key={key} className={styles.cardWrap}>
              <div className={`${styles.cardInner} ${styles.cardStatusPending}`}>
                <PlayerCard
                  player={{ ...(p as any), position: p.position }}
                  photoSrc={photoSrc}
                  actions={
                    canEdit ? (
                      <div className={styles.optionGroup}>
                        <button
                          disabled={adding}
                          className={`${styles.optionBtn} ${styles.optionBtnTeal} ${styles.optionBtnActive}`}
                          onClick={() => onAdd(p.id)}
                        >
                          Convocar
                        </button>
                        {onDeconvoke && p.id && (
                          <button
                            disabled={adding}
                            className={`${styles.optionBtn} ${styles.optionBtnRed}`}
                            onClick={() => onDeconvoke(p.id!)}
                          >
                            Desconvocar
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={styles.tagBadgeRow}>
                        <span className={`${styles.tagBadge} ${styles.tagWaiting}`}>En espera</span>
                      </div>
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
