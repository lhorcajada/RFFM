import React from "react";
import type { PlayerSimple } from "../../../services/convocationService";
import PositionGroupedList from "./PositionGroupedList";
import PlayerRow, { type PlayerRowTone } from "./PlayerRow";
import { positionTagOf } from "../utils/positionGroups";
import { playerDetailHref, playerDisplayName, playerDorsal } from "../utils/playerDisplay";
import actionStyles from "./RowActions.module.css";
import styles from "../AttendanceTabs.module.css";

export type AvailabilityAction = {
  label: string;
  tone: "teal" | "red";
  onClick: () => void;
};

type Props = {
  players: PlayerSimple[];
  photos: Record<string, string | null>;
  statusTone: PlayerRowTone;
  emptyText: string;
  getActions: (player: PlayerSimple) => AvailabilityAction[];
  badgeText: string;
  disabled?: boolean;
  /** Enables the bulk-selection checkbox used to pick players to notify (WhatsApp / push). */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (teamPlayerId: string) => void;
};

export default function AvailabilityList({
  players,
  photos,
  statusTone,
  emptyText,
  getActions,
  badgeText,
  disabled = false,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: Props) {
  if (players.length === 0) {
    return <div className={styles.emptyListText}>{emptyText}</div>;
  }

  const renderPlayer = (p: PlayerSimple) => {
    const photo = (p.id != null ? photos[String(p.id)] : null) ?? (p.urlPhoto ? photos[String(p.urlPhoto)] : null) ?? null;
    const displayName = playerDisplayName(p);
    const actions = getActions(p);

    return (
      <PlayerRow
        key={p.id ?? displayName}
        testId="availability-card"
        name={displayName}
        photoSrc={photo}
        dorsal={playerDorsal(p)}
        positionTag={positionTagOf(p.position)}
        detailHref={playerDetailHref(p)}
        status={{ label: badgeText, tone: statusTone }}
        selectable={selectable && !!p.id}
        selected={!!p.id && !!selectedIds?.has(p.id)}
        onToggleSelect={() => p.id && onToggleSelect?.(p.id)}
        selectLabel={`Seleccionar a ${displayName} para notificar`}
        actions={
          actions.length > 0 ? (
            <>
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={disabled}
                  className={`${actionStyles.textBtn} ${action.tone === "teal" ? actionStyles.positive : actionStyles.negative}`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </>
          ) : undefined
        }
      />
    );
  };

  return <PositionGroupedList items={players} getPosition={(p) => p.position} renderItem={renderPlayer} />;
}
