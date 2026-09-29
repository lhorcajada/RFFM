import { Button, CircularProgress, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import ClassificationItem, {
  type MatchResult,
} from "../../../../shared/components/ui/ClassificationItem/ClassificationItem";
import useClassification from "../../../../shared/hooks/useClassification";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import TeamCompetitionMissing from "../../components/TeamCompetitionMissing/TeamCompetitionMissing";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import useRffmCompetitionNames from "../../hooks/useRffmCompetitionNames";
import styles from "./Classification.module.css";

function toLast5(streaks: { type?: string }[] = []): MatchResult[] {
  return streaks.map((s) => {
    const raw = (s?.type || "").toUpperCase();
    if (raw === "W" || raw === "G") return { result: "G" };
    if (raw === "D" || raw === "E") return { result: "E" };
    return { result: "P" };
  });
}

export default function Classification() {
  useAuditPageAccess("Classification");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();
  const { seasonId, currentSeasonId } = useRffmSeason();

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
      <div className={styles.list}>
        {teams.map((t) => (
          <ClassificationItem
            key={t.teamId}
            teamId={t.teamId}
            position={t.position}
            totalTeams={teams.length}
            teamName={t.teamName}
            points={t.points}
            played={t.played}
            won={t.won}
            drawn={t.drawn}
            lost={t.lost}
            goalsFor={t.goalsFor}
            goalsAgainst={t.goalsAgainst}
            last5={toLast5(t.matchStreaks)}
            teamMatches={teamMatches[t.teamId] || teamMatches[String(t.teamName)] || []}
          />
        ))}
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
