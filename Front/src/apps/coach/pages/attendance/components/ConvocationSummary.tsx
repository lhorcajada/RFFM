import React from "react";
import styles from "./ConvocationSummary.module.css";

type Props = {
  total: number;
  accepted: number;
  pending: number;
  declined: number;
};

export default function ConvocationSummary({ total, accepted, pending, declined }: Props) {
  const items = [
    { label: "Convocados", value: total, className: "" },
    { label: "Van", value: accepted, className: styles.accepted },
    { label: "Pendientes", value: pending, className: styles.pending },
    { label: "Bajas", value: declined, className: styles.declined },
  ];

  return (
    <section className={styles.summary} aria-label="Resumen de la convocatoria">
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
