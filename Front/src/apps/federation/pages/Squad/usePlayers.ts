import { useEffect, useState } from "react";
import {
  getPlayersByTeam,
  getTeamsForClassification,
} from "../../services/api";
import type { SelectedTeam, Player, PlayersState } from "./playersTypes";

export function extractPlayerIdFromUrl(u?: string): string | null {
  if (!u) return null;
  try {
    const m = u.match(/(players|fichajugador|jugador)\/(\d+)/i);
    if (m && m[2]) return m[2];
    const m2 = u.match(/(\d{5,})/);
    if (m2) return m2[0];
    return null;
  } catch (e) {
    return null;
  }
}

export function usePlayers(
  selectedTeam?: SelectedTeam,
  selectedCompetition?: string,
  selectedGroup?: string
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [ageCounts, setAgeCounts] = useState<Record<number, number>>({});
  const [groupCounts, setGroupCounts] = useState<PlayersState["groupCounts"]>(
    []
  );
  const [teamDetails, setTeamDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setError(null);
        if (!selectedTeam) {
          if (mounted) {
            setPlayers([]);
            setAgeCounts({});
            setGroupCounts([]);
            setTeamDetails(null);
          }
          return;
        }
        if (mounted) setLoading(true);
        const teamId = String(selectedTeam.id);
        const payload = await getPlayersByTeam(teamId);

        let list: any[] = [];
        if (payload) {
          if (Array.isArray((payload as any).players))
            list = (payload as any).players;
          else if (Array.isArray((payload as any).jugadores_equipo))
            list = (payload as any).jugadores_equipo;
          else if (Array.isArray(payload)) list = payload as any[];

          if (Array.isArray(list)) {
            list = list.filter((it) => it != null && typeof it === "object");
          }

          const teamFromApi = (payload as any) || null;
          if (teamFromApi) {
            const teamToSet: any = { ...teamFromApi };
            if ((selectedTeam as any)?.raw)
              teamToSet.classification = (selectedTeam as any).raw;
            setTeamDetails(teamToSet);
            try {
              if (selectedCompetition && selectedGroup) {
                const clsPayload = await getTeamsForClassification({
                  season: "21",
                  competition: selectedCompetition,
                  group: selectedGroup,
                  playType: "1",
                });
                if (Array.isArray(clsPayload) && clsPayload.length > 0) {
                  const match = (clsPayload as any[]).find((c: any) => {
                    const cid = String(
                      c.teamId ??
                        c.codequipo ??
                        c.codigo_equipo ??
                        c.teamCode ??
                        ""
                    );
                    return (
                      cid === String((selectedTeam as any)?.id) ||
                      cid === String(teamFromApi.teamCode ?? "")
                    );
                  });
                  if (match) {
                    const t = { ...(teamToSet as any) };
                    t.classification = match;
                    setTeamDetails(t);
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          } else {
            setTeamDetails((selectedTeam as any)?.raw ?? null);
          }
        }

        const mapped: Player[] = list.map((p: any, idx: number) => {
          const raw = p.ace ?? p.age ?? null;
          let age: number | null = null;
          if (raw !== null && raw !== undefined && raw !== "") {
            const n = Number(raw);
            if (!Number.isNaN(n)) age = n;
            else {
              const m = String(raw).match(/(\d{1,2})/);
              if (m && m[1]) age = Number(m[1]);
            }
          }
          const name = p.name ?? p.nombre ?? "";
          const playerId = p.playerId ?? p.id ?? p.cod_jugador ?? null;
          const jersey =
            p.jerseyNumber ?? p.dorsalNumber ?? p.dorsal ?? p.number ?? null;
          return {
            id: idx + 1,
            name,
            url: p.url || p.link || "",
            email: p.url || "",
            playerId,
            jerseyNumber: jersey,
            age,
            teamParticipations: p.teamParticipations || p.participaciones || [],
            raw: p,
            matches: p.matches || p.partidos || null,
            cards: p.cards || p.tarjetas || null,
            competitions: p.competitions || p.competiciones || [],
          };
        });

        if (mounted) {
          setPlayers(mapped);
          const counts = mapped.reduce<Record<number, number>>((acc, p) => {
            const a = p.age ?? null;
            if (a === null) return acc;
            acc[a] = (acc[a] || 0) + 1;
            return acc;
          }, {});
          setAgeCounts(counts);

          const groupsMap = new Map<string, any>();
          mapped.forEach((p) => {
            const tps = (p as any).teamParticipations || [];
            (tps as any[]).forEach((tp) => {
              const key = `${tp.competitionName}||${tp.teamName}`;
              const existing = groupsMap.get(key);
              if (existing) {
                existing.count++;
                if (tp.teamPoints !== undefined && tp.teamPoints !== null)
                  existing.teamPoints = tp.teamPoints;
              } else {
                groupsMap.set(key, {
                  competitionName: tp.competitionName,
                  teamName: tp.teamName,
                  teamPoints: tp.teamPoints ?? 0,
                  count: 1,
                });
              }
            });
          });
          setGroupCounts(Array.from(groupsMap.values()));
        }
      } catch (err: unknown) {
        if (mounted) setError(String((err as Error).message || err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedTeam, selectedCompetition, selectedGroup]);

  return {
    players,
    ageCounts,
    groupCounts,
    teamDetails,
    loading,
    error,
    extractPlayerIdFromUrl,
  };
}
