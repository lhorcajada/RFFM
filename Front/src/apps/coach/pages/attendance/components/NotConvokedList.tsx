import React from "react";
import type { PlayerSimple } from "../../../services/convocationService";
import PositionGroupedList from "./PositionGroupedList";
import PlayerRow from "./PlayerRow";
import { positionTagOf } from "../utils/positionGroups";
import { playerDetailHref, playerDisplayName, playerDorsal } from "../utils/playerDisplay";
import actionStyles from "./RowActions.module.css";
import styles from "../AttendanceTabs.module.css";

type Props = {
  players: PlayerSimple[];
  photos: Record<string, string | null>;
  onAdd: (playerId?: string) => void;
  onReject?: (playerId: string) => void;
  canEdit: boolean;
  adding?: boolean;
  viewablePlayerId?: string | null;
  isPlayerOrFamily?: boolean;
  associatedPlayerId?: string | null;
};

export default function NotConvokedList({
  players,
  photos,
  onAdd,
  onReject,
  canEdit,
  adding = false,
  viewablePlayerId,
  isPlayerOrFamily = false,
  associatedPlayerId = null,
}: Props) {
  const renderPlayer = (p: PlayerSimple) => {
    const displayName = playerDisplayName(p);
    const key = p.id ?? p.alias ?? JSON.stringify(p);
    const byId = p.id != null ? photos[String(p.id)] : null;
    const byUrl = p.urlPhoto ? photos[String(p.urlPhoto)] : null;
    const canViewDetail = !viewablePlayerId || p.playerId === viewablePlayerId || p.id === viewablePlayerId;
    const canEditThisPlayer = !isPlayerOrFamily || p.playerId === associatedPlayerId;
    const showActions = canEdit || (isPlayerOrFamily && canEditThisPlayer);
    const actionsDisabled = adding || (isPlayerOrFamily && !canEditThisPlayer);

    return (
      <PlayerRow
        key={key}
        name={displayName}
        photoSrc={byId ?? byUrl ?? null}
        dorsal={playerDorsal(p)}
        positionTag={positionTagOf(p.position)}
        detailHref={canViewDetail ? playerDetailHref(p) : null}
        status={showActions ? null : { label: "En espera", tone: "waiting" }}
        actions={
          showActions ? (
            <>
              <button
                type="button"
                disabled={actionsDisabled}
                className={`${actionStyles.textBtn} ${actionStyles.positive}`}
                onClick={() => onAdd(p.id)}
              >
                Convocar
              </button>
              {onReject && p.id && (
                <button
                  type="button"
                  disabled={actionsDisabled}
                  className={`${actionStyles.textBtn} ${actionStyles.negative}`}
                  onClick={() => onReject(p.id!)}
                >
                  Rechazado
                </button>
              )}
            </>
          ) : undefined
        }
      />
    );
  };

  if (players.length === 0) {
    return <div className={styles.emptyListText}>Todos los jugadores están convocados.</div>;
  }

  return <PositionGroupedList items={players} getPosition={(p) => p.position} renderItem={renderPlayer} />;
}
