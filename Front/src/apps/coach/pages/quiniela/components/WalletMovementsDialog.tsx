import { useCallback, useEffect, useRef, useState } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import type { QuinielaWallet, QuinielaWalletMovement } from "../../../services/quinielaService";
import { formatKickoff, signedMoney, walletMovementLabel } from "../quinielaHelpers";
import styles from "./WalletMovementsDialog.module.css";

const PAGE_SIZE = 25;

type Props = {
  open: boolean;
  title: string;
  fetchPage: (limit: number, offset: number) => Promise<QuinielaWallet>;
  onClose: () => void;
};

export default function WalletMovementsDialog({ open, title, fetchPage, onClose }: Props) {
  const [movements, setMovements] = useState<QuinielaWalletMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const loadPage = useCallback(async (offset: number) => {
    setLoading(true);
    setFailed(false);
    try {
      const wallet = await fetchRef.current(PAGE_SIZE, offset);
      setTotal(wallet.totalMovements);
      setMovements((prev) => (offset === 0 ? wallet.movements : [...prev, ...wallet.movements]));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMovements([]);
    setTotal(0);
    void loadPage(0);
  }, [open, loadPage]);

  const hasMore = movements.length < total;
  const isEmpty = !loading && !failed && movements.length === 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper" aria-labelledby="wallet-movements-title">
      <DialogTitle id="wallet-movements-title">{title}</DialogTitle>
      <DialogContent dividers>
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
          <Button fullWidth variant="outlined" className={styles.more} onClick={() => void loadPage(movements.length)}>
            Cargar más
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
