import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { useFeatureFlag } from "../../../../shared/hooks/useFeatureFlag";
import { FEATURE_FLAGS } from "../../../../shared/services/featureFlagsService";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { deleteMyQuinielaTicket, getCurrentQuiniela, openQuiniela, saveQuinielaTicket } from "../../services/quinielaService";
import type { QuinielaCurrent, QuinielaSign, QuinielaTicket } from "../../services/quinielaService";
import { apiErrorMessage, formatKickoff, goalsFromLabel, goalsToLabel } from "./quinielaHelpers";
import MatchPickCard from "./components/MatchPickCard";
import PlenoCard from "./components/PlenoCard";
import PoolSummary from "./components/PoolSummary";
import PreviousResultCard from "./components/PreviousResultCard";
import QuinielaRulesDialog from "./components/QuinielaRulesDialog";
import TicketSummary from "./components/TicketSummary";
import TicketTabs, { NEW_TICKET } from "./components/TicketTabs";
import { currentUserId, markQuinielaSeen } from "../team-dashboard/utils/quinielaNovelty";
import styles from "./Quiniela.module.css";

type Picks = Record<string, QuinielaSign>;

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function picksFromTicket(ticket: QuinielaTicket | null): Picks {
  return Object.fromEntries((ticket?.picks ?? []).map((pick) => [pick.recordCode, pick.sign]));
}

