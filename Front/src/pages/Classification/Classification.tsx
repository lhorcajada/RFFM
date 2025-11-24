import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import ClassificationItem, {
  MatchResult,
} from "../../components/ui/ClassificationItem/ClassificationItem";
import { getTeamsForClassification } from "../../services/api";
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
      getTeamsForClassification({
        season: "21",
        competition: competitionId,
        group: groupId,
        playType: "1",
      })
        .then((data) => setTeams(data))
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
