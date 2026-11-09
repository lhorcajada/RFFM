import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import resolveUserTeamId from "../../../../shared/hooks/resolveUserTeamId";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import { getTeamTransactions } from "../../services/transactionService";
import type {
  TeamTransaction,
  TransactionFilters,
  TransactionStatus,
  TransactionType,
} from "../../services/transactionService";
import TransactionCard from "./components/TransactionCard";
import styles from "./Transactions.module.css";

type StatusFilter = TransactionStatus | "all";
type TypeFilter = TransactionType | "all";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "Pending", label: "Pendientes" },
  { value: "Paid", label: "Pagadas" },
];

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "Sanction", label: "Sanciones" },
  { value: "Lottery", label: "Lotería" },
  { value: "Quiniela", label: "Quiniela" },
  { value: "WalletTopUp", label: "Recargas" },
  { value: "WalletCharge", label: "Cargos" },
];

function Spinner() {
  return (
    <div className={styles.loading}>
      <CircularProgress size={32} />
    </div>
  );
}

function buildFilters(status: StatusFilter, type: TypeFilter): TransactionFilters {
  const filters: TransactionFilters = {};
  if (status !== "all") filters.status = status;
  if (type !== "all") filters.type = type;
  return filters;
}

export default function Transactions() {
  const goBack = useTeamDashboardBack();
  const [searchParams] = useSearchParams();
  const teamIdFromUrl = searchParams.get("teamId") || null;

  // undefined while the fallback team is being resolved, null when the user has none.
  const [resolvedTeamId, setResolvedTeamId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (teamIdFromUrl) return;
    let active = true;
    void resolveUserTeamId().then((teamId) => {
      if (active) setResolvedTeamId(teamId);
    });
    return () => {
      active = false;
    };
  }, [teamIdFromUrl]);
  const teamId = teamIdFromUrl ?? resolvedTeamId;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [transactions, setTransactions] = useState<TeamTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    getTeamTransactions(teamId, buildFilters(statusFilter, typeFilter))
      .then((rows) => {
        if (active) setTransactions(rows);
      })
      .catch(() => {
        if (!active) return;
        setTransactions([]);
        setLoadFailed(true);
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: { message: "No se pudieron cargar las transacciones.", severity: "error" },
          })
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId, statusFilter, typeFilter]);

  function renderContent() {
    if (teamId === undefined) {
      return <Spinner />;
    }
    if (teamId === null) {
      return (
        <EmptyState
          title="Sin equipo"
          description="Selecciona un equipo para ver sus transacciones."
        />
      );
    }
    if (loading) {
      return <Spinner />;
    }
    if (loadFailed) {
      return (
        <Alert severity="error">
          No se pudieron cargar las transacciones. Inténtalo de nuevo más tarde.
        </Alert>
      );
    }
    if (transactions.length === 0) {
      const filtered = statusFilter !== "all" || typeFilter !== "all";
      return (
        <EmptyState
          title="Sin transacciones"
          description={
            filtered
              ? "No hay transacciones con estos filtros."
              : "No hay transacciones registradas para este equipo."
          }
        />
      );
    }
    return (
      <div className={styles.cardList}>
        {transactions.map((transaction) => (
          <TransactionCard key={transaction.id} transaction={transaction} />
        ))}
      </div>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Transacciones"
        subtitle="Sanciones, lotería, quiniela y monedero del equipo"
        actionBar={
          <Button startIcon={<ArrowBackIcon />} onClick={() => goBack()} variant="outlined" size="small">
            Volver
          </Button>
        }
      >
        <div role="group" aria-label="Filtrar por estado" className={styles.filterGroup}>
          {STATUS_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              aria-pressed={statusFilter === option.value}
              onClick={() => setStatusFilter(option.value)}
              variant={statusFilter === option.value ? "contained" : "outlined"}
              size="small"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="Filtrar por tipo" className={styles.filterGroup}>
          {TYPE_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              aria-pressed={typeFilter === option.value}
              onClick={() => setTypeFilter(option.value)}
              variant={typeFilter === option.value ? "contained" : "outlined"}
              size="small"
            >
              {option.label}
            </Button>
          ))}
        </div>
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
