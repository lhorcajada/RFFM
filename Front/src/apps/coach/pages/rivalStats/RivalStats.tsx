import { Link, useLocation } from "react-router-dom";
import { Alert, Button, CircularProgress, LinearProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InsightsIcon from "@mui/icons-material/Insights";
import RefreshIcon from "@mui/icons-material/Refresh";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useRivalStats from "../../hooks/useRivalStats";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import type { RivalStats as RivalStatsData } from "../../services/rivalStatsService";
import RivalTeamCard from "./components/RivalTeamCard";
import styles from "./RivalStats.module.css";

function formatDateTime(raw: string | null): string {
  if (!raw) return "";
  const date = new Date(raw);
  return isNaN(date.getTime()) ? "" : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(raw: string): string {
  return new Date(raw).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function notify(message: string, severity: "success" | "error" | "info") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function failedPlayersLabel(count: number): string {
  return count === 1
    ? "No se pudo obtener la ficha de 1 jugador; se conservan sus datos anteriores."
    : `No se pudo obtener la ficha de ${count} jugadores; se conservan sus datos anteriores.`;
}

export default function RivalStats() {
  useAuditPageAccess("RivalStats");
  const goToTeamDashboard = useTeamDashboardBack();
  const { search } = useLocation();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();

  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const { stats, loading, error, requesting, generate, refresh } = useRivalStats(
    hasCompetition ? team?.id : undefined,
  );

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      notify("Estamos recopilando las estadísticas. Te avisaremos con una notificación cuando estén listas.", "info");
    } catch {
      notify("No se han podido solicitar las estadísticas.", "error");
    }
  };

  function renderStats(current: RivalStatsData) {
    const inProgress = current.status === "Pending" || current.status === "Running";
    const mustWaitToRefresh =
      current.nextRefreshAllowedAt !== null && new Date(current.nextRefreshAllowedAt).getTime() > Date.now();
    const lastUpdate = formatDateTime(current.completedAt);
    const totalPlayers = current.teams.reduce((sum, t) => sum + t.playerCount, 0);
    const progress = current.totalPlayers > 0 ? (current.processedPlayers / current.totalPlayers) * 100 : undefined;

    return (
      <>
        {inProgress && (
          <div className={styles.progress} role="status">
            <span>
              {current.totalPlayers > 0
                ? `Generando estadísticas: ${current.processedPlayers} de ${current.totalPlayers} jugadores`
                : "Preparando la generación de estadísticas…"}
            </span>
            <LinearProgress
              variant={progress === undefined ? "indeterminate" : "determinate"}
              value={progress}
              aria-label="Progreso de la generación"
            />
          </div>
        )}

        {current.status === "Failed" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => run(refresh)} disabled={requesting}>
                Reintentar
              </Button>
            }
          >
            {current.errorMessage || "No se han podido generar las estadísticas."}
          </Alert>
        )}

        {current.status === "Completed" && (
          <div className={styles.toolbar}>
            <div className={styles.totals} role="group" aria-label="Resumen de la liga">
              <div className={styles.total}>
                <span className={styles.totalValue}>{current.teams.length}</span>
                <span className={styles.totalLabel}>Equipos</span>
              </div>
              <div className={styles.total}>
                <span className={styles.totalValue}>{totalPlayers}</span>
                <span className={styles.totalLabel}>Jugadores</span>
              </div>
            </div>
            <div className={styles.toolbarInfo}>
              {lastUpdate && <span className={styles.lastUpdate}>Última actualización: {lastUpdate}</span>}
              {mustWaitToRefresh && (
                <span className={styles.hint}>
                  Podrás actualizar a partir de las {formatTime(current.nextRefreshAllowedAt as string)}.
                </span>
              )}
            </div>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => run(refresh)}
              disabled={requesting || mustWaitToRefresh}
              className={styles.refresh}
            >
              Actualizar
            </Button>
          </div>
        )}

        {current.status === "Completed" && current.failedPlayers > 0 && (
          <Alert severity="warning">{failedPlayersLabel(current.failedPlayers)}</Alert>
        )}

        {team && !current.ownTeamCode && current.teams.length > 0 && (
          <Alert
            severity="info"
            action={
              team.canEdit ? (
                <Button
                  component={Link}
                  to={`/coach/clubs/${team.club.id}/teams/${team.id}/edit`}
                  color="inherit"
                  size="small"
                >
                  Elegir mi equipo
                </Button>
              ) : undefined
            }
          >
            Elige tu equipo RFFM en la edición del equipo para distinguirlo de sus rivales.
          </Alert>
        )}

        <div className={styles.teams}>
          {team && current.teams.map((t) => <RivalTeamCard key={t.teamCode} teamId={team.id} team={t} />)}
        </div>
      </>
    );
  }

  function renderContent() {
    if (teamLoading || loading) {
      return (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      );
    }
    if (!team) {
      return <EmptyState description="Selecciona un equipo para ver las estadísticas de sus rivales." />;
    }
    if (!hasCompetition) {
      return <TeamCompetitionMissing team={team} />;
    }
    if (error) {
      return <Alert severity="error">No se han podido cargar las estadísticas de la liga.</Alert>;
    }
    if (!stats) {
      return (
        <div className={styles.emptyState}>
          <EmptyState description="Todavía no se han generado las estadísticas de las plantillas de tu liga. La primera vez tarda entre 10 y 15 minutos." />
          <Button variant="contained" onClick={() => run(generate)} disabled={requesting}>
            Generar estadísticas
          </Button>
        </div>
      );
    }
    return <div className={styles.content}>{renderStats(stats)}</div>;
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Estadísticas de rivales"
        subtitle={teamTitleNode}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            {hasCompetition && (
              <Button
                component={Link}
                to={{ pathname: "/coach/rival-stats/simulation", search }}
                startIcon={<InsightsIcon />}
                variant="contained"
                size="small"
              >
                Simulación
              </Button>
            )}
            <Button startIcon={<ArrowBackIcon />} onClick={() => goToTeamDashboard()} variant="outlined" size="small">
              Volver
            </Button>
          </Stack>
        }
      >
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
