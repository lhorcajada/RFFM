import Jersey from "../../../../../federation/components/players/Jersey/Jersey";
import type { ClubKit } from "../../../services/kitService";
import styles from "./KitSelector.module.css";

type Props = {
  kits: ClubKit[];
  selectedKitNumber: number | null;
  onSelect: (kitNumber: number | null) => void;
  disabled?: boolean;
};

export default function KitSelector({ kits, selectedKitNumber, onSelect, disabled }: Props) {
  if (kits.length === 0) return null;

  const handleClick = (kitNumber: number) => {
    if (disabled) return;
    // Click on the already-selected kit → deselect
    onSelect(kitNumber === selectedKitNumber ? null : kitNumber);
  };

  return (
    <div className={styles.root} aria-label="Seleccionar equipación">
      {kits.map((kit) => {
        const isSelected = kit.kitNumber === selectedKitNumber;
        return (
          <button
            key={kit.kitNumber}
            type="button"
            className={`${styles.kitBtn} ${isSelected ? styles.selected : ""}`}
            onClick={() => handleClick(kit.kitNumber)}
            disabled={disabled}
            title={`${kit.kitNumber === 1 ? "Primera" : "Segunda"} equipación`}
            aria-pressed={isSelected}
          >
            <Jersey primary={kit.shirtColor} size={32} />
            <span className={styles.kitLabel}>{kit.kitNumber === 1 ? "1ª" : "2ª"}</span>
          </button>
        );
      })}
    </div>
  );
}
