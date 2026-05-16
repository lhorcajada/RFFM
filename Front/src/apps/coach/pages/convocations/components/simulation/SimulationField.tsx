import type { FormationSlotDef } from "../../../../types/formation";
import SimulationPlayerSlot, { type SimSlotPlayer } from "./SimulationPlayerSlot";
import styles from "./SimulationField.module.css";

interface SimulationFieldProps {
  slotDefs: FormationSlotDef[];
  /** Current real slots (always passed) */
  slots: Record<number, string | null>;
  /** Preview slots in prepare mode */
  prepareSlotsPreview?: Record<number, string | null>;
  playersById: Record<string, SimSlotPlayer>;
  playerMinutes: Record<string, number>;
  prepareMode: boolean;
  slotIdPrefix?: string;
  /** Optional set of teamPlayerIds that have scored — shows a goal badge on their avatar */
  scorerIds?: Set<string>;
}

export default function SimulationField({
  slotDefs = [],
  slots = {},
  prepareSlotsPreview,
  playersById = {},
  playerMinutes = {},
  prepareMode,
  slotIdPrefix,
  scorerIds,
}: SimulationFieldProps) {
  // In prepare mode we render from the preview, otherwise from real slots
  const activeSlots = prepareMode && prepareSlotsPreview ? prepareSlotsPreview : slots;

  // Compute entering/leaving sets for prepare mode highlights
  const enteringIds = new Set<string>();
  const leavingIds = new Set<string>();

  if (prepareMode && prepareSlotsPreview) {
    const realOnField = new Set(Object.values(slots).filter(Boolean) as string[]);
    const previewOnField = new Set(
      Object.values(prepareSlotsPreview).filter(Boolean) as string[],
    );
    for (const pid of previewOnField) {
      if (!realOnField.has(pid)) enteringIds.add(pid);
    }
    for (const pid of realOnField) {
      if (!previewOnField.has(pid)) leavingIds.add(pid);
    }
  }

  return (
    <div className={styles.fieldWrapper}>
      <div className={styles.field}>
        {/* Field markings */}
        <div className={styles.centerCircle} />
        <div className={styles.penaltyLeft} />
        <div className={styles.penaltyRight} />
        <div className={styles.goalLeft} />
        <div className={styles.goalRight} />

        {prepareMode && (enteringIds.size > 0 || leavingIds.size > 0) && (
          <div className={styles.prepareBanner}>
            {enteringIds.size > 0 && (
              <span className={styles.prepareBannerEntering}>
                {enteringIds.size} entra{enteringIds.size > 1 ? "n" : ""}
              </span>
            )}
            {leavingIds.size > 0 && (
              <span className={styles.prepareBannerLeaving}>
                {leavingIds.size} sale{leavingIds.size > 1 ? "n" : ""}
              </span>
            )}
          </div>
        )}

        {slotDefs.map((def) => {
          const playerId = activeSlots[def.slotIndex] ?? null;
          const player = playerId ? (playersById[playerId] ?? null) : null;
          const minutes = playerId !== null ? (playerMinutes[playerId] ?? 0) : undefined;
          const entering = playerId !== null && enteringIds.has(playerId);
          const leaving = playerId !== null && leavingIds.has(playerId);

          return (
            <SimulationPlayerSlot
              key={def.slotIndex}
              slotIndex={def.slotIndex}
              label={def.label}
              x={def.x}
              y={def.y}
              player={player}
              minuteTag={minutes}
              entering={entering}
              leaving={leaving}
              prepareMode={prepareMode}
                slotIdPrefix={slotIdPrefix}
              hasGoals={playerId !== null && scorerIds?.has(playerId)}
            />
          );
        })}
      </div>
    </div>
  );
}
