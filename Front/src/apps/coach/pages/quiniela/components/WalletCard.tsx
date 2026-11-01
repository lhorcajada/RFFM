import { formatMoney } from "../quinielaHelpers";
import styles from "./WalletCard.module.css";

type Props = {
  balance: number;
  onShowMovements: () => void;
  onDonate?: () => void;
};

export default function WalletCard({ balance, onShowMovements, onDonate }: Props) {
  return (
    <section className={styles.card} aria-labelledby="quiniela-wallet-title">
      <div className={styles.info}>
        <h2 id="quiniela-wallet-title" className={styles.title}>Mi monedero</h2>
        <strong className={styles.balance}>{formatMoney(balance)}</strong>
      </div>
      <div className={styles.actions}>
        {onDonate && (
          <button type="button" className={styles.action} onClick={onDonate} disabled={balance <= 0}>
            Donar al equipo
          </button>
        )}
        <button type="button" className={styles.action} onClick={onShowMovements}>
          Ver movimientos
        </button>
      </div>
    </section>
  );
}
