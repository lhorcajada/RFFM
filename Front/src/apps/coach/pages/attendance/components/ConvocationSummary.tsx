import React from "react";
import styles from "./ConvocationSummary.module.css";

type Labels = { total: string; accepted: string; pending: string; declined: string };

type Props = {
  total: number;
  accepted: number;
  pending: number;
  declined: number;
  labels?: Labels;
  ariaLabel?: string;
};

const CONVOCATION_LABELS: Labels = {
  total: "Convocados",
  accepted: "Van",
  pending: "Pendientes",
  declined: "Bajas",
};

export default function ConvocationSummary({
  total,
  accepted,
  pending,
  declined,
  labels = CONVOCATION_LABELS,
  ariaLabel = "Resumen de la convocatoria",
}: Props) {
  const items = [
    { label: labels.total, value: total, className: "" },
    { label: labels.accepted, value: accepted, className: styles.accepted },
    { label: labels.pending, value: pending, className: styles.pending },
    { label: labels.declined, value: declined, className: styles.declined },
  ];

  return (
    <section className={styles.summary} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.label} className={styles.item}>
            <span className={`${styles.value} ${item.className}`}>{item.value}</span>
            <span className={styles.label}>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
