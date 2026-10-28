import type { QuinielaTotals } from "../../../services/quinielaService";
import { formatMoney } from "../quinielaHelpers";
import styles from "./PoolTotals.module.css";

type Props = {
  totals: QuinielaTotals;
  paidCount: number;
  pendingCount: number;
};

type StatProps = {
  label: string;
  value: string;
  hint: string;
  tone: "paid" | "pending" | "prize" | "plain";
};

function Stat({ label, value, hint, tone }: StatProps) {
  return (
    <div role="group" aria-label={label} className={styles.stat}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${styles[tone]}`}>{value}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}

export default function PoolTotals({ totals, paidCount, pendingCount }: Props) {
  return (
    <div className={styles.grid}>
      <Stat label="Cobrado" value={formatMoney(totals.collected)} hint={`${paidCount} boletos pagados`} tone="paid" />
      <Stat label="Pendiente de cobro" value={formatMoney(totals.pending)} hint={`${pendingCount} boletos sin pagar`} tone="pending" />
      <Stat
        label="Premios de la jornada"
        value={formatMoney(totals.prizePool)}
        hint={`${totals.prizePercent} % de lo cobrado + bote de ${formatMoney(totals.carryIn)}`}
        tone="prize"
      />
      <Stat
        label="Bote acumulado"
        value={formatMoney(totals.carryIn)}
        hint="Viene de jornadas sin ganador"
        tone="prize"
      />
      <Stat
        label="Fondo del equipo"
        value={formatMoney(totals.fundAmount)}
        hint={`${100 - totals.prizePercent} % restante de lo cobrado`}
        tone="plain"
      />
    </div>
  );
}
