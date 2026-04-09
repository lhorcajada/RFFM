import PlayerSlot from "./PlayerSlot";
import type { FormationSlotDef } from "../../../types/formation";
import styles from "./FootballField.module.css";

interface FieldPlayer {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  competitiveness?: number | null;
}

interface FootballFieldProps {
  slotDefs: FormationSlotDef[];
  slots: Record<number, string | null>;
  playersById: Record<string, FieldPlayer>;
}

export default function FootballField({ slotDefs, slots, playersById }: FootballFieldProps) {
  // Compute team average competitiveness (only slotted players with a rating)
  const slottedWithRating = slotDefs
    .map((def) => {
      const pid = slots[def.slotIndex] ?? null;
      return pid ? (playersById[pid] ?? null) : null;
    })
    .filter((p): p is FieldPlayer => p !== null && p.competitiveness != null);

  const teamAvg =
    slottedWithRating.length > 0
      ? slottedWithRating.reduce((sum, p) => sum + (p.competitiveness ?? 0), 0) /
        slottedWithRating.length
      : null;

  return (
    <div className={styles.fieldWrapper}>
      <div className={styles.field}>
        {/* Field markings */}
        <div className={styles.centerCircle} />
        <div className={styles.penaltyLeft} />
        <div className={styles.penaltyRight} />
        <div className={styles.goalLeft} />
        <div className={styles.goalRight} />

        {/* Team average overlay */}
        {teamAvg !== null && (
          <div className={styles.teamAvgBadge}>
            <span className={styles.teamAvgLabel}>Competitividad media</span>
            <span className={styles.teamAvgValue}>{Math.ceil(teamAvg)}</span>
          </div>
        )}

        {slotDefs.map((def) => {
          const playerId = slots[def.slotIndex] ?? null;
          const player = playerId ? (playersById[playerId] ?? null) : null;
          return (
            <PlayerSlot
              key={def.slotIndex}
              slotIndex={def.slotIndex}
              label={def.label}
              x={def.x}
              y={def.y}
              player={
                player
                  ? {
                      teamPlayerId: player.teamPlayerId,
                      displayName: player.displayName,
                      alias: player.alias,
                      photoSrc: player.photoSrc,
                      dorsal: player.dorsal,
                      competitiveness: player.competitiveness,
                    }
                  : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}
