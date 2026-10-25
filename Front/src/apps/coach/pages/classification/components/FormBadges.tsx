import type { FormResult } from "../standings";
import styles from "./FormBadges.module.css";

const RESULT_LABEL: Record<FormResult, string> = {
  G: "Ganado",
  E: "Empatado",
  P: "Perdido",
};

type FormBadgesProps = {
  form: FormResult[];
  size?: "small" | "medium";
};

export default function FormBadges({ form, size = "medium" }: FormBadgesProps) {
  return (
    <span className={styles.form}>
      {form.map((result, index) => (
        <span
          key={index}
          title={RESULT_LABEL[result]}
          className={`${styles.badge} ${styles[result]} ${size === "small" ? styles.small : ""}`}
        >
          {result}
        </span>
      ))}
    </span>
  );
}
