import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import styles from "./Matchday.module.css";
import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import { useUser } from "../../../../shared/context/UserContext";
import {
  getTeamMatches,
  getSettingsForUser,
} from "../../services/federationApi";
import MatchCard from "../../../../shared/components/ui/MatchCard/MatchCard";

export default function Matchday() {
  const { user } = useUser();
  const [matches, setMatches] = useState<any[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      try {
        // Cargar los settings desde la API
        console.debug("Matchday.fetchMatches: userId=", user?.id);
        const savedSettings = await getSettingsForUser(user?.id);
        console.debug(
          "Matchday.fetchMatches: savedSettings count=",
          Array.isArray(savedSettings)
            ? savedSettings.length
            : typeof savedSettings
        );
        if (!savedSettings || savedSettings.length === 0) {
          setHasData(false);
          setLoading(false);
          return;
        }

        // Convertir settings a formato de combos para getTeamMatches
        const combos = savedSettings.map((setting: any) => ({
          team: { id: setting.teamId, name: setting.teamName },
          competition: {
            id: setting.competitionId,
            name: setting.competitionName,
          },
          group: { id: setting.groupId, name: setting.groupName },
        }));

        const season = "21";
        const allMatches = await Promise.all(
          combos.map(async (combo: any) => {
            if (!combo.team?.id) return [];
            const params: any = { season };
            if (combo.competition?.id)
              params.competition = combo.competition.id;
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
        // Agrupar por equipo y seleccionar el partido más próximo a hoy
        const matchesByTeam: Record<string, any[]> = {};
        combos.forEach((combo: any) => {
          matchesByTeam[combo.team.id] = flatMatches.filter(
            (m: any) => m.team?.id === combo.team.id
          );
        });
        const matchdayMatches: any[] = [];
        combos.forEach((combo: any) => {
          const matches = matchesByTeam[combo.team.id] || [];
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
      } catch (error) {
        console.error("Error fetching matches:", error);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();

    // Escuchar cambios en los settings
    window.addEventListener("rffm.saved_combinations_changed", fetchMatches);
    return () => {
      window.removeEventListener(
        "rffm.saved_combinations_changed",
        fetchMatches
      );
    };
  }, [user]);

  return (
    <BaseLayout>
      <div className={styles.container}>
        <ContentLayout title="Partidos de la Jornada">
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
                // Extraer y formatear la fecha
                const matchDate =
                  match.match?.fecha || match.match?.date || match.date;
                let dateStr = "";
                if (matchDate) {
                  try {
                    const date = new Date(matchDate);
                    dateStr = date.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                  } catch {}
                }

                return (
                  <div key={idx} className={styles.matchCardWrapper}>
                    <div className={styles.chipsContainer}>
                      <span className={styles.competitionChip}>{comp}</span>
                      {group && (
                        <span className={styles.groupChip}>{group}</span>
                      )}
                    </div>
                    {dateStr && (
                      <div className={styles.matchDate}>{dateStr}</div>
                    )}
                    <MatchCard item={match} />
                  </div>
                );
              })
            )}
          </div>
        </ContentLayout>
      </div>
    </BaseLayout>
  );
}
