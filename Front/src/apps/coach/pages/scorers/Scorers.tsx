import { useEffect, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import MatchGoalsCard from "./components/MatchGoalsCard";
import ScorersRanking from "./components/ScorersRanking";
import ScorersRoundSelector from "./components/ScorersRoundSelector";
import useLeagueScorers from "./hooks/useLeagueScorers";
import { refreshLeagueActas, type RefreshLeagueActasResponse } from "../../services/leagueScorersService";
import styles from "./Scorers.module.css";

function notify(message: string, severity: "success" | "warning" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function describe(result: RefreshLeagueActasResponse) {
  if (result.requested === 0) return { message: "No hay actas pendientes que descargar.", severity: "success" as const };
  if (result.failed === 0) {
    const stored = result.stored === 1 ? "Se ha guardado 1 acta." : `Se han guardado ${result.stored} actas.`;
    return { message: stored, severity: "success" as const };
  }
  const stored = result.stored === 1 ? "Se ha guardado 1 acta" : `Se han guardado ${result.stored} actas`;
  const failed = result.failed === 1 ? "1 no ha podido descargarse" : `${result.failed} no han podido descargarse`;
  return { message: `${stored} y ${failed}.`, severity: "warning" as const };
}

export default function Scorers() {
  useAuditPageAccess("Scorers");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();

  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const [round, setRound] = useState<number | undefined>(undefined);
  const { data, loading, error, reload } = useLeagueScorers(hasCompetition ? team?.id : undefined, round);

  useEffect(() => {
    setRound(undefined);
  }, [team?.id]);

  const [refreshing, setRefreshing] = useState(false);
  const hasPending = data?.matches.some((match) => match.pendingActa) ?? false;

  async function handleRefresh() {
    if (!team?.id || !data) return;
    setRefreshing(true);
    try {
      const { message, severity } = describe(await refreshLeagueActas(team.id, data.round));
      notify(message, severity);
      reload();
    } catch {
      notify("No se han podido descargar las actas.", "error");
    } finally {
      setRefreshing(false);
    }
  }

  const goalsInRound = data?.matches.reduce((total, match) => total + match.goals.length, 0) ?? 0;

  function renderContent() {
    if (teamLoading || (loading && !data)) {
      return (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      );
    }
    if (!team) return <EmptyState description="Selecciona un equipo para ver los goleadores." />;
    if (!hasCompetition) return <TeamCompetitionMissing team={team} />;
    if (error) {
      return (
        <div className={styles.center}>
          <EmptyState description="No se han podido cargar los goleadores." />
          <Button variant="outlined" size="small" onClick={reload}>
            Reintentar
          </Button>
        </div>
      );
    }
    if (!data || data.rounds.length === 0) {
      return <EmptyState description="Todavía no hay jornadas guardadas para esta liga." />;
    }

    return (
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <ScorersRoundSelector rounds={data.rounds} selected={data.round} onSelect={setRound} />
          {hasPending && (
            <Button variant="outlined" size="small" disabled={refreshing} onClick={handleRefresh}>
              {refreshing ? "Descargando actas…" : "Actualizar actas"}
            </Button>
          )}
        </div>
        <div className={styles.layout}>
          <aside className={styles.aside}>
            <ScorersRanking scorers={data.scorers} round={data.round} />
          </aside>
          <section className={styles.main}>
            <h2 className={styles.heading}>{`Goles de la jornada ${data.round} · ${goalsInRound}`}</h2>
            {data.matches.map((match) => (
              <MatchGoalsCard key={match.recordCode} match={match} />
            ))}
          </section>
        </div>
      </div>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Goleadores"
        subtitle={teamTitleNode}
        actionBar={
          <Button startIcon={<ArrowBackIcon />} onClick={() => goToTeamDashboard()} variant="outlined" size="small">
            Volver
          </Button>
        }
      >
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
