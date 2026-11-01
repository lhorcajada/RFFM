import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { QUINIELA_WALLET_UPDATED_EVENT } from "../../../../shared/hooks/useQuinielaWalletBalance";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useWalletMovements from "../../hooks/useWalletMovements";
import { donateFromQuinielaWallet, getMyQuinielaWallet } from "../../services/quinielaService";
import { apiErrorMessage, formatMoney } from "./quinielaHelpers";
import WalletCard from "./components/WalletCard";
import WalletDonateDialog from "./components/WalletDonateDialog";
import WalletMovementsList from "./components/WalletMovementsList";
import styles from "./MyWallet.module.css";

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

export default function MyWallet() {
  useAuditPageAccess("QuinielaMyWallet");
  const { team } = useTeamAndClub();
  const teamId = team?.id ?? null;
  const navigate = useNavigate();

  const [donateOpen, setDonateOpen] = useState(false);
  const [donating, setDonating] = useState(false);

  const { movements, balance, loading, failed, isEmpty, hasMore, reload, loadMore } = useWalletMovements(
    (limit, offset) => (teamId ? getMyQuinielaWallet(teamId, { limit, offset }) : Promise.reject(new Error("Sin equipo"))),
    teamId !== null,
  );

  const quinielaPath = `/coach/quiniela${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;

  const handleDonate = async (amount: number) => {
    if (!teamId) return;
    setDonating(true);
    try {
      await donateFromQuinielaWallet(teamId, amount);
      setDonateOpen(false);
      window.dispatchEvent(new CustomEvent(QUINIELA_WALLET_UPDATED_EVENT));
      notify(`¡Gracias! Has donado ${formatMoney(amount)} al equipo.`, "success");
      void reload();
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo hacer la donación."), "error");
    } finally {
      setDonating(false);
    }
  };

  const renderContent = () => {
    if (balance === null && failed) return <EmptyState title="No se pudo cargar el monedero" />;
    if (balance === null) {
      return (
        <Box className={styles.centered}>
          <CircularProgress />
        </Box>
      );
    }
    return (
      <>
        <WalletCard balance={balance} onDonate={() => setDonateOpen(true)} />
        <section className={styles.history} aria-labelledby="my-wallet-history">
          <h2 id="my-wallet-history" className={styles.historyTitle}>Movimientos</h2>
          <WalletMovementsList
            movements={movements}
            loading={loading}
            failed={failed}
            isEmpty={isEmpty}
            hasMore={hasMore}
            onLoadMore={() => void loadMore()}
          />
        </section>
      </>
    );
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Mi monedero"
        subtitle="Tu saldo para pagar boletos de la quiniela"
        actionBar={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(quinielaPath)} variant="outlined" size="small">
            Volver
          </Button>
        }
      >
        <div className={styles.content}>{renderContent()}</div>
      </ContentLayout>
      <WalletDonateDialog
        open={donateOpen}
        balance={balance ?? 0}
        processing={donating}
        onCancel={() => setDonateOpen(false)}
        onSubmit={(amount) => void handleDonate(amount)}
      />
    </BaseLayout>
  );
}
