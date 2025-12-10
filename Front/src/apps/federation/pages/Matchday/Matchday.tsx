import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import styles from "./Matchday.module.css";
import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import PageHeader from "../../../../shared/components/ui/PageHeader/PageHeader";
import { useUser } from "../../../../shared/context/UserContext";
import { getTeamMatches } from "../../services/federationApi";
import MatchCard from "../../../../shared/components/ui/MatchCard/MatchCard";

export default function Matchday() {
  const { user } = useUser();
  const [matches, setMatches] = useState<any[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      let teams: { id: string; name: string }[] = [];
      try {
        const raw = localStorage.getItem("rffm.saved_combinations_v1");
        const arr = raw ? JSON.parse(raw) : [];
        teams = arr.map((c: any) => c.team).filter(Boolean);
      } catch {}
      if (!teams.length) return;
      const season = "21";
      const raw = localStorage.getItem("rffm.saved_combinations_v1");
      const combos = raw ? JSON.parse(raw) : [];
      const allMatches = await Promise.all(
        combos.map(async (combo: any) => {
          if (!combo.team) return [];
          const params: any = { season };
          if (combo.competition?.id) params.competition = combo.competition.id;
          if (combo.group?.id) params.group = combo.group.id;
          const matches = await getTeamMatches(combo.team.id, params);
          return Array.isArray(matches)
            ? matches.map((m: any) => ({
                ...m,
                team: combo.team,
                competition: combo.competition,
                group: combo.group,
              }))
            : [];
        })
      );
      const flatMatches = allMatches.flat();
      setHasData(flatMatches.length > 0);
      const today = new Date();
      // Agrupar por equipo y seleccionar el partido más próximo a hoy (próxima jornada pendiente)
      const matchesByTeam: Record<string, any[]> = {};
      // Agrupar por el id de equipo configurado, no por el id que pueda venir en el partido
      teams.forEach((team) => {
        matchesByTeam[team.id] = flatMatches.filter(
          (m: any) => m.team?.id === team.id
        );
      });
      const matchdayMatches: any[] = [];
      teams.forEach((team) => {
        const matches = matchesByTeam[team.id] || [];
        const sorted = matches.slice().sort((a, b) => {
          const dateA = new Date(a.match?.fecha || a.match?.date || a.date);
          const dateB = new Date(b.match?.fecha || b.match?.date || b.date);
          return dateA.getTime() - dateB.getTime();
        });
        const nextMatch =
          sorted.find((m) => {
            const date = new Date(m.match?.fecha || m.match?.date || m.date);
            return date >= today;
          }) || sorted[sorted.length - 1];
        if (nextMatch) matchdayMatches.push(nextMatch);
      });
      setMatches(matchdayMatches);
      setLoading(false);
    }
    fetchMatches();
  }, []);

  return (
    <BaseLayout>
      <div className={styles.container}>
        <PageHeader title="Partidos de la Jornada" />
        <div className={styles.cards}>
          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                padding: "2rem 0",
              }}
            >
              <CircularProgress />
            </div>
          ) : matches.length === 0 && hasData ? (
            "No hay partidos para mostrar."
          ) : (
            matches.map((match, idx) => {
              // Mejorar robustez: buscar nombre en más variantes
              let comp =
                match.team?.competition?.name ||
                match.competition?.name ||
                match.competitionName ||
                (typeof match.competition === "object" &&
                  match.competition?.nombre) ||
                (typeof match.competition === "object" &&
                  match.competition?.name) ||
                match.competitionId ||
                "";
              let group =
                match.team?.group?.name ||
                match.group?.name ||
                match.groupName ||
                (typeof match.group === "object" && match.group?.nombre) ||
                (typeof match.group === "object" && match.group?.name) ||
                match.groupId ||
                "";
              // Si sigue vacío, mostrar id si existe
              if (
                !comp &&
                match.competition &&
                typeof match.competition === "object" &&
                match.competition.id
              )
                comp = `Comp. ${match.competition.id}`;
              if (
                !group &&
                match.group &&
                typeof match.group === "object" &&
                match.group.id
              )
                group = `Grupo ${match.group.id}`;
              return (
                <div key={idx} className={styles.matchCardWrapper}>
                  <div className={styles.chipsContainer}>
                    <span className={styles.competitionChip}>{comp}</span>
                    {group && <span className={styles.groupChip}>{group}</span>}
                  </div>
                  <MatchCard item={match} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </BaseLayout>
  );
}
