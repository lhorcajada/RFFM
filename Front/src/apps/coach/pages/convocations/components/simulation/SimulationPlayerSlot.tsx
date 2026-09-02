import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import styles from "./SimulationPlayerSlot.module.css";

export interface SimSlotPlayer {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  competitiveness?: number | null;
}

interface SimulationPlayerSlotProps {
  slotIndex: number;
  label: string;
  x: number;
  y: number;
  player: SimSlotPlayer | null;
  /** Minutes this player has been on the field */
  minuteTag?: number;
  /** Prepare-mode: player just entered from bench */
  entering?: boolean;
  /** Prepare-mode: player is going off (still shown in the real slot briefly) */
  leaving?: boolean;
  prepareMode: boolean;
  /** Allow dragging this player to swap with another on-field player, outside prepareMode */
  freeRepositionEnabled?: boolean;
  slotIdPrefix?: string;
  /** Show a soccer-ball badge (used in live match to indicate the player has scored) */
  hasGoals?: boolean;
  activeTab?: number;
  usedTabById?: Record<string, number>;
}

// ─── Draggable card (used only in prepare mode) ───────────────────────────────

function DraggablePrepareCard({
  player,
  entering,
  leaving,
  hasGoals,
  usedTab,
  usedElsewhere,
}: {
  player: SimSlotPlayer;
  entering: boolean;
  leaving: boolean;
  hasGoals?: boolean;
  usedTab?: number;
  usedElsewhere?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sim-player-${player.teamPlayerId}`,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  let cardClass = styles.playerCard;
  if (isDragging) cardClass += ` ${styles.dragging}`;
  if (entering) cardClass += ` ${styles.entering}`;
  if (leaving) cardClass += ` ${styles.leaving}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cardClass}
      title={player.displayName}
    >
      <div className={styles.playerCardInner}>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={player.displayName} className={styles.playerPhoto} />
        ) : (
          <span className={styles.playerInitials}>{initials}</span>
        )}
      </div>
      {player.dorsal != null && (
        <span className={styles.dorsalBadge}>{player.dorsal}</span>
      )}
      {player.competitiveness != null && (
        <span className={`${styles.compBadge} ${
          player.competitiveness >= 8 ? styles.compTagHigh
          : player.competitiveness >= 6 ? styles.compTagMid
          : styles.compTagLow
        }`}>{Math.round(player.competitiveness)}</span>
      )}
      {entering && <span className={styles.enteringBadge}>ENTRA</span>}
      {leaving && <span className={styles.leavingBadge}>SALE</span>}
      {hasGoals && <span className={styles.goalBadge}>⚽</span>}
      {usedElsewhere ? <span className={styles.usedBadgeSlot}>Equipo {usedTab! + 1}</span> : null}
    </div>
  );
}

// ─── Draggable static card (free repositioning, no substitution window) ──────

function DraggableStaticCard({ player, hasGoals, usedTab, usedElsewhere }: { player: SimSlotPlayer; hasGoals?: boolean; usedTab?: number; usedElsewhere?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sim-player-${player.teamPlayerId}`,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${styles.playerCard} ${isDragging ? styles.dragging : ""}`}
      title={player.displayName}
    >
      <div className={styles.playerCardInner}>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={player.displayName} className={styles.playerPhoto} />
        ) : (
          <span className={styles.playerInitials}>{initials}</span>
        )}
      </div>
      {player.dorsal != null && <span className={styles.dorsalBadge}>{player.dorsal}</span>}
      {player.competitiveness != null && (
        <span className={`${styles.compBadge} ${
          player.competitiveness >= 8 ? styles.compTagHigh
          : player.competitiveness >= 6 ? styles.compTagMid
          : styles.compTagLow
        }`}>{Math.round(player.competitiveness)}</span>
      )}
      {hasGoals && <span className={styles.goalBadge}>⚽</span>}
      {usedElsewhere ? <span className={styles.usedBadgeSlot}>Equipo {usedTab! + 1}</span> : null}
    </div>
  );
}

// ─── Static card (normal game mode) ──────────────────────────────────────────

function StaticCard({ player, hasGoals, usedTab, usedElsewhere }: { player: SimSlotPlayer; hasGoals?: boolean; usedTab?: number; usedElsewhere?: boolean }) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className={styles.playerCard} title={player.displayName}>
      <div className={styles.playerCardInner}>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={player.displayName} className={styles.playerPhoto} />
        ) : (
          <span className={styles.playerInitials}>{initials}</span>
        )}
      </div>
      {player.dorsal != null && <span className={styles.dorsalBadge}>{player.dorsal}</span>}
      {player.competitiveness != null && (
        <span className={`${styles.compBadge} ${
          player.competitiveness >= 8 ? styles.compTagHigh
          : player.competitiveness >= 6 ? styles.compTagMid
          : styles.compTagLow
        }`}>{Math.round(player.competitiveness)}</span>
      )}
      {hasGoals && <span className={styles.goalBadge}>⚽</span>}
      {usedElsewhere ? <span className={styles.usedBadgeSlot}>Equipo {usedTab! + 1}</span> : null}
    </div>
  );
}

// ─── Main slot ────────────────────────────────────────────────────────────────

export default function SimulationPlayerSlot({
  slotIndex,
  label,
  x,
  y,
  player,
  minuteTag,
  entering = false,
  leaving = false,
  prepareMode,
  freeRepositionEnabled = false,
  slotIdPrefix,
  hasGoals = false,
  activeTab,
  usedTabById,
}: SimulationPlayerSlotProps) {
  const dropId = slotIdPrefix ? `sim-slot-${slotIdPrefix}-${slotIndex}` : `sim-slot-${slotIndex}`;
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: dropId });

  const shortName = player
    ? (player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" "))
    : null;

  // compute used badge info
  const usedTab = player && usedTabById ? usedTabById[player.teamPlayerId] : undefined;
  const usedElsewhere = typeof usedTab === 'number' && activeTab !== undefined && usedTab !== activeTab;

  const interactive = prepareMode || freeRepositionEnabled;

  return (
    <div ref={dropRef} className={`${styles.slot} ${interactive && isOver ? styles.slotOver : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
      {/* Minutes tag — shown in both modes above the slot */}
      {player && minuteTag !== undefined && (
        <span className={styles.minuteTag}>{minuteTag}&apos;</span>
      )}

      <div className={`${styles.dropTarget} ${isOver ? styles.over : ""} ${player ? styles.occupied : ""}`}>
        {player ? (
          prepareMode ? (
            <DraggablePrepareCard player={player} entering={entering} leaving={leaving} hasGoals={hasGoals} usedTab={usedTab} usedElsewhere={usedElsewhere} />
          ) : freeRepositionEnabled ? (
            <DraggableStaticCard player={player} hasGoals={hasGoals} usedTab={usedTab} usedElsewhere={usedElsewhere} />
          ) : (
            <StaticCard player={player} hasGoals={hasGoals} usedTab={usedTab} usedElsewhere={usedElsewhere} />
          )
        ) : (
          <span className={styles.emptyLabel}>{label}</span>
        )}
      </div>

      {player && (
        <span className={styles.playerName}>{shortName}</span>
      )}
    </div>
  );

    }
