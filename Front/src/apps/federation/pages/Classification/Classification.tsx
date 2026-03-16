import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import ClassificationItem, {
  MatchResult,
} from "../../../../shared/components/ui/ClassificationItem/ClassificationItem";
import {
  getTeamsForClassification,
  getCalendar,
  getSettingsForUser,
} from "../../services/api";
import { useUser } from "../../../../shared/context/UserContext";
import Grid from "@mui/material/Grid";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../../../shared/components/ui/GroupSelector/GroupSelector";
import styles from "./Classification.module.css";

interface Team {
  teamId: string;
  teamName: string;
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  matchStreaks?: { type?: string }[];
}

export default function Classification() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [teamMatches, setTeamMatches] = useState<Record<string, any[]>>({});

  const [selectedCompetition, setSelectedCompetition] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);

  const { user } = useUser();

  function handleCompetitionChange(c?: { id: string; name: string; categoryGroup: string }) {
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
            const primary = settings.find((s: any) => s.isPrimary) || settings[0];
            setSelectedCompetition(primary.competitionId || primary.competition?.id);
            setSelectedGroup(primary.groupId || primary.group?.id);
          }
        } catch (e) {
          // fallback to defaults
        }
      }
    }
    loadSettings();
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!selectedCompetition || !selectedGroup) {
        setTeams([]);
        setTeamMatches({});
        return;
      }

      setLoading(true);
      try {
        const [teamsData, calData] = await Promise.all([
          getTeamsForClassification({
            season: "21",
            competition: selectedCompetition,
            group: selectedGroup,
            playType: "1",
          }),
          getCalendar({
            season: "21",
            competition: selectedCompetition,
            group: selectedGroup,
            playType: "1",
          }),
        ]);

        setTeams(teamsData || []);
        const map: Record<string, any[]> = {};
        try {
          if (calData && (calData as any).matchDays) {
            for (const day of (calData as any).matchDays || []) {
              for (const m of day.matches || []) {
                const localId = String(
                  m.localTeamCode ?? m.localTeamId ?? ""
                ).trim();
                const visitorId = String(
                  m.visitorTeamCode ?? m.visitorTeamId ?? ""
                ).trim();
                const localName = String(m.localTeamName ?? "").trim();
                const visitorName = String(m.visitorTeamName ?? "").trim();
                const localGoals = Number(
                  m.localGoals ?? m.LocalGoals ?? m.goles_casa ?? m.goles ?? NaN
                );
                const visitorGoals = Number(
                  m.visitorGoals ??
                    m.VisitorGoals ??
                    m.goles_visitante ??
                    m.goles_v ??
                    NaN
                );
                const push = (key: string, opp: string, isLocal: boolean) => {
                  if (!key) return;
                  map[key] = map[key] || [];
                  let result: "G" | "E" | "P" = "E";
                  if (
                    !Number.isNaN(localGoals) &&
                    !Number.isNaN(visitorGoals)
                  ) {
                    if (localGoals > visitorGoals) result = isLocal ? "G" : "P";
                    else if (localGoals < visitorGoals)
                      result = isLocal ? "P" : "G";
                    else result = "E";
                  }
                  map[key].push({
                    date: day.date,
                    opponent: opp,
                    result,
                    localGoals: Number.isNaN(localGoals) ? null : localGoals,
                    visitorGoals: Number.isNaN(visitorGoals)
                      ? null
                      : visitorGoals,
                    isLocal: !!isLocal,
                    scoreLeft: isLocal
                      ? Number.isNaN(localGoals)
                        ? ""
                        : String(localGoals)
                      : Number.isNaN(visitorGoals)
                      ? ""
                      : String(visitorGoals),
                    scoreRight: isLocal
                      ? Number.isNaN(visitorGoals)
                        ? ""
                        : String(visitorGoals)
                      : Number.isNaN(localGoals)
                      ? ""
                      : String(localGoals),
                  });
                };
                push(localId || localName, visitorName || visitorId, true);
                push(visitorId || visitorName, localName || localId, false);
              }
            }
          } else if (calData && (calData as any).rounds) {
            for (const r of (calData as any).rounds || []) {
              for (const m of (r.equipos ??
                r.partidos ??
                r.matches ??
                []) as any[]) {
                const localId = String(
                  m.codigo_equipo_local ?? m.codigo_local ?? m.localTeamId ?? ""
                ).trim();
                const visitorId = String(
                  m.codigo_equipo_visitante ??
                    m.codigo_visitante ??
                    m.awayTeamId ??
                    ""
                ).trim();
                const localName = String(
                  m.equipo_local ?? m.localTeamName ?? m.local ?? ""
                ).trim();
                const visitorName = String(
                  m.equipo_visitante ?? m.awayTeamName ?? m.visitante ?? ""
                ).trim();
                const localGoals = Number(
                  m.goles_casa ?? m.LocalGoals ?? m.goles ?? NaN
                );
                const visitorGoals = Number(
                  m.goles_visitante ?? m.AwayGoals ?? m.goles_v ?? NaN
                );
                const push = (key: string, opp: string, isLocal: boolean) => {
                  if (!key) return;
                  map[key] = map[key] || [];
                  let result: "G" | "E" | "P" = "E";
                  if (
                    !Number.isNaN(localGoals) &&
                    !Number.isNaN(visitorGoals)
                  ) {
                    if (localGoals > visitorGoals) result = isLocal ? "G" : "P";
                    else if (localGoals < visitorGoals)
                      result = isLocal ? "P" : "G";
                    else result = "E";
                  }
                  map[key].push({
                    date: m.fecha ?? m.date ?? null,
                    opponent: opp,
                    result,
                    localGoals: Number.isNaN(localGoals) ? null : localGoals,
                    visitorGoals: Number.isNaN(visitorGoals)
                      ? null
                      : visitorGoals,
                    isLocal: !!isLocal,
                    scoreLeft: isLocal
                      ? Number.isNaN(localGoals)
                        ? ""
                        : String(localGoals)
                      : Number.isNaN(visitorGoals)
                      ? ""
                      : String(visitorGoals),
                    scoreRight: isLocal
                      ? Number.isNaN(visitorGoals)
                        ? ""
                        : String(visitorGoals)
                      : Number.isNaN(localGoals)
                      ? ""
                      : String(localGoals),
                  });
                };
                push(localId || localName, visitorName || visitorId, true);
                push(visitorId || visitorName, localName || localId, false);
              }
            }
          }
        } catch (e) {
          // ignore
        }
        setTeamMatches(map);
      } catch (err) {
        setTeams([]);
        setTeamMatches({});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCompetition, selectedGroup]);

  const filtered = (teams as any).sort((a: any, b: any) => b.points - a.points);

  return (
    <BaseLayout>
      <ContentLayout
        title="Clasificación"
        subtitle="Tabla de equipos y estadísticas"
      >
        <div className={styles.filters}>
          <Grid container spacing={1} className={styles.filtersGrid}>
            <Grid item xs={12} sm={6}>
              <CompetitionSelector
                onChange={handleCompetitionChange}
                value={selectedCompetition}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
