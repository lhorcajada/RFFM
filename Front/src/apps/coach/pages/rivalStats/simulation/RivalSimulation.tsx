import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import { useAuditPageAccess } from "../../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useRivalSimulation from "../../../hooks/useRivalSimulation";
import useTeamAndClub from "../../../hooks/useTeamAndClub.tsx";
import type {
  MatchPrediction,
  ProjectedStanding,
  RivalSimulation as RivalSimulationData,
  RivalSimulationHistory,
  RoundMatch,
  RoundSimulation,
  RoundStatus,
} from "../../../services/rivalStatsService";
import MatchPredictionCard from "./components/MatchPredictionCard";
import ProjectedStandingCard from "./components/ProjectedStandingCard";
import { formatPercent } from "./simulationFormat";
import styles from "./RivalSimulation.module.css";

type SimulationTab = "matches" | "standings";

const UPCOMING_VIEW = "upcoming";
const CURRENT_PROJECTION = "current";

const ROUND_STATUS_SUFFIX: Record<RoundStatus, string> = {
  Played: " · jugada",
  InProgress: " · en juego",
  Upcoming: "",
};

function roundTitle(round: number, date: string | null): string {
  if (!date) return `Jornada ${round}`;
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? `Jornada ${round}` : `Jornada ${round} · ${parsed.toLocaleDateString("es-ES")}`;
}

function groupByRound<T extends MatchPrediction>(matches: T[]): { round: number; date: string | null; matches: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const match of matches) groups.set(match.round, [...(groups.get(match.round) ?? []), match]);
  return [...groups.entries()].map(([round, roundMatches]) => ({
    round,
    date: roundMatches.find((m) => m.date)?.date ?? null,
    matches: roundMatches,
  }));
}

function involvesTeam(match: MatchPrediction, teamCode: string): boolean {
  return match.localTeamCode === teamCode || match.visitorTeamCode === teamCode;
}

function matchKey(match: MatchPrediction): string {
  return `${match.round}-${match.localTeamCode}-${match.visitorTeamCode}`;
}

function matchResult(match: RoundMatch) {
  const hasResult = match.actualLocalGoals !== null && match.actualVisitorGoals !== null && match.hit !== null;
  return hasResult
    ? { localGoals: match.actualLocalGoals as number, visitorGoals: match.actualVisitorGoals as number, hit: match.hit as boolean }
    : undefined;
}

