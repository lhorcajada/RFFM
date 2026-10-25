import type { StatusLabel } from "../utils/eventDisplay";
import styles from "./StatusChip.module.css";

export default function StatusChip({ label }: { label: StatusLabel }) {
  return <span className={`${styles.chip} ${styles[label.tone]}`}>{label.text}</span>;
}
