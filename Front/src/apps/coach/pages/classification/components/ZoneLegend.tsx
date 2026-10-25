import type { ZoneLegendItem } from "../standings";
import styles from "./ZoneLegend.module.css";

export default function ZoneLegend({ items }: { items: ZoneLegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.legend} aria-label="Zonas de la clasificación">
      {items.map((item) => (
        <li key={item.zone} className={styles.item}>
          <span className={`${styles.swatch} ${styles[item.zone]}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
