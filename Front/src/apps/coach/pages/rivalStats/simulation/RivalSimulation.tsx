import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress, FormControlLabel, Stack, Switch, Tab, Tabs } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useRivalSimulation from "../../../hooks/useRivalSimulation";
import useTeamAndClub from "../../../hooks/useTeamAndClub.tsx";
import type { MatchPrediction, RivalSimulation as RivalSimulationData } from "../../../services/rivalStatsService";
import MatchPredictionCard from "./components/MatchPredictionCard";
import ProjectedStandingCard from "./components/ProjectedStandingCard";
import styles from "./RivalSimulation.module.css";

type SimulationTab = "matches" | "standings";

function roundTitle(round: number, date: string | null): string {
  if (!date) return `Jornada ${round}`;
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? `Jornada ${round}` : `Jornada ${round} · ${parsed.toLocaleDateString("es-ES")}`;
}

function groupByRound(matches: MatchPrediction[]): { round: number; date: string | null; matches: MatchPrediction[] }[] {
  const groups = new Map<number, MatchPrediction[]>();
  for (const match of matches) groups.set(match.round, [...(groups.get(match.round) ?? []), match]);
  return [...groups.entries()].map(([round, roundMatches]) => ({
    round,
    date: roundMatches.find((m) => m.date)?.date ?? null,
    matches: roundMatches,
  }));
}

export default function RivalSimulation() {
  useAuditPageAccess("RivalSimulation");
  const navigate = useNavigate();
  const { search } = useLocation();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();

  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const { simulation, loading, error } = useRivalSimulation(hasCompetition ? team?.id : undefined);

  const [tab, setTab] = useState<SimulationTab>("matches");
  const [onlyOwnTeam, setOnlyOwnTeam] = useState(true);

  const ownTeamCode = simulation?.ownTeamCode ?? null;
  const visibleRounds = useMemo(() => {
    if (!simulation) return [];
    const filterByOwnTeam = onlyOwnTeam && ownTeamCode !== null;
    const matches = filterByOwnTeam
      ? simulation.matches.filter((m) => m.localTeamCode === ownTeamCode || m.visitorTeamCode === ownTeamCode)
      : simulation.matches;
    return groupByRound(matches);
  }, [simulation, onlyOwnTeam, ownTeamCode]);

  function renderMatches() {
    if (visibleRounds.length === 0) {
      return <EmptyState description="No quedan partidos por disputar." />;
    }
    return visibleRounds.map((group) => (
      <section key={group.round} className={styles.round}>
        <h2 className={styles.roundTitle}>{roundTitle(group.round, group.date)}</h2>
        <div className={styles.cards}>
          {group.matches.map((match) => (
            <MatchPredictionCard
              key={`${match.round}-${match.localTeamCode}-${match.visitorTeamCode}`}
              prediction={match}
              ownTeamCode={ownTeamCode}
            />
          ))}
        </div>
      </section>
    ));
  }

  function renderStandings(current: RivalSimulationData) {
    return (
      <div className={styles.cards}>
        {current.standings.map((standing, index) => (
          <ProjectedStandingCard
            key={standing.teamCode}
            standing={standing}
            projectedPosition={index + 1}
            isOwnTeam={standing.teamCode === ownTeamCode}
          />
        ))}
      </div>
    );
  }

  function renderSimulation(current: RivalSimulationData) {
    return (
      <div className={styles.content}>
        <p className={styles.intro}>
          {`Probabilidades orientativas calculadas con ${current.playedMatches} partidos disputados y ${current.iterations.toLocaleString("es-ES")} simulaciones del resto de la temporada.`}
        </p>
        {!current.usesSquadStrength && (
          <Alert severity="info">
            Genera las estadísticas de rivales para tener en cuenta las plantillas; ahora solo se usan los resultados.
          </Alert>
        )}
        <Tabs value={tab} onChange={(_, value: SimulationTab) => setTab(value)} variant="fullWidth">
          <Tab label="Partidos" value="matches" id="simulation-tab-matches" aria-controls="simulation-panel" />
          <Tab label="Clasificación" value="standings" id="simulation-tab-standings" aria-controls="simulation-panel" />
        </Tabs>
        <div role="tabpanel" id="simulation-panel" aria-labelledby={`simulation-tab-${tab}`} className={styles.panel}>
          {tab === "matches" && (
            <>
              {ownTeamCode !== null && (
                <FormControlLabel
                  control={<Switch checked={onlyOwnTeam} onChange={(e) => setOnlyOwnTeam(e.target.checked)} />}
                  label="Solo mi equipo"
                />
              )}
              {renderMatches()}
            </>
          )}
          {tab === "standings" && renderStandings(current)}
        </div>
      </div>
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
      return <EmptyState description="Selecciona un equipo para ver la simulación de su liga." />;
    }
    if (!hasCompetition) {
      return <TeamCompetitionMissing team={team} />;
    }
    if (error || !simulation) {
      return <Alert severity="error">No se ha podido calcular la simulación de la liga.</Alert>;
    }
    return renderSimulation(simulation);
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Simulación"
        subtitle={teamTitleNode}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/coach/rival-stats${search}`)}
              variant="outlined"
              size="small"
            >
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
