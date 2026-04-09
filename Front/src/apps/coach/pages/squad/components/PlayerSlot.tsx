import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import styles from "./PlayerSlot.module.css";

interface SlotPlayer {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  competitiveness?: number | null;
}

interface PlayerSlotProps {
  slotIndex: number;
  label: string;
  x: number;
  y: number;
  player: SlotPlayer | null;
}

function DraggablePlayerCard({ player }: { player: SlotPlayer }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.teamPlayerId,
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
      {player.photoSrc ? (
        <img src={player.photoSrc} alt={player.displayName} className={styles.playerPhoto} />
      ) : (
        <span className={styles.playerInitials}>{initials}</span>
      )}
      {player.dorsal != null && (
        <span className={styles.dorsalBadge}>{player.dorsal}</span>
      )}
      {player.competitiveness != null && (
        <span className={styles.competBadge}>C·{Math.round(player.competitiveness)}</span>
      )}
    </div>
  );
}

export default function PlayerSlot({ slotIndex, label, x, y, player }: PlayerSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `field-slot-${slotIndex}` });

  return (
    <div
      className={styles.slot}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        ref={setNodeRef}
        className={`${styles.dropTarget} ${isOver ? styles.over : ""} ${player ? styles.occupied : ""}`}
      >
        {player ? (
          <DraggablePlayerCard player={player} />
        ) : (
          <span className={styles.emptyLabel}>{label}</span>
        )}
      </div>
      {player && (
        <span className={styles.playerName}>
          {player.alias?.trim()
            ? player.alias.trim()
            : player.displayName.split(" ").slice(0, 2).join(" ")}
        </span>
      )}
    </div>
  );
}