export default function RivalSimulation() {
  useAuditPageAccess("RivalSimulation");
  const navigate = useNavigate();
  const { search } = useLocation();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();

  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const { simulation, history, loading, error } = useRivalSimulation(hasCompetition ? team?.id : undefined);

  const [tab, setTab] = useState<SimulationTab>("matches");
  const [onlyOwnTeam, setOnlyOwnTeam] = useState(true);
  const [view, setView] = useState<string>(UPCOMING_VIEW);
  const [projection, setProjection] = useState<string>(CURRENT_PROJECTION);

  const ownTeamCode = simulation?.ownTeamCode ?? null;
  const savedRounds: RoundSimulation[] = history?.rounds ?? [];
  const selectedRound = savedRounds.find((r) => String(r.round) === view) ?? null;
  const selectedProjection = savedRounds.find((r) => String(r.round) === projection) ?? null;
  const filterByOwnTeam = onlyOwnTeam && ownTeamCode !== null;

  const upcomingRounds = useMemo(() => {
    if (!simulation) return [];
    const matches = filterByOwnTeam
      ? simulation.matches.filter((m) => involvesTeam(m, ownTeamCode as string))
      : simulation.matches;
    return groupByRound(matches);
  }, [simulation, filterByOwnTeam, ownTeamCode]);

  const selectedRoundMatches = useMemo(() => {
    if (!selectedRound) return [];
    return filterByOwnTeam
      ? selectedRound.matches.filter((m) => involvesTeam(m, ownTeamCode as string))
      : selectedRound.matches;
  }, [selectedRound, filterByOwnTeam, ownTeamCode]);

  function renderUpcoming() {
    if (upcomingRounds.length === 0) {
      return <EmptyState description="No quedan partidos por disputar." />;
    }
    return upcomingRounds.map((group) => (
      <section key={group.round} className={styles.round}>
        <h2 className={styles.roundTitle}>{roundTitle(group.round, group.date)}</h2>
        <div className={styles.cards}>
          {group.matches.map((match) => (
            <MatchPredictionCard key={matchKey(match)} prediction={match} ownTeamCode={ownTeamCode} />
          ))}
        </div>
      </section>
    ));
  }

  function renderSavedRound(round: RoundSimulation) {
    return (
      <section className={styles.round}>
        <h2 className={styles.roundTitle}>{roundTitle(round.round, round.date)}</h2>
        <p className={styles.intro}>
          {`Predicción calculada${round.isBackfilled ? " a posteriori" : ""} con ${round.playedMatchesUsed} partidos disputados antes de esta jornada.`}
        </p>
        {round.evaluated > 0 && (
          <p className={styles.summary}>{`Aciertos en la jornada: ${round.hits} de ${round.evaluated}`}</p>
        )}
        {selectedRoundMatches.length === 0 ? (
          <EmptyState description="Tu equipo no juega en esta jornada." />
        ) : (
          <div className={styles.cards}>
            {selectedRoundMatches.map((match) => (
              <MatchPredictionCard
                key={matchKey(match)}
                prediction={match}
                ownTeamCode={ownTeamCode}
                result={matchResult(match)}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderStandings(standings: (ProjectedStanding & { actualPosition?: number | null })[]) {
    return (
      <div className={styles.cards}>
        {standings.map((standing, index) => (
          <ProjectedStandingCard
            key={standing.teamCode}
            standing={standing}
            projectedPosition={index + 1}
            isOwnTeam={standing.teamCode === ownTeamCode}
            actualPosition={standing.actualPosition}
          />
        ))}
      </div>
    );
  }

  function renderTotalHits(saved: RivalSimulationHistory | null) {
    if (!saved || saved.totalEvaluated === 0) return null;
    return (
      <p className={styles.summary}>
        {`Aciertos totales: ${saved.totalHits} de ${saved.totalEvaluated} (${formatPercent(saved.totalHits / saved.totalEvaluated)})`}
      </p>
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
              {renderTotalHits(history)}
              <div className={styles.controls}>
                <FormControl size="small" className={styles.selector}>
                  <InputLabel id="simulation-view-label">Ver</InputLabel>
                  <Select
                    labelId="simulation-view-label"
                    label="Ver"
                    value={selectedRound ? view : UPCOMING_VIEW}
                    onChange={(e) => setView(e.target.value)}
                  >
                    <MenuItem value={UPCOMING_VIEW}>Próximos partidos</MenuItem>
                    {savedRounds.map((r) => (
                      <MenuItem key={r.round} value={String(r.round)}>
                        {`Jornada ${r.round}${ROUND_STATUS_SUFFIX[r.status]}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {ownTeamCode !== null && (
                  <FormControlLabel
                    control={<Switch checked={onlyOwnTeam} onChange={(e) => setOnlyOwnTeam(e.target.checked)} />}
                    label="Solo mi equipo"
                  />
                )}
              </div>
              {selectedRound ? renderSavedRound(selectedRound) : renderUpcoming()}
            </>
          )}
          {tab === "standings" && (
            <>
              {savedRounds.length > 0 && (
                <FormControl size="small" className={styles.selector}>
                  <InputLabel id="simulation-projection-label">Proyección</InputLabel>
                  <Select
                    labelId="simulation-projection-label"
                    label="Proyección"
                    value={selectedProjection ? projection : CURRENT_PROJECTION}
                    onChange={(e) => setProjection(e.target.value)}
                  >
                    <MenuItem value={CURRENT_PROJECTION}>Actual</MenuItem>
                    {savedRounds.map((r) => (
                      <MenuItem key={r.round} value={String(r.round)}>{`Antes de la jornada ${r.round}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {renderStandings(selectedProjection ? selectedProjection.standings : current.standings)}
            </>
          )}
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
