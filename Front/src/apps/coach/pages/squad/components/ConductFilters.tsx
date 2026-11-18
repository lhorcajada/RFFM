import type { ChangeEvent } from "react";
import type { TraitTrend } from "../../../types/traitRating";
import type { EffectiveTrait } from "../rating/ratingCatalog";
import { EMPTY_CONDUCT_FILTERS, hasActiveConductFilters, type ConductFilters as Filters } from "../utils/conductFilter";
import styles from "./ConductFilters.module.css";

type Props = {
  traits: EffectiveTrait[];
  filters: Filters;
  onChange: (filters: Filters) => void;
};

const LEVELS = [1, 2, 3, 4, 5];

const TRENDS: { value: TraitTrend; label: string }[] = [
  { value: "up", label: "Subiendo" },
  { value: "same", label: "Igual" },
  { value: "down", label: "Bajando" },
];

export default function ConductFilters({ traits, filters, onChange }: Props) {
  const traitSelected = filters.traitKey !== null;

  function changeTrait(event: ChangeEvent<HTMLSelectElement>) {
    onChange({ ...filters, traitKey: event.target.value || null });
  }

  function changeMin(event: ChangeEvent<HTMLSelectElement>) {
    const minLevel = Number(event.target.value);
    onChange({ ...filters, minLevel, maxLevel: Math.max(filters.maxLevel, minLevel) });
  }

  function changeMax(event: ChangeEvent<HTMLSelectElement>) {
    const maxLevel = Number(event.target.value);
    onChange({ ...filters, maxLevel, minLevel: Math.min(filters.minLevel, maxLevel) });
  }

  return (
    <section className={styles.container} aria-label="Filtros de conducta">
      <span className={styles.title}>Conducta</span>

      <label className={styles.field}>
        <span className={styles.label}>Rasgo</span>
        <select className={styles.select} value={filters.traitKey ?? ""} onChange={changeTrait}>
          <option value="">Todos</option>
          {traits.map((trait) => (
            <option key={trait.key} value={trait.key}>
              {trait.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Nivel mín.</span>
        <select className={styles.select} value={filters.minLevel} disabled={!traitSelected} onChange={changeMin}>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Nivel máx.</span>
        <select className={styles.select} value={filters.maxLevel} disabled={!traitSelected} onChange={changeMax}>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.chips} role="group" aria-label="Tendencia">
        {TRENDS.map(({ value, label }) => {
          const active = filters.trend === value;
          return (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${active ? styles.chipActive : ""}`}
              aria-pressed={active}
              onClick={() => onChange({ ...filters, trend: active ? null : value })}
            >
              {label}
            </button>
          );
        })}
      </div>

      {hasActiveConductFilters(filters) && (
        <button type="button" className={styles.clear} onClick={() => onChange(EMPTY_CONDUCT_FILTERS)}>
          Quitar filtros
        </button>
      )}
    </section>
  );
}
