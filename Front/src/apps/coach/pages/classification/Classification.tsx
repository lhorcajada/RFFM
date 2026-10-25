import { useState } from "react";
import { Button, CircularProgress, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import useClassification, {
  type ClassificationTeam,
} from "../../../../shared/hooks/useClassification";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import useRffmCompetitionNames from "../../hooks/useRffmCompetitionNames";
import { getGapText, getZoneLegend } from "./standings";
import { resolveStandingSpots } from "./standingRules";
import MyTeamSummary from "./components/MyTeamSummary";
import StandingsList from "./components/StandingsList";
import TeamDetail from "./components/TeamDetail";
import ZoneLegend from "./components/ZoneLegend";
import styles from "./Classification.module.css";

export default function Classification() {
  useAuditPageAccess("Classification");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();
  const { seasonId, currentSeasonId } = useRffmSeason();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [chosenTeamId, setChosenTeamId] = useState<string | null | undefined>(undefined);

  const season = String(currentSeasonId ?? seasonId ?? "");
  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const canLoad = hasCompetition && season !== "";

  const { teams, teamMatches, loading } = useClassification({
    season,
    competition: canLoad ? String(team?.rffmCompetitionId) : undefined,
    group: canLoad ? String(team?.rffmGroupId) : undefined,
  });
  const { competitionName, groupName } = useRffmCompetitionNames(
    team?.rffmCompetitionId,
    team?.rffmGroupId,
  );

  const spots = resolveStandingSpots(
    {
      promotionSpots: team?.promotionSpots,
      playoffSpots: team?.playoffSpots,
      relegationSpots: team?.relegationSpots,
    },
    competitionName,
  );
  const ownTeamCode = team?.rffmTeamCode ? String(team.rffmTeamCode) : null;
  const ownIndex = ownTeamCode ? teams.findIndex((t) => String(t.teamId) === ownTeamCode) : -1;
  const ownTeam = ownIndex >= 0 ? teams[ownIndex] : null;
  const defaultTeamId = isDesktop ? ownTeam?.teamId ?? teams[0]?.teamId ?? null : null;
  const selectedTeamId = chosenTeamId === undefined ? defaultTeamId : chosenTeamId;
  const selectedIndex = teams.findIndex((t) => t.teamId === selectedTeamId);
  const panelTeam = isDesktop ? teams[selectedIndex >= 0 ? selectedIndex : 0] : undefined;

  function handleSelect(teamId: string) {
    if (isDesktop) {
      setChosenTeamId(teamId);
      return;
    }
    setChosenTeamId(selectedTeamId === teamId ? null : teamId);
  }

  function matchesOf(t: ClassificationTeam) {
    return teamMatches[t.teamId] || teamMatches[String(t.teamName)] || [];
  }

  function renderDetail(t: ClassificationTeam, variant: "inline" | "panel") {
    return (
      <TeamDetail
        team={t}
        gapText={getGapText(teams, teams.indexOf(t))}
        matches={matchesOf(t)}
        variant={variant}
      />
    );
  }

  const competitionHeader = competitionName ? (
    <div className={styles.competitionHeader}>
      <span className={styles.competitionName}>{competitionName}</span>
      {groupName && <span className={styles.groupName}>{groupName}</span>}
    </div>
  ) : (
    teamTitleNode
  );

  function renderContent() {
    if (teamLoading || loading) {
      return (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      );
    }
    if (!team) {
      return <EmptyState description="Selecciona un equipo para ver su clasificación." />;
    }
    if (!hasCompetition) {
      return <TeamCompetitionMissing team={team} />;
    }
    if (teams.length === 0) {
      return <EmptyState description="No hay clasificación disponible para la competición del equipo." />;
    }
    return (
      <div className={styles.page}>
        {ownTeam && !isDesktop && (
          <MyTeamSummary team={ownTeam} gapText={getGapText(teams, ownIndex)} />
        )}
        <div className={styles.layout}>
          <div className={styles.standings}>
            <StandingsList
              teams={teams}
              ownTeamId={ownTeam?.teamId}
              selectedTeamId={isDesktop ? panelTeam?.teamId ?? null : selectedTeamId}
              onSelect={handleSelect}
              isDesktop={isDesktop}
              spots={spots}
              renderInlineDetail={(t) => renderDetail(t, "inline")}
            />
            <ZoneLegend items={getZoneLegend(spots, teams.length)} />
          </div>
          {panelTeam && <aside className={styles.panel}>{renderDetail(panelTeam, "panel")}</aside>}
        </div>
      </div>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Clasificación"
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
        {renderContent()}
      </ContentLayout>
    </BaseLayout>
  );
}
