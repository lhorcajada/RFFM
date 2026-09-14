import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import slotStyles from "./SimulationPlayerSlot.module.css";
import styles from "./CompactBenchCard.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// Compact bench card — same visual language as the on-field player cards
// (SimulationPlayerSlot): photo/initials, dorsal, name, minutes if applicable.
// No competitiveness, streak, or form bars — those live in the rich,
// read-only "En el campo"/"Banquillo" info panels (BenchPlayerCard).
//
// Reuses SimulationPlayerSlot.module.css classes directly instead of
// duplicating them, since the visual language must match exactly and
// SimulationPlayerSlot's own card components are coupled to absolute pitch
// positioning (the `.slot` wrapper), which this list-based card doesn't need.
// ─────────────────────────────────────────────────────────────────────────────

export interface CompactBenchCardProps {
  player: SquadPlayer;
  /** Minutes played so far — a minutes tag is shown only when this is > 0. */
  minutesPlayed?: number;
  /** True when this player is currently being subbed off the field (prepareMode). */
  isLeaving?: boolean;
  /** True while being dragged (dims the card, matching the field card's .dragging style). */
  isDragActive?: boolean;
}

export function CompactBenchCard({
  player,
  minutesPlayed = 0,
  isLeaving = false,
  isDragActive = false,
}: CompactBenchCardProps) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  let cardClass = slotStyles.playerCard;
  if (isDragActive) cardClass += ` ${slotStyles.dragging}`;

  const shortName = player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ");

  return (
    <div className={styles.wrapper} title={player.displayName}>
      <div className={cardClass}>
        <div className={slotStyles.playerCardInner}>
          {player.photoSrc ? (
            <img src={player.photoSrc} alt={player.displayName} className={slotStyles.playerPhoto} />
          ) : (
            <span className={slotStyles.playerInitials}>{initials}</span>
          )}
        </div>
        {player.dorsal != null && <span className={slotStyles.dorsalBadge}>{player.dorsal}</span>}
        {isLeaving && <span className={slotStyles.leavingBadge}>SALE</span>}
      </div>
      {minutesPlayed > 0 && !isLeaving && (
        <span className={slotStyles.minuteTag}>{minutesPlayed}&apos;</span>
      )}
      <span className={slotStyles.playerName}>{shortName}</span>
    </div>
  );
}

export function DraggableCompactBenchCard({
  player,
  minutesPlayed = 0,
  isLeaving = false,
}: Omit<CompactBenchCardProps, "isDragActive">) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sim-player-${player.id}`,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={styles.dragHandle}>
      <CompactBenchCard
        player={player}
        minutesPlayed={minutesPlayed}
        isLeaving={isLeaving}
        isDragActive={isDragging}
      />
    </div>
  );
}
