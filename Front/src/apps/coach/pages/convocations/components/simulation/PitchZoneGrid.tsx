import styles from "./PitchZoneGrid.module.css";

const COLUMNS = 5;
const ROWS = 10;

interface PitchZoneGridProps {
  value: { col: number; row: number } | null;
  onChange: (cell: { col: number; row: number }) => void;
}

/**
 * A football pitch divided into 5 (width) × 10 (length, both halves) zones, used to record
 * where a goal was scored from. The team attacks upwards: row 0 is the rival's goal line.
 * Cells carry no identifying label per requirements.
 */
export default function PitchZoneGrid({ value, onChange }: PitchZoneGridProps) {
  return (
    <div className={styles.root}>
      <span className={styles.goalLabel}>Portería rival</span>
      <div className={styles.pitch} role="group" aria-label="Zona del campo">
        <div className={styles.markings} aria-hidden="true">
          <div className={styles.halfwayLine} />
          <div className={styles.centerCircle} />
          <div className={`${styles.penaltyArea} ${styles.top}`} />
          <div className={`${styles.goalArea} ${styles.top}`} />
          <div className={`${styles.penaltyArea} ${styles.bottom}`} />
          <div className={`${styles.goalArea} ${styles.bottom}`} />
        </div>
        {Array.from({ length: ROWS }).map((_, row) => (
          <div key={row} className={styles.row}>
            {Array.from({ length: COLUMNS }).map((_, col) => {
              const isSelected = value?.col === col && value?.row === row;
              return (
                <button
                  key={col}
                  type="button"
                  aria-pressed={isSelected}
                  className={`${styles.cell} ${isSelected ? styles.cellSelected : ""}`}
                  onClick={() => onChange({ col, row })}
                />
              );
            })}
          </div>
        ))}
      </div>
      <span className={styles.goalLabel}>Nuestra portería</span>
    </div>
  );
}
