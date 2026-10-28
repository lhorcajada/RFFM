import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import useAutoRefresh from "../../hooks/useAutoRefresh";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import {
  deleteQuinielaTicket,
  getCurrentQuiniela,
  getQuinielaPayments,
  getQuinielaSettings,
  resetQuiniela,
  setQuinielaTicketPayment,
  settleQuiniela,
  updateQuinielaSettings,
} from "../../services/quinielaService";
import type { QuinielaPaymentMethod, QuinielaPaymentTicket, QuinielaPayments } from "../../services/quinielaService";
import { apiErrorMessage, formatKickoff } from "./quinielaHelpers";
import UserTicketsGroup from "./components/UserTicketsGroup";
import PoolBreakdown from "./components/PoolBreakdown";
import PoolWinners from "./components/PoolWinners";
import PoolSettings from "./components/PoolSettings";
import PoolMovements from "./components/PoolMovements";
import PoolTotals from "./components/PoolTotals";
import styles from "./QuinielaPool.module.css";

type Filter = "all" | "pending" | "paid";
type LoadState = "loading" | "ready" | "forbidden" | "noJornada" | "error";

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

export default function QuinielaPool() {
  useAuditPageAccess("QuinielaPool");
  const { team } = useTeamAndClub();
  const teamId = team?.id ?? null;
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<QuinielaPayments | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuinielaPaymentTicket | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [fundPercent, setFundPercent] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async (id: string) => {
    setState("loading");
    try {
      const current = await getCurrentQuiniela(id);
      if (!current.canManage) {
        setState("forbidden");
        return;
      }
      // Sin jornada abierta se revisa la última liquidada: boletos, ganadores y reparto.
      const reviewedJornadaId = current.jornada?.id ?? current.previous?.jornadaId ?? null;
      if (!reviewedJornadaId) {
        setState("noJornada");
        return;
      }
      const [payments, settings] = await Promise.all([
        getQuinielaPayments(id, reviewedJornadaId),
        getQuinielaSettings(id),
      ]);
      setData(payments);
      setFundPercent(settings.fundPercent);
      setState("ready");
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo cargar la bolsa de la quiniela."), "error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId, load]);

  const refresh = useCallback(async (id: string, jornadaId: string) => {
    setData(await getQuinielaPayments(id, jornadaId));
  }, []);

  const jornadaId = data?.jornada.id ?? null;
  const stateRef = useRef(state);
  stateRef.current = state;
  // Refresco silencioso (boletos nuevos): si falla se conservan los datos que ya se muestran.
  useAutoRefresh(
    () => {
      if (teamId && jornadaId && stateRef.current === "ready") void refresh(teamId, jornadaId).catch(() => undefined);
    },
    undefined,
    state === "ready",
  );

  const jornada = data?.jornada ?? null;
  const tickets = useMemo(() => data?.tickets ?? [], [data]);
  const paidCount = tickets.filter((t) => t.paymentStatus === "Paid").length;
  const pendingCount = tickets.filter((t) => t.paymentStatus === "Pending").length;
  const editable = jornada?.status === "Open";

  const visibleTickets = useMemo(
    () =>
      tickets.filter((t) =>
        filter === "all" ? true : filter === "paid" ? t.paymentStatus === "Paid" : t.paymentStatus === "Pending",
      ),
    [tickets, filter],
  );

  const ticketGroups = useMemo(() => {
    const byUser = new Map<string, QuinielaPaymentTicket[]>();
    for (const ticket of visibleTickets) byUser.set(ticket.userId, [...(byUser.get(ticket.userId) ?? []), ticket]);
    return [...byUser.values()].map((group) => [...group].sort((a, b) => a.number - b.number));
  }, [visibleTickets]);

  const changePayment = async (ticketId: string, paid: boolean, method?: QuinielaPaymentMethod) => {
    if (!teamId || !jornada) return;
    setBusyTicketId(ticketId);
    try {
      await setQuinielaTicketPayment(teamId, jornada.id, ticketId, paid ? { paid: true, method } : { paid: false });
      await refresh(teamId, jornada.id);
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo actualizar el pago."), "error");
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleSettle = async () => {
    if (!teamId || !jornada) return;
    setSettling(true);
    try {
      await settleQuiniela(teamId, jornada.id);
      setSettleOpen(false);
      notify("Jornada liquidada y premios repartidos", "success");
      await refresh(teamId, jornada.id);
    } catch (e: unknown) {
      setSettleOpen(false);
      notify(apiErrorMessage(e, "No se pudo liquidar la jornada."), "error");
    } finally {
      setSettling(false);
    }
  };

  const quinielaPath = `/coach/quiniela${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;

  const handleDeleteConfirmed = async () => {
    if (!teamId || !jornada || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuinielaTicket(teamId, jornada.id, deleteTarget.id);
      setDeleteTarget(null);
      notify("Boleto eliminado", "success");
      await refresh(teamId, jornada.id);
    } catch (e: unknown) {
      setDeleteTarget(null);
      notify(apiErrorMessage(e, "No se pudo eliminar el boleto."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveSettings = async (percent: number) => {
    if (!teamId || !jornada) return;
    setSavingSettings(true);
    try {
      const saved = await updateQuinielaSettings(teamId, percent);
      setFundPercent(saved.fundPercent);
      notify("Reparto guardado", "success");
      await refresh(teamId, jornada.id);
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo guardar el reparto."), "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetConfirmed = async () => {
    if (!teamId || !jornada) return;
    setResetting(true);
    try {
      await resetQuiniela(teamId, jornada.id);
      setResetOpen(false);
      notify("Jornada reiniciada", "success");
      navigate(quinielaPath);
    } catch (e: unknown) {
      setResetOpen(false);
      notify(apiErrorMessage(e, "No se pudo reiniciar la jornada."), "error");
    } finally {
      setResetting(false);
    }
  };

  if (state === "forbidden") return <Navigate to={quinielaPath} replace />;

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: `Todos (${tickets.length})` },
    { key: "pending", label: `Pendientes (${pendingCount})` },
    { key: "paid", label: `Pagados (${paidCount})` },
  ];

  const renderReady = (payments: QuinielaPayments) => (
    <div className={styles.layout}>
      <div className={styles.totals}>
        <PoolTotals totals={payments.totals} paidCount={paidCount} pendingCount={pendingCount} />
      </div>

      <div className={styles.tickets}>
        <div className={styles.ticketsHead}>
          <h2 className={styles.ticketsTitle}>Boletos por participante</h2>
          <div className={styles.filters}>
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                className={`${styles.filter} ${filter === f.key ? styles.filterSelected : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {visibleTickets.length === 0 ? (
          <p className={styles.emptyList}>No hay boletos en este filtro.</p>
        ) : (
          ticketGroups.map((group) => (
            <UserTicketsGroup
              key={group[0].userId}
              tickets={group}
              price={payments.jornada.price}
              matches={payments.matches}
              editable={editable}
              busyTicketId={busyTicketId}
              onPay={(ticketId, method) => void changePayment(ticketId, true, method)}
              onUndo={(ticketId) => void changePayment(ticketId, false)}
              onDelete={(ticket) => setDeleteTarget(ticket)}
            />
          ))
        )}
      </div>

      <div className={styles.side}>
        {!editable && <PoolWinners tickets={tickets} carryOut={payments.totals.carryOut} />}
        <PoolBreakdown totals={payments.totals} />
        <PoolSettings fundPercent={fundPercent} saving={savingSettings} onSave={(p) => void handleSaveSettings(p)} />
        {editable && pendingCount > 0 && (
          <div className={styles.notice}>
            <strong>Boletos sin pagar</strong>
            <span>
              {pendingCount} {pendingCount === 1 ? "boleto pendiente" : "boletos pendientes"}: si siguen sin pagar al
              terminar el plazo se anulan y no entran en el reparto.
            </span>
          </div>
        )}
        {!editable && (
          <div className={`${styles.notice} ${styles.settled}`}>
            <strong>Jornada liquidada</strong>
            <span>Los premios ya se han repartido y la parte del fondo está en la bolsa del equipo.</span>
          </div>
        )}
        <PoolMovements movements={payments.movements} />
      </div>
    </div>
  );

  const renderContent = () => {
    if (!teamId || state === "loading") {
      return (
        <Box className={styles.centered}>
          <CircularProgress />
        </Box>
      );
    }
    if (state === "error") return <EmptyState title="No se pudo cargar la bolsa de la quiniela" />;
    if (state === "noJornada") {
      return <EmptyState title="No hay ninguna jornada abierta" description="Abre la quiniela para gestionar la bolsa y los pagos." />;
    }
    return data ? renderReady(data) : null;
  };

  const subtitle = jornada
    ? `${jornada.roundName} · Plazo de pago: ${formatKickoff(jornada.paymentDeadlineUtc)}`
    : "Cobros, premios y fondo de la jornada";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Bolsa y pagos"
        subtitle={subtitle}
        actionBar={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(quinielaPath)} variant="outlined" size="small">
              Volver
            </Button>
            {state === "ready" && editable && (
              <Button variant="outlined" color="error" size="small" onClick={() => setResetOpen(true)}>
                Reiniciar jornada
              </Button>
            )}
            {state === "ready" && editable && (
              <Button variant="contained" size="small" className={styles.settleButton} onClick={() => setSettleOpen(true)}>
                Cerrar jornada y repartir
              </Button>
            )}
          </Stack>
        }
      >
        <div className={styles.content}>{renderContent()}</div>
      </ContentLayout>
      <ConfirmDialog
        open={settleOpen}
        title="Cerrar jornada y repartir"
        description="Se calcularán los aciertos, se repartirán los premios y la parte del fondo pasará a la bolsa del equipo. Esta acción no se puede deshacer."
        confirmText="Repartir"
        processing={settling}
        onCancel={() => setSettleOpen(false)}
        onConfirm={() => void handleSettle()}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar boleto"
        description={`Se eliminará el boleto ${deleteTarget?.number ?? ""} de ${deleteTarget?.userName ?? ""}${
          deleteTarget?.paymentStatus === "Paid" ? " y se descontará lo cobrado de la bolsa" : ""
        }. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirmed()}
      />
      <ConfirmDialog
        open={resetOpen}
        title="Reiniciar jornada"
        description="Se eliminarán todos los boletos y la jornada abierta, y podrás abrir la quiniela de nuevo desde cero. Esta acción no se puede deshacer."
        confirmText="Reiniciar"
        processing={resetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => void handleResetConfirmed()}
      />
    </BaseLayout>
  );
}
