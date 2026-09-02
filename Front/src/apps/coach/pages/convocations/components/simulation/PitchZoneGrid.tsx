import styles from "./PitchZoneGrid.module.css";

const COLUMNS = 5;
const ROWS = 10;

interface PitchZoneGridProps {
  value: { col: number; row: number } | null;
  onChange: (cell: { col: number; row: number }) => void;
}

/**
 * A 5 (width) × 10 (length, both halves) pitch-cell picker used to record where
 * a goal was scored from. Cells carry no identifying label per requirements.
 */
export default function PitchZoneGrid({ value, onChange }: PitchZoneGridProps) {
  return (
    <div className={styles.root} role="group" aria-label="Zona del campo">
      {Array.from({ length: ROWS }).map((_, row) => (
        <div key={row} className={styles.row}>
          {Array.from({ length: COLUMNS }).map((_, col) => {
            const isSelected = value?.col === col && value?.row === row;
            return (
              <button
                key={col}
                type="button"
                className={`${styles.cell} ${isSelected ? styles.cellSelected : ""}`}
                onClick={() => onChange({ col, row })}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
