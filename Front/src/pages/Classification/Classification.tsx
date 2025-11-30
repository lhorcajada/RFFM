import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import ClassificationItem, {
  MatchResult,
} from "../../components/ui/ClassificationItem/ClassificationItem";
import { getTeamsForClassification, getCalendar } from "../../services/api";
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rffm.current_selection");
      let competitionId = "25255269";
      let groupId = "25255283";
      if (raw) {
        try {
          const combo = JSON.parse(raw);
          if (combo && combo.competition && combo.competition.id)
            competitionId = String(combo.competition.id);
          if (combo && combo.group && combo.group.id)
            groupId = String(combo.group.id);
        } catch (e) {
          // ignore parse errors and fallback to defaults
        }
      }

      setLoading(true);
      Promise.all([
        getTeamsForClassification({
          season: "21",
          competition: competitionId,
          group: groupId,
          playType: "1",
        }),
        getCalendar({
          season: "21",
          competition: competitionId,
          group: groupId,
          playType: "1",
        }),
      ])
        .then(([teamsData, calData]) => {
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
                    m.localGoals ??
                      m.LocalGoals ??
                      m.goles_casa ??
                      m.goles ??
                      NaN
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
                      if (localGoals > visitorGoals)
                        result = isLocal ? "G" : "P";
                      else if (localGoals < visitorGoals)
                        result = isLocal ? "P" : "G";
                      else result = "E";
                    }
                    map[key].push({
                      date: day.date,
                      opponent: opp,
                      result,
                      score: isLocal
                        ? `${localGoals}-${visitorGoals}`
                        : `${visitorGoals}-${localGoals}`,
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
                    m.codigo_equipo_local ??
                      m.codigo_local ??
                      m.localTeamId ??
                      ""
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
                      if (localGoals > visitorGoals)
                        result = isLocal ? "G" : "P";
                      else if (localGoals < visitorGoals)
                        result = isLocal ? "P" : "G";
                      else result = "E";
                    }
                    map[key].push({
                      date: m.fecha ?? m.date ?? null,
                      opponent: opp,
                      result,
                      score: isLocal
                        ? `${localGoals}-${visitorGoals}`
                        : `${visitorGoals}-${localGoals}`,
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
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (e) {
      // fallback: try default call
      setLoading(true);
      getTeamsForClassification({
        season: "21",
        competition: "25255269",
        group: "25255283",
        playType: "1",
      })
        .then((data) => setTeams(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []);

  const filtered = (teams as any).sort((a: any, b: any) => b.points - a.points);

  return (
    <BaseLayout>
      <PageHeader
        title="Clasificación"
        subtitle="Tabla de equipos y estadísticas"
      />
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.headerBar} />

          <div className={styles.grid}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <CircularProgress />
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>No hay equipos que coincidan.</div>
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
    </BaseLayout>
  );
}
