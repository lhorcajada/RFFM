import { LINE_WIDTH_OPTIONS } from "../constants";
import styles from "./LineWidthPicker.module.css";

interface LineWidthPickerProps {
  value: number;
  color: string;
  onChange: (width: number) => void;
}

export default function LineWidthPicker({ value, color, onChange }: LineWidthPickerProps) {
  return (
    <div className={styles.picker} role="group" aria-label="Grosor de línea">
      {LINE_WIDTH_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.key}
            type="button"
            className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option.value);
            }}
            title={option.label}
            aria-label={`Grosor ${option.label.toLowerCase()}`}
            aria-pressed={isActive}
          >
            <svg viewBox="0 0 24 12" className={styles.preview} aria-hidden="true">
              <line
                x1="3"
                y1="6"
                x2="21"
                y2="6"
                stroke={color}
                strokeWidth={option.value}
                strokeLinecap="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
