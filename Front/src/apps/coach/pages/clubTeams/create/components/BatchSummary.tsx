import React from "react";
import TeamCrest from "../../../../components/TeamCrest/TeamCrest";
import styles from "./BatchSummary.module.css";

type BatchSummaryProps = {
  names: string[];
  existingCount: number;
  processing: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

function buildLabel(count: number, processing: boolean): string {
  if (processing) return "Creando...";
  if (count === 0) return "Crear equipos";
  return count === 1 ? "Crear 1 equipo" : `Crear ${count} equipos`;
}

export default function BatchSummary({
  names,
  existingCount,
  processing,
  onSubmit,
  onCancel,
}: BatchSummaryProps) {
  const count = names.length;
  return (
    <aside className={styles.summary} aria-labelledby="batch-summary-title">
      <h2 id="batch-summary-title" className={styles.title}>
        Resumen
      </h2>

      <div className={styles.counters}>
        <div className={styles.counter}>
          <span className={`${styles.number} ${styles.create}`}>{count}</span>
          <span className={styles.caption}>se crearán</span>
        </div>
        <div className={styles.counter}>
          <span className={`${styles.number} ${styles.existing}`}>{existingCount}</span>
          <span className={styles.caption}>ya existen</span>
        </div>
      </div>

      {count > 0 ? (
        <ul className={styles.list}>
          {names.map((name) => (
            <li key={name} className={styles.item}>
              <TeamCrest className={styles.itemCrest} />
              <span className={styles.itemName}>{name}</span>
              <span className={styles.badge}>Nuevo</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          Selecciona al menos una letra para ver los equipos que se crearán.
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          disabled={count === 0 || processing}
          onClick={onSubmit}
        >
          {buildLabel(count, processing)}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={processing}>
          Cancelar
        </button>
      </div>
    </aside>
  );
}
