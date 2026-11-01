import { Button, CircularProgress } from "@mui/material";
import type { QuinielaWalletMovement } from "../../../services/quinielaService";
import { formatKickoff, signedMoney, walletMovementLabel } from "../quinielaHelpers";
import styles from "./WalletMovementsList.module.css";

type Props = {
  movements: QuinielaWalletMovement[];
  loading: boolean;
  failed: boolean;
  isEmpty: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

export default function WalletMovementsList({ movements, loading, failed, isEmpty, hasMore, onLoadMore }: Props) {
  return (
    <>
      {failed && <p className={styles.message}>No se pudo cargar el historial.</p>}
      {isEmpty && <p className={styles.message}>Aún no hay movimientos.</p>}
      <ul className={styles.list}>
        {movements.map((movement) => (
          <li key={movement.id} className={styles.item}>
            <div className={styles.text}>
              <strong>{walletMovementLabel(movement.type)}</strong>
              {movement.description && <span className={styles.description}>{movement.description}</span>}
              <span className={styles.date}>{formatKickoff(movement.occurredAt)}</span>
            </div>
            <strong className={movement.amount < 0 ? styles.negative : styles.positive}>{signedMoney(movement.amount)}</strong>
          </li>
        ))}
      </ul>
      {loading && (
        <div className={styles.loading}>
          <CircularProgress size={24} />
        </div>
      )}
      {hasMore && !loading && (
        <Button fullWidth variant="outlined" className={styles.more} onClick={onLoadMore}>
          Cargar más
        </Button>
      )}
    </>
  );
}
