import { FORMATION_POSITIONS } from "../../../types/formation";
import type { ReportPlayer } from "../../../services/matchReportService";
import styles from "./LiveReportPitch.module.css";

type Props = {
  formationName: string | null;
  starters: ReportPlayer[];
};

function shortName(name: string): string {
  return name.split(" ").slice(0, 2).join(" ");
}

export default function LiveReportPitch({ formationName, starters }: Props) {
  const slotDefs = formationName ? FORMATION_POSITIONS[formationName] : undefined;
  if (!slotDefs) return null;

  const playerBySlot = new Map(
    starters.filter((p) => p.slotIndex != null).map((p) => [p.slotIndex as number, p]),
  );

  return (
    <div className={styles.fieldWrapper}>
      <div className={styles.field} aria-label={`Campo con la alineación inicial (${formationName})`}>
        <div className={styles.centerCircle} />
        <div className={styles.penaltyLeft} />
        <div className={styles.penaltyRight} />
        {slotDefs.map((def) => {
          const player = playerBySlot.get(def.slotIndex);
          if (!player) return null;
          return (
            <div
              key={def.slotIndex}
              className={styles.slot}
              style={{ left: `${def.x}%`, top: `${def.y}%` }}
            >
              <span className={styles.dorsal}>{player.dorsal ?? def.label}</span>
              <span className={styles.name}>{shortName(player.name)}</span>
              <span className={styles.minutes}>{player.minutesPlayed}'</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
