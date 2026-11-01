import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import type { QuinielaWallet } from "../../../services/quinielaService";
import useWalletMovements from "../../../hooks/useWalletMovements";
import WalletMovementsList from "./WalletMovementsList";

type Props = {
  open: boolean;
  title: string;
  fetchPage: (limit: number, offset: number) => Promise<QuinielaWallet>;
  onClose: () => void;
};

export default function WalletMovementsDialog({ open, title, fetchPage, onClose }: Props) {
  const { movements, loading, failed, isEmpty, hasMore, loadMore } = useWalletMovements(fetchPage, open);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper" aria-labelledby="wallet-movements-title">
      <DialogTitle id="wallet-movements-title">{title}</DialogTitle>
      <DialogContent dividers>
        <WalletMovementsList
          movements={movements}
          loading={loading}
          failed={failed}
          isEmpty={isEmpty}
          hasMore={hasMore}
          onLoadMore={() => void loadMore()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
