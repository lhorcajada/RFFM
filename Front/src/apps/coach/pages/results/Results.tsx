import { useEffect, useState } from "react";
import { Button, CircularProgress, Stack, useMediaQuery, type Theme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import useCalendar from "../../../../shared/hooks/useCalendar";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import useTeamMatchReports from "../../hooks/useTeamMatchReports";
import MatchResultNotificationsToggle from "./components/MatchResultNotificationsToggle";
import OwnMatchCard from "./components/OwnMatchCard";
import RoundMatchList from "./components/RoundMatchList";
import RoundRail, { type RailRound } from "./components/RoundRail";
import SeasonPanel from "./components/SeasonPanel";
import useOwnTeamSeason from "./hooks/useOwnTeamSeason";
import { formatMatchDay, formatShortDay } from "./utils/matchDates";
import { isSuspended, ownOutcome, splitRound, type OwnRoundEntry } from "./utils/ownMatch";
import styles from "./Results.module.css";

export default function Results() {
  useAuditPageAccess("Results");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();
  const { seasonId, currentSeasonId } = useRffmSeason();
  const isDesktop = useMediaQuery((theme: Theme) => theme.breakpoints.up("md"));

  const { byCodActa } = useTeamMatchReports(team?.id);

  const season = String(currentSeasonId ?? seasonId ?? "");
  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const canLoad = hasCompetition && season !== "";
  const competition = canLoad ? String(team?.rffmCompetitionId) : undefined;
  const group = canLoad ? String(team?.rffmGroupId) : undefined;
  const teamCode = team?.rffmTeamCode ? String(team.rffmTeamCode) : null;

  const resolveActaLink = (codacta: string): string | null => {
    if (!team?.id) return null;
    const teamId = encodeURIComponent(team.id);
    const report = byCodActa[codacta];
    if (report) {
      return `/coach/match-report?eventId=${encodeURIComponent(report.eventId)}&teamId=${teamId}`;
    }
    if (!canLoad) return null;
    return (
      `/coach/match-report?codActa=${encodeURIComponent(codacta)}&teamId=${teamId}` +
      `&season=${encodeURIComponent(season)}` +
      `&competition=${encodeURIComponent(String(team.rffmCompetitionId))}` +
      `&group=${encodeURIComponent(String(team.rffmGroupId))}`
    );
  };

  const { calendar, loading, selectedTab, setSelectedTab, rounds, matchesByRound } =
    useCalendar({ season, competition, group });

  const { ownByRound, loading: seasonLoading, error: seasonError } = useOwnTeamSeason({
    season,
    competition,
    group,
    teamCode,
  });

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  useEffect(() => {
    setCurrentIndex(null);
  }, [group]);
  useEffect(() => {
    if (currentIndex === null && rounds.length > 0 && !loading) setCurrentIndex(selectedTab);
  }, [currentIndex, rounds.length, loading, selectedTab]);

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

  const { own, ownBye, rest } = splitRound(selectedMatches, teamCode);
  const hasOwnEntry = Boolean(teamCode && (own || ownBye));

  const entries: Record<number, OwnRoundEntry> = { ...ownByRound };
  if (selectedRoundNumber && own) entries[selectedRoundNumber] = own;
  else if (selectedRoundNumber && ownBye) entries[selectedRoundNumber] = "bye";

  const railRounds: RailRound[] = rounds.map((r) => {
    const entry = entries[r.matchDayNumber];
    const match = entry && entry !== "bye" ? entry : null;
    return {
      number: r.matchDayNumber,
      outcome: match ? ownOutcome(match, teamCode) : null,
      dateLabel: formatShortDay(match?.date ?? r.date),
      suspended: match ? isSuspended(match) : false,
    };
  });

  const effectiveCurrent = currentIndex ?? selectedTab;
  const isCurrentSelected = selectedTab === effectiveCurrent;
  const selectedDay = formatMatchDay(own?.date ?? rounds[selectedTab]?.date);
  const selectedDateLabel = [selectedDay, isCurrentSelected ? "jornada actual" : ""].filter(Boolean).join(" · ");

  const competitionHeader = calendar ? (
    <div className={styles.competitionHeader}>
      <span className={styles.competitionName}>{calendar.competitionName}</span>
      <span className={styles.groupName}>{calendar.groupName}</span>
    </div>
  ) : (
    teamTitleNode
  );

  function renderRound() {
    if (loading) {
      return (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      );
    }
    if (selectedMatches.length === 0) {
      return <EmptyState description="No hay partidos para esta jornada." />;
    }
    return (
      <>
        {hasOwnEntry && teamCode && (
          <OwnMatchCard
            match={own}
            bye={ownBye}
            teamCode={teamCode}
            isCurrentRound={isCurrentSelected}
            actaLink={own?.matchRecordCode?.trim() ? resolveActaLink(own.matchRecordCode.trim()) : null}
          />
        )}
        {rest.length > 0 && (
          <RoundMatchList
            title={hasOwnEntry ? "Resto de la jornada" : "Partidos de la jornada"}
            matches={rest}
            resolveActaLink={resolveActaLink}
          />
        )}
      </>
    );
  }

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
        <RoundRail
          rounds={railRounds}
          selectedIndex={selectedTab}
          currentIndex={effectiveCurrent}
          selectedDateLabel={selectedDateLabel}
          onSelect={setSelectedTab}
        />
        <div className={styles.layout}>
          <div className={styles.main}>{renderRound()}</div>
          {isDesktop && teamCode && (
            <div className={styles.aside}>
              <SeasonPanel
                rounds={rounds.map((r) => ({ number: r.matchDayNumber, entry: entries[r.matchDayNumber] }))}
                teamCode={teamCode}
                selectedNumber={selectedRoundNumber}
                currentNumber={rounds[effectiveCurrent]?.matchDayNumber}
                loading={seasonLoading}
                error={seasonError}
                onSelect={(number) => {
                  const index = rounds.findIndex((r) => r.matchDayNumber === number);
                  if (index >= 0) setSelectedTab(index);
                }}
              />
            </div>
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
            <MatchResultNotificationsToggle />
          </Stack>
        }
      >
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