export default function Quiniela() {
  useAuditPageAccess("Quiniela");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team } = useTeamAndClub();
  const navigate = useNavigate();
  const teamId = team?.id ?? null;
  const { enabled: multipleTickets } = useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets);

  const [current, setCurrent] = useState<QuinielaCurrent | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picks, setPicks] = useState<Picks>({});
  const [plenoHome, setPlenoHome] = useState<string | null>(null);
  const [plenoAway, setPlenoAway] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(NEW_TICKET);

  const selectTicket = useCallback((ticket: QuinielaTicket | null) => {
    setSelectedId(ticket?.id ?? NEW_TICKET);
    setPicks(picksFromTicket(ticket));
    setPlenoHome(ticket ? goalsToLabel(ticket.plenoHome) : null);
    setPlenoAway(ticket ? goalsToLabel(ticket.plenoAway) : null);
  }, []);

  const applyCurrent = useCallback(
    (data: QuinielaCurrent) => {
      setCurrent(data);
      selectTicket(data.myTickets[0] ?? null);
    },
    [selectTicket],
  );

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        applyCurrent(await getCurrentQuiniela(id));
      } catch (e: unknown) {
        notify(apiErrorMessage(e, "No se pudo cargar la quiniela."), "error");
      } finally {
        setLoading(false);
      }
    },
    [applyCurrent],
  );

  useEffect(() => {
    if (teamId) markQuinielaSeen(currentUserId(), teamId);
  }, [teamId]);

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId, load]);

  const jornada = current?.jornada ?? null;
  const myTickets = useMemo(() => current?.myTickets ?? [], [current]);
  const selectedTicket = myTickets.find((t) => t.id === selectedId) ?? null;
  const matches = useMemo(() => current?.matches ?? [], [current]);
  const validMatches = useMemo(() => matches.filter((m) => m.isValid), [matches]);
  const hasPleno = validMatches.some((m) => m.isPleno);
  const closed = jornada?.picksClosed ?? false;

  const total = validMatches.length + (hasPleno ? 1 : 0);
  const pickedCount = validMatches.filter((m) => picks[m.recordCode]).length;
  const filled = pickedCount + (hasPleno && plenoHome !== null && plenoAway !== null ? 1 : 0);
  const canSave = total > 0 && filled === total;

  const handleSelectTicket = (ticketId: string) =>
    selectTicket(ticketId === NEW_TICKET ? null : (myTickets.find((t) => t.id === ticketId) ?? null));

  const setSign = (recordCode: string, sign: QuinielaSign) => setPicks((prev) => ({ ...prev, [recordCode]: sign }));

  const handleSave = async () => {
    if (!teamId || !jornada || !canSave) return;
    setSaving(true);
    try {
      const ticket = await saveQuinielaTicket(
        teamId,
        jornada.id,
        {
          picks: validMatches.map((m) => ({ recordCode: m.recordCode, sign: picks[m.recordCode] })),
          plenoHome: goalsFromLabel(plenoHome ?? "0"),
          plenoAway: goalsFromLabel(plenoAway ?? "0"),
        },
        selectedTicket?.id,
      );
      setCurrent((prev) =>
        prev
          ? {
              ...prev,
              myTickets: [...prev.myTickets.filter((t) => t.id !== ticket.id), ticket].sort((a, b) => a.number - b.number),
            }
          : prev,
      );
      setSelectedId(ticket.id);
      notify("Boleto guardado", "success");
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo guardar el boleto."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = async () => {
    if (!teamId) return;
    setOpening(true);
    try {
      await openQuiniela(teamId);
      await load(teamId);
      notify("Quiniela abierta", "success");
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo abrir la quiniela."), "error");
    } finally {
      setOpening(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!teamId || !jornada || !selectedTicket) return;
    setDeleting(true);
    try {
      await deleteMyQuinielaTicket(teamId, jornada.id, selectedTicket.id);
      setDeleteOpen(false);
      await load(teamId);
      notify("Boleto eliminado", "success");
    } catch (e: unknown) {
      setDeleteOpen(false);
      notify(apiErrorMessage(e, "No se pudo eliminar el boleto."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const renderNotOpen = (data: QuinielaCurrent) => (
    <Stack spacing={2} alignItems="center" className={styles.empty}>
      <EmptyState
        title="La quiniela aún no está abierta"
        description={
          data.canManage
            ? "Ábrela para que los jugadores, familiares y tú podáis rellenar el boleto de la próxima jornada."
            : "Cuando el entrenador la abra podrás rellenar tu boleto aquí."
        }
      />
      {data.canManage && (
        <Button variant="contained" onClick={() => void handleOpen()} disabled={opening}>
          Abrir quiniela
        </Button>
      )}
      {data.previous && (
        <Box className={styles.previousAlone}>
          <PreviousResultCard previous={data.previous} />
        </Box>
      )}
    </Stack>
  );

  const renderOpen = (data: QuinielaCurrent) => {
    if (!jornada) return null;
    return (
      <div className={styles.layout}>
        <div className={styles.notices}>
          <div className={`${styles.notice} ${closed ? styles.noticeClosed : ""}`}>
            <strong>{closed ? "Pronósticos cerrados" : "Pronósticos abiertos"}</strong>
            <span>
              {closed
                ? "Ya ha empezado el primer partido: no se puede modificar el boleto."
                : `Se cierran el ${formatKickoff(jornada.firstKickoffUtc)}, al empezar el primer partido.`}
            </span>
          </div>
          {jornada.paymentDeadlineUtc && (
            <div className={`${styles.notice} ${styles.noticePayment}`}>
              <strong>Paga antes del viernes</strong>
              <span>
                Tienes hasta el {formatKickoff(jornada.paymentDeadlineUtc)}. Si no pagas, tu boleto no participa.
              </span>
            </div>
          )}
        </div>

        {data.pool && (
          <div className={styles.pool}>
            <PoolSummary pool={data.pool} carryIn={jornada.carryIn} />
          </div>
        )}

        <div className={styles.cards}>
          {(myTickets.length > 1 || (multipleTickets && myTickets.length > 0)) && (
            <TicketTabs
              tickets={myTickets}
              selectedId={selectedId}
              canCreate={multipleTickets && !closed}
              onSelect={handleSelectTicket}
            />
          )}
          <div className={styles.cardsHead}>
            <h2 className={styles.cardsTitle}>Tus pronósticos</h2>
            <span className={styles.legend}>1 = gana local · X = empate · 2 = gana visitante</span>
          </div>
          {matches.map((match, index) =>
            match.isValid && match.isPleno ? (
              <PlenoCard
                key={match.recordCode}
                number={index + 1}
                match={match}
                sign={picks[match.recordCode] ?? null}
                plenoHome={plenoHome}
                plenoAway={plenoAway}
                disabled={closed}
                onSignChange={(sign) => setSign(match.recordCode, sign)}
                onHomeGoalsChange={setPlenoHome}
                onAwayGoalsChange={setPlenoAway}
              />
            ) : (
              <MatchPickCard
                key={match.recordCode}
                number={index + 1}
                match={match}
                sign={picks[match.recordCode] ?? null}
                disabled={closed}
                onSignChange={(sign) => setSign(match.recordCode, sign)}
              />
            ),
          )}
        </div>

        <div className={styles.ticket}>
          <TicketSummary
            filled={filled}
            total={total}
            price={jornada.price}
            title={selectedTicket ? `Boleto ${selectedTicket.number}` : myTickets.length > 0 ? "Nuevo boleto" : "Tu boleto"}
            paymentStatus={selectedTicket?.paymentStatus ?? null}
            paymentDeadlineUtc={jornada.paymentDeadlineUtc}
            closed={closed}
            saving={saving}
            canSave={canSave}
            canDelete={selectedTicket !== null && selectedTicket.paymentStatus !== "Paid" && jornada.status === "Open"}
            deleting={deleting}
            onSave={() => void handleSave()}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>

        {data.previous && (
          <div className={styles.previous}>
            <PreviousResultCard previous={data.previous} />
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (!teamId || (loading && !current)) {
      return (
        <Box className={styles.centered}>
          <CircularProgress />
        </Box>
      );
    }
    if (!current) return null;
    return current.isOpen ? renderOpen(current) : renderNotOpen(current);
  };

  const subtitle = jornada ? `${jornada.roundName} · Partidos de liga del grupo` : "Pronostica los partidos de liga de tu grupo";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={jornada ? `Quiniela · Jornada ${jornada.roundNumber}` : "Quiniela"}
        subtitle={subtitle}
        actionBar={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => goToTeamDashboard()} variant="outlined" size="small">
              Volver
            </Button>
            <Button startIcon={<MenuBookOutlinedIcon />} onClick={() => setRulesOpen(true)} variant="outlined" size="small">
              Ver reglas
            </Button>
            {current?.canManage && (
              <Button
                startIcon={<PaymentsOutlinedIcon />}
                onClick={() => navigate(`/coach/quiniela/bolsa${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`)}
                variant="outlined"
                size="small"
              >
                Bolsa y pagos
              </Button>
            )}
          </Stack>
        }
      >
        <div className={styles.content}>{renderContent()}</div>
      </ContentLayout>
      <QuinielaRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar mi boleto"
        description="Se eliminará tu boleto de esta jornada. Podrás rellenar uno nuevo mientras los pronósticos sigan abiertos."
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </BaseLayout>
  );
}
