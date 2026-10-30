import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { getCurrentQuiniela, getQuinielaHistory } from "../../services/quinielaService";
import type { QuinielaCurrent, QuinielaHistoryItem } from "../../services/quinielaService";
import { categoryLabel, formatKickoff, formatMoney, ticketOwnerLabel } from "./quinielaHelpers";
import styles from "./QuinielaHistory.module.css";

const PAGE_SIZE = 10;

type LoadState = "loading" | "ready" | "error";

type CurrentAction = { text: string; note: string };

function currentAction(current: QuinielaCurrent): CurrentAction {
  const tickets = current.myTickets.length;
  const plural = tickets > 1;
  if (current.jornada?.picksClosed) {
    return {
      text: tickets > 0 ? (plural ? "Ver mis boletos" : "Ver mi boleto") : "Ver quiniela",
      note: tickets > 0 ? "Pronósticos cerrados" : "Pronósticos cerrados · no participas en esta jornada",
    };
  }
  const closing = formatKickoff(current.jornada?.firstKickoffUtc);
  if (tickets === 0) return { text: "Rellenar mi boleto", note: `Pronósticos abiertos · cierran ${closing}` };
  return { text: plural ? "Editar mis boletos" : "Editar mi boleto", note: `Pronósticos abiertos · cierran ${closing}` };
}

function CurrentCard({ current, quinielaHref }: { current: QuinielaCurrent; quinielaHref: string }) {
  const jornada = current.isOpen ? current.jornada : null;
  if (!jornada) {
    return (
      <section aria-label="Quiniela actual" className={styles.current}>
        <h2 className={styles.title}>La próxima quiniela aún no está abierta</h2>
        <p className={styles.note}>
          {current.canManage
            ? "Ábrela para que el equipo pueda rellenar el boleto de la próxima jornada."
            : "Cuando se abra podrás rellenar tu boleto aquí."}
        </p>
        {current.canManage && (
          <Link to={quinielaHref} className={styles.cta}>
            Abrir quiniela
          </Link>
        )}
      </section>
    );
  }

  const action = currentAction(current);
  return (
    <section aria-label="Quiniela actual" className={styles.current}>
      <div className={styles.topRow}>
        <h2 className={styles.title}>Jornada {jornada.roundNumber}</h2>
        <span className={styles.badge}>En juego</span>
      </div>
      <p className={styles.note}>{action.note}</p>
      <div className={styles.facts}>
        <span className={styles.factLabel}>Bote</span>
        <strong className={styles.factValue}>{formatMoney(jornada.carryIn)}</strong>
      </div>
      <Link to={quinielaHref} className={styles.cta}>
        {action.text}
      </Link>
    </section>
  );
}

function JornadaCard({ item }: { item: QuinielaHistoryItem }) {
  const myPrize = item.myPrize ?? 0;
  return (
    <section aria-label={`Jornada ${item.roundNumber}`} className={styles.card}>
      <div className={styles.topRow}>
        <h3 className={styles.title}>Jornada {item.roundNumber}</h3>
        <span className={styles.date}>{formatKickoff(item.settledAt)}</span>
      </div>
      <div className={styles.summary}>
        <span>
          Recaudado <strong>{formatMoney(item.collected)}</strong>
        </span>
        <span>
          Bolsa <strong>{formatMoney(item.prizePool)}</strong>
        </span>
        <span>
          Bote <strong>{formatMoney(item.carryOut)}</strong>
        </span>
      </div>
      {myPrize > 0 && (
        <p className={styles.mine}>
          Tu premio: <strong>{formatMoney(myPrize)}</strong>
          {categoryLabel(item.myCategory) ? ` · ${categoryLabel(item.myCategory)}` : ""}
          {item.myHits !== null ? ` · ${item.myHits} aciertos` : ""}
        </p>
      )}
      {item.winners.length === 0 ? (
        <p className={styles.note}>
          Sin acertantes en esta jornada.
          {item.carryOut > 0 ? ` El bote de ${formatMoney(item.carryOut)} pasó a la siguiente.` : ""}
        </p>
      ) : (
        <ul className={styles.winners}>
          {item.winners.map((winner, index) => (
            <li
              key={`${winner.userName}-${winner.ticketNumber}-${index}`}
              className={winner.isMine ? styles.winnerMine : styles.winner}
              data-mine={winner.isMine ? "true" : undefined}
            >
              <span className={styles.who}>
                <span className={styles.name}>{ticketOwnerLabel(winner.userName, winner.ticketNumber)}</span>
                <span className={styles.detail}>
                  {categoryLabel(winner.category)} · {winner.hits} aciertos
                </span>
              </span>
              <span className={styles.prize}>{formatMoney(winner.prize)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function QuinielaHistory() {
  useAuditPageAccess("QuinielaHistory");
  const { team } = useTeamAndClub();
  const teamId = team?.id ?? null;
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("loading");
  const [current, setCurrent] = useState<QuinielaCurrent | null>(null);
  const [items, setItems] = useState<QuinielaHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (id: string) => {
    setState("loading");
    try {
      const [currentData, page] = await Promise.all([
        getCurrentQuiniela(id),
        getQuinielaHistory(id, { limit: PAGE_SIZE, offset: 0 }),
      ]);
      setCurrent(currentData);
      setItems(page.items);
      setTotal(page.total);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId, load]);

  const handleLoadMore = async () => {
    if (!teamId) return;
    setLoadingMore(true);
    try {
      const page = await getQuinielaHistory(teamId, { limit: PAGE_SIZE, offset: items.length });
      setItems((prev) => [...prev, ...page.items]);
      setTotal(page.total);
    } catch {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", { detail: { message: "No se pudieron cargar más jornadas.", severity: "error" } }),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const quinielaHref = `${COACH_FEATURE_ROUTES.Quiniela}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;

  const renderContent = () => {
    if (!teamId || state === "loading") {
      return (
        <Box className={styles.centered}>
          <CircularProgress />
        </Box>
      );
    }
    if (state === "error" || !current) {
      return (
        <Stack spacing={2} alignItems="center">
          <EmptyState title="No se pudo cargar el histórico de quinielas" />
          <Button variant="contained" onClick={() => void load(teamId)}>
            Reintentar
          </Button>
        </Stack>
      );
    }
    return (
      <div className={styles.stack}>
        <CurrentCard current={current} quinielaHref={quinielaHref} />
        {items.length === 0 ? (
          <EmptyState title="Aún no hay quinielas liquidadas" description="Cuando acabe una jornada verás aquí sus resultados y premios." />
        ) : (
          <div className={styles.stack}>
            {items.map((item) => (
              <JornadaCard key={item.jornadaId} item={item} />
            ))}
            {items.length < total && (
              <Button variant="outlined" onClick={() => void handleLoadMore()} disabled={loadingMore} className={styles.more}>
                Cargar más
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Histórico de quinielas"
        subtitle="Resultados y premios de las jornadas anteriores"
        actionBar={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(quinielaHref)} variant="outlined" size="small">
              Volver
            </Button>
          </Stack>
        }
      >
        <div className={styles.content}>{renderContent()}</div>
      </ContentLayout>
    </BaseLayout>
  );
}
