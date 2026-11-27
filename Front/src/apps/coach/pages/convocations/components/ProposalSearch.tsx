import { DEFAULT_CRITERIA, isSearching, type ProposalSearchCriteria, type ProposalSort } from "../utils/proposalSearch";
import styles from "./ProposalSearch.module.css";

type Props = {
  criteria: ProposalSearchCriteria;
  onChange: (criteria: ProposalSearchCriteria) => void;
};

const TOGGLES = [
  { key: "neverOut", label: "Nunca desconvocados" },
  { key: "noTechnical", label: "Sin decisión técnica" },
] as const;

const SORT_LABELS: Record<ProposalSort, string> = {
  order: "Orden de la propuesta",
  fewest: "Menos desconvocatorias",
  longestNoTechnical: "Más jornadas sin técnica",
};

/** Search, quick filters and sort of the players of the proposal. */
export default function ProposalSearch({ criteria, onChange }: Props) {
  return (
    <div className={styles.search} role="search" aria-label="Buscar en la propuesta">
      <input
        type="text"
        className={styles.input}
        aria-label="Buscar jugador"
        placeholder="Buscar jugador"
        value={criteria.text}
        onChange={(event) => onChange({ ...criteria, text: event.target.value })}
      />
      <div className={styles.controls}>
        {TOGGLES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`${styles.toggle} ${criteria[key] ? styles.toggleOn : ""}`}
            aria-pressed={criteria[key]}
            onClick={() => onChange({ ...criteria, [key]: !criteria[key] })}
          >
            {label}
          </button>
        ))}
        <label className={styles.sort}>
          Ordenar
          <select
            className={styles.select}
            value={criteria.sort}
            onChange={(event) => onChange({ ...criteria, sort: event.target.value as ProposalSort })}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {isSearching(criteria) && (
          <button type="button" className={styles.clear} onClick={() => onChange(DEFAULT_CRITERIA)}>
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
