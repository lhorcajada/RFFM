import type { QuinielaPrevious } from "../../../services/quinielaService";
import { categoryLabel, formatMoney } from "../quinielaHelpers";
import styles from "./PreviousResultCard.module.css";

type Props = {
  previous: QuinielaPrevious;
};

export default function PreviousResultCard({ previous }: Props) {
  const mine = categoryLabel(previous.myCategory);
  return (
    <section className={styles.card} aria-labelledby="quiniela-previous-title">
      <h2 id="quiniela-previous-title" className={styles.label}>Jornada {previous.roundNumber} · Resultado</h2>
      {previous.myHits === null ? (
        <p className={styles.detail}>No participaste en esta jornada.</p>
      ) : (
        <div className={styles.row}>
          <span className={styles.strong}>{mine ?? "Sin premio"}</span>
          <span className={styles.detail}>
            {previous.myHits} aciertos{previous.myPrize ? ` · ${formatMoney(previous.myPrize)}` : ""}
          </span>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.strong}>Bote</span>
        <span className={styles.detail}>{formatMoney(previous.carryOut)} pasan de bote a esta jornada</span>
      </div>
    </section>
  );
}
