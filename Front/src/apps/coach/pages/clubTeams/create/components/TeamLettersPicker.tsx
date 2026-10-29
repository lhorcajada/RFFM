import React from "react";
import { LETTERS, buildTeamName, lettersRange } from "../teamBatch";
import styles from "./TeamLettersPicker.module.css";

type TeamLettersPickerProps = {
  categoryName: string;
  existing: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

const SHORTCUTS: { label: string; count: number }[] = [
  { label: "A–D", count: 4 },
  { label: "A–H", count: 8 },
  { label: "A–Z", count: 26 },
];

export default function TeamLettersPicker({
  categoryName,
  existing,
  selected,
  onChange,
}: TeamLettersPickerProps) {
  const toggle = (letter: string) =>
    onChange(selected.includes(letter) ? selected.filter((l) => l !== letter) : [...selected, letter]);

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.texts}>
          <span className={styles.title}>Letras de los equipos</span>
          <span className={styles.hint}>
            Elige de la A a la Z. Los que ya existen no se vuelven a crear.
          </span>
        </div>
        <div className={styles.shortcuts}>
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={styles.shortcut}
              onClick={() => onChange(lettersRange(s.count, existing))}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.shortcut} ${styles.clear}`}
            onClick={() => onChange([])}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {LETTERS.map((letter) => {
          const exists = existing.includes(letter);
          const isSelected = !exists && selected.includes(letter);
          const name = buildTeamName(categoryName, letter);
          return (
            <button
              key={letter}
              type="button"
              className={`${styles.letter} ${isSelected ? styles.selected : ""}`.trim()}
              disabled={exists}
              aria-pressed={isSelected}
              aria-label={exists ? `${name}, ya existe` : name}
              onClick={() => toggle(letter)}
            >
              {letter}
              {exists && <span className={styles.existsTag}>existe</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
