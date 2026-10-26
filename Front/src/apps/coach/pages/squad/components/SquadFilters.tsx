import SearchIcon from "@mui/icons-material/Search";
import styles from "./SquadFilters.module.css";

type Category = { key: number; label: string; count: number };

type Props = {
  categories: Category[];
  selected: number | null;
  onSelect: (category: number | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
};

export default function SquadFilters({ categories, selected, onSelect, query, onQueryChange }: Props) {
  return (
    <div className={styles.filters}>
      <div className={styles.chips}>
        <button
          type="button"
          className={`${styles.chip} ${selected === null ? styles.chipActive : ""}`}
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          Todos
        </button>
        {categories.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            className={`${styles.chip} ${selected === key ? styles.chipActive : ""}`}
            aria-pressed={selected === key}
            aria-label={label}
            onClick={() => onSelect(key)}
          >
            {label}
            <span className={styles.chipCount}>{count}</span>
          </button>
        ))}
      </div>
      <label className={styles.search}>
        <SearchIcon fontSize="small" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar jugador"
          aria-label="Buscar jugador"
          className={styles.searchInput}
        />
      </label>
    </div>
  );
}
