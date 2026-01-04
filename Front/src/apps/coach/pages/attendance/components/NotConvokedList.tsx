import React from "react";
import PlayerCard from "../../../components/PlayerCard/PlayerCard";
import { Button, Chip } from "@mui/material";
import styles from "../AttendanceTabs.module.css";
import defaultAvatar from "../../../../../assets/avatar.svg";
import type { PlayerSimple } from "../../services/convocationService";

type Props = {
  players: PlayerSimple[];
  photos: Record<string, string | null>;
  onAdd: (playerId?: string) => void;
  canEdit: boolean;
};

export default function NotConvokedList({
  players,
  photos,
  onAdd,
  canEdit,
}: Props) {
  return (
    <div>
      <div className={styles.list}>
        {players.length === 0 && (
          <div className={styles.cardWrap}>
            <div style={{ padding: 8 }}>No hay jugadores no convocados.</div>
          </div>
        )}
        {players.map((p) => {
          const key = p.id ?? p.alias ?? JSON.stringify(p);
          const byId = p.id != null ? photos[String(p.id)] : null;
          const byUrl = p.urlPhoto ? photos[String(p.urlPhoto)] : null;
          const photoSrc = byId ?? byUrl ?? defaultAvatar;
          return (
            <div key={key} className={styles.cardWrap}>
              <PlayerCard
                player={{ ...(p as any), position: p.position }}
                photoSrc={photoSrc}
                actions={
                  <>
                    <Chip label={"Pendiente"} className={styles.statusChip} />
                    {canEdit ? (
                      <Button
                        size="small"
                        variant="outlined"
                        className={styles.convocarButton}
                        onClick={() => onAdd(p.id)}
                      >
                        Convocar
                      </Button>
                    ) : null}
                  </>
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
