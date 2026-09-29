import { Button, CircularProgress, Stack, Tab, Tabs } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import RoundPanel from "../../../../shared/components/ui/RoundPanel/RoundPanel";
import useCalendar from "../../../../shared/hooks/useCalendar";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import MatchResultNotificationsToggle from "./components/MatchResultNotificationsToggle";
import styles from "./Results.module.css";

export default function Results() {
  useAuditPageAccess("Results");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();
  const { seasonId, currentSeasonId } = useRffmSeason();

  const season = String(currentSeasonId ?? seasonId ?? "");
  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const canLoad = hasCompetition && season !== "";

  const { calendar, loading, selectedTab, setSelectedTab, rounds, matchesByRound } =
    useCalendar({
      season,
      competition: canLoad ? String(team?.rffmCompetitionId) : undefined,
      group: canLoad ? String(team?.rffmGroupId) : undefined,
    });

  const selectedRoundNumber = rounds[selectedTab]?.matchDayNumber;
  const selectedMatches = (() => {
    if (!selectedRoundNumber || selectedRoundNumber <= 0) return [];
    const cached = matchesByRound[selectedRoundNumber];
    if (cached) return cached;
    if (calendar?.round === selectedRoundNumber) {
      return calendar.matchDay?.matches || [];
    }
    return [];
  })();

  const competitionHeader = calendar ? (
    <div className={styles.competitionHeader}>
      <span className={styles.competitionName}>{calendar.competitionName}</span>
      <span className={styles.groupName}>{calendar.groupName}</span>
    </div>
  ) : (
    teamTitleNode
  );

  function renderContent() {
    if (teamLoading || (loading && !calendar)) {
      return (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      );
    }
    if (!team) {
      return <EmptyState description="Selecciona un equipo para ver sus resultados." />;
    }
    if (!hasCompetition) {
      return <TeamCompetitionMissing team={team} />;
    }
    if (!calendar) {
      return <EmptyState description="No se ha podido cargar el calendario de la competición." />;
    }
    if (rounds.length === 0) {
      return <EmptyState description="No hay jornadas disponibles para la competición del equipo." />;
    }
    return (
      <>
        <div className={styles.tabsWrap}>
          <Tabs
            value={selectedTab}
            onChange={(_, v) => setSelectedTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {rounds.map((r, i) => (
              <Tab key={r.matchDayNumber || i} label={`Jornada ${r.matchDayNumber}`} />
            ))}
          </Tabs>
        </div>
        <div className={styles.tabPanel}>
          {loading ? (
            <div className={styles.center}>
              <CircularProgress />
            </div>
          ) : selectedMatches.length === 0 ? (
            <EmptyState description="No hay partidos para esta jornada." />
          ) : (
            <RoundPanel
              round={{ jornada: selectedRoundNumber, equipos: selectedMatches }}
              hideActaButton
            />
          )}
        </div>
      </>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Resultados"
        subtitle={competitionHeader}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </Stack>
        }
      >
        <MatchResultNotificationsToggle />
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
