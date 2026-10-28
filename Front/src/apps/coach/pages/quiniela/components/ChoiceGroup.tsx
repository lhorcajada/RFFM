import styles from "./ChoiceGroup.module.css";

export type ChoiceOption = {
  value: string;
  label: string;
  caption?: string;
  ariaLabel?: string;
};

type Props = {
  ariaLabel: string;
  options: ChoiceOption[];
  value: string | null;
  disabled?: boolean;
  large?: boolean;
  onChange: (value: string) => void;
};

export default function ChoiceGroup({ ariaLabel, options, value, disabled = false, large = false, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`${styles.group} ${options.length === 4 ? styles.four : styles.three}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.ariaLabel}
            disabled={disabled}
            className={`${styles.choice} ${large ? styles.large : ""} ${selected ? styles.selected : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.key}>{option.label}</span>
            {option.caption && <span className={styles.caption}>{option.caption}</span>}
          </button>
        );
      })}
    </div>
  );
}
