import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import ClassificationItem from "../../../../shared/components/ui/ClassificationItem/ClassificationItem";
import { getSettingsForUser } from "../../services/api";
import useClassification from "../../../../shared/hooks/useClassification";
import { useUser } from "../../../../shared/context/UserContext";
import Grid from "@mui/material/Grid";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../../../shared/components/ui/GroupSelector/GroupSelector";
import styles from "./Classification.module.css";
import RffmSeasonSelector from "../../../../shared/components/ui/RffmSeasonSelector/RffmSeasonSelector";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import useClearOnSeasonChange from "../../../../shared/hooks/useClearOnSeasonChange";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

export default function Classification() {
  useAuditPageAccess('Classification');

  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined,
  );

  const { user } = useUser();
  const { seasonId, applySeasonId } = useRffmSeason();
  const season = String(seasonId ?? 21);

  useClearOnSeasonChange(() => {
    setSelectedCompetition(undefined);
    setSelectedGroup(undefined);
  });

  function handleCompetitionChange(c?: {
    id: string;
    name: string;
    categoryGroup: string;
  }) {
    if (c?.id !== selectedCompetition) {
      setSelectedGroup(undefined);
    }
    setSelectedCompetition(c?.id);
  }

  function handleGroupChange(g?: { id: string; name: string }) {
    setSelectedGroup(g?.id);
  }

  useEffect(() => {
    async function loadSettings() {
      if (user?.id) {
        try {
          const settings = await getSettingsForUser(user.id);
          if (Array.isArray(settings) && settings.length > 0) {
            const primary =
              settings.find((s: any) => s.isPrimary) || settings[0];
            applySeasonId(primary.seasonId);
            setSelectedCompetition(
              primary.competitionId || primary.competition?.id,
            );
            setSelectedGroup(primary.groupId || primary.group?.id);
          }
        } catch (e) {
          // fallback to defaults
        }
      }
    }
    loadSettings();
  }, [user]);

  const { teams: filtered, teamMatches, loading } = useClassification({
    season,
    competition: selectedCompetition,
    group: selectedGroup,
  });

  return (
    <BaseLayout>
      <ContentLayout
        title="Clasificación"
        subtitle="Tabla de equipos y estadísticas"
      >
        <div className={styles.filters}>
          <Grid container spacing={1} className={styles.filtersGrid}>
            <Grid item xs={12} sm={4}>
              <RffmSeasonSelector />
            </Grid>
            <Grid item xs={12} sm={4}>
              <CompetitionSelector
                onChange={handleCompetitionChange}
                value={selectedCompetition}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <GroupSelector
                competitionId={selectedCompetition}
                onChange={handleGroupChange}
                value={selectedGroup}
              />
            </Grid>
          </Grid>
        </div>

        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.headerBar} />

            <div className={styles.grid}>
              {loading ? (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <CircularProgress />
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                  <EmptyState description={"No hay equipos que coincidan."} />
                </div>
              ) : (
                filtered.map((team: any) => (
                  <ClassificationItem
                    key={team.teamId}
                    teamId={team.teamId}
                    position={team.position}
                    totalTeams={filtered.length}
                    teamName={team.teamName}
                    points={team.points}
                    played={team.played}
                    won={team.won}
                    drawn={team.drawn}
                    lost={team.lost}
                    goalsFor={team.goalsFor}
                    goalsAgainst={team.goalsAgainst}
                    last5={(team.matchStreaks || []).map((s: any) => {
                      const raw = (s?.type || "").toUpperCase();
                      if (raw === "W" || raw === "G") return { result: "G" };
                      if (raw === "D" || raw === "E") return { result: "E" };
                      return { result: "P" };
                    })}
                    teamMatches={
                      teamMatches[team.teamId] ||
                      teamMatches[String(team.teamName)] ||
                      []
                    }
                  />
                ))
              )}
              <div className={styles.gridEndSpacer} aria-hidden />
            </div>
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
