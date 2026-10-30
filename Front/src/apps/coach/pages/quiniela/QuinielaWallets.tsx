import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { QUINIELA_WALLET_UPDATED_EVENT } from "../../../../shared/hooks/useQuinielaWalletBalance";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import {
  adjustQuinielaWallet,
  getQuinielaWalletOf,
  getQuinielaWallets,
  topUpQuinielaWallet,
} from "../../services/quinielaService";
import type { QuinielaWalletOperation, QuinielaWalletSummary } from "../../services/quinielaService";
import { apiErrorMessage, formatMoney, initialsOf, roleLabel } from "./quinielaHelpers";
import WalletAmountDialog from "./components/WalletAmountDialog";
import type { WalletAmountMode, WalletAmountSubmit } from "./components/WalletAmountDialog";
import WalletMovementsDialog from "./components/WalletMovementsDialog";
import styles from "./QuinielaWallets.module.css";

type LoadState = "loading" | "ready" | "forbidden" | "error";

type AmountTarget = { user: QuinielaWalletSummary; mode: WalletAmountMode };
type PendingAdjustment = { user: QuinielaWalletSummary; amount: number; reason: string };

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function isForbidden(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { response?: { status?: number } }).response?.status === 403;
}

export default function QuinielaWallets() {
  useAuditPageAccess("QuinielaWallets");
  const { team } = useTeamAndClub();
  const teamId = team?.id ?? null;
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("loading");
  const [wallets, setWallets] = useState<QuinielaWalletSummary[]>([]);
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<PendingAdjustment | null>(null);
  const [processing, setProcessing] = useState(false);
  const [movementsUser, setMovementsUser] = useState<QuinielaWalletSummary | null>(null);

  const load = useCallback(async (id: string) => {
    setState("loading");
    try {
      setWallets(await getQuinielaWallets(id));
      setState("ready");
    } catch (e: unknown) {
      if (isForbidden(e)) {
        setState("forbidden");
        return;
      }
      notify(apiErrorMessage(e, "No se pudieron cargar los monederos."), "error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId, load]);

  const quinielaPath = `/coach/quiniela${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;

  const applyOperation = (operation: QuinielaWalletOperation) => {
    setWallets((prev) => prev.map((w) => (w.userId === operation.userId ? { ...w, balance: operation.balance } : w)));
    window.dispatchEvent(new CustomEvent(QUINIELA_WALLET_UPDATED_EVENT));
  };

  const handleTopUp = async (user: QuinielaWalletSummary, { amount, text }: WalletAmountSubmit) => {
    if (!teamId) return;
    setProcessing(true);
    try {
      applyOperation(await topUpQuinielaWallet(teamId, user.userId, { amount, description: text || undefined }));
      setAmountTarget(null);
      notify(`Recargados ${formatMoney(amount)} a ${user.userName}`, "success");
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo recargar el monedero."), "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleAdjustConfirmed = async () => {
    if (!teamId || !pendingAdjustment) return;
    const { user, amount, reason } = pendingAdjustment;
    setProcessing(true);
    try {
      applyOperation(await adjustQuinielaWallet(teamId, user.userId, { amount, reason }));
      setPendingAdjustment(null);
      setAmountTarget(null);
      notify(`Restados ${formatMoney(amount)} a ${user.userName}`, "success");
    } catch (e: unknown) {
      setPendingAdjustment(null);
      notify(apiErrorMessage(e, "No se pudo restar el saldo."), "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleAmountSubmit = (value: WalletAmountSubmit) => {
    if (!amountTarget) return;
    if (amountTarget.mode === "topUp") void handleTopUp(amountTarget.user, value);
    else setPendingAdjustment({ user: amountTarget.user, amount: value.amount, reason: value.text });
  };

  if (state === "forbidden") return <Navigate to={quinielaPath} replace />;

  const renderContent = () => {
    if (!teamId || state === "loading") {
      return (
        <Box className={styles.centered}>
          <CircularProgress />
        </Box>
      );
    }
    if (state === "error") return <EmptyState title="No se pudieron cargar los monederos" />;
    if (wallets.length === 0) return <EmptyState title="No hay participantes en el equipo" />;
    return (
      <ul className={styles.list}>
        {wallets.map((wallet) => (
          <li key={wallet.userId} className={styles.card} data-testid="wallet-card">
            <div className={styles.head}>
              <span className={styles.avatar} aria-hidden="true">{initialsOf(wallet.userName)}</span>
              <div className={styles.who}>
                <strong className={styles.name}>{wallet.userName}</strong>
                <span className={styles.role}>{roleLabel(wallet.role)}</span>
              </div>
              <strong className={styles.balance}>{formatMoney(wallet.balance)}</strong>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => setAmountTarget({ user: wallet, mode: "topUp" })}>
                Recargar
              </button>
              <button type="button" className={styles.secondary} onClick={() => setAmountTarget({ user: wallet, mode: "adjust" })}>
                Restar saldo
              </button>
              <button type="button" className={styles.secondary} onClick={() => setMovementsUser(wallet)}>
                Movimientos
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Monederos de la quiniela"
        subtitle="Saldo de cada participante para pagar sus boletos"
        actionBar={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(quinielaPath)} variant="outlined" size="small">
              Volver
            </Button>
          </Stack>
        }
      >
        <div className={styles.content}>{renderContent()}</div>
      </ContentLayout>
      <WalletAmountDialog
        open={amountTarget !== null}
        mode={amountTarget?.mode ?? "topUp"}
        userName={amountTarget?.user.userName ?? ""}
        processing={processing}
        onCancel={() => setAmountTarget(null)}
        onSubmit={handleAmountSubmit}
      />
      <ConfirmDialog
        open={pendingAdjustment !== null}
        title="Restar saldo"
        description={`Se restarán ${formatMoney(pendingAdjustment?.amount)} del monedero de ${pendingAdjustment?.user.userName ?? ""}. Motivo: ${pendingAdjustment?.reason ?? ""}. Quedará registrado en su historial.`}
        confirmText="Restar"
        processing={processing}
        onCancel={() => setPendingAdjustment(null)}
        onConfirm={() => void handleAdjustConfirmed()}
      />
      <WalletMovementsDialog
        open={movementsUser !== null}
        title={`Movimientos · ${movementsUser?.userName ?? ""}`}
        fetchPage={(limit, offset) =>
          movementsUser && teamId
            ? getQuinielaWalletOf(teamId, movementsUser.userId, { limit, offset })
            : Promise.reject(new Error("Sin usuario"))
        }
        onClose={() => setMovementsUser(null)}
      />
    </BaseLayout>
  );
}
