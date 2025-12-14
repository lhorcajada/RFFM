import { useEffect, useState } from "react";
import {
  getPlayersByTeam,
  getPlayer,
  getTeamAgeSummary,
  getTeamParticipationSummary,
  getTeamsForClassification,
} from "../../services/api";

import type { PlayerDetailsResponse } from "../../types/player";

type SelectedTeam = {
  id: string | number;
  name: string;
  url?: string;
  raw?: any;
};

export type Player = {
  id: number;
  name: string;
  url?: string;
  email?: string;
  playerId?: string | number;
  jerseyNumber?: string | number | null;
  age?: number | null;
  teamParticipations?: Array<any>;
  raw?: any;
  matches?: any;
  cards?: any;
  competitions?: any[];
};

export default function usePlayers(
  selectedTeam?: SelectedTeam,
  selectedCompetition?: string,
  selectedGroup?: string
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ageCounts, setAgeCounts] = useState<Record<number, number>>({});
  const [groupCounts, setGroupCounts] = useState<any[]>([]);
  const [teamDetails, setTeamDetails] = useState<any | null>(null);

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
          if (Array.isArray(list))
            list = list.filter((it) => it != null && typeof it === "object");

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
                    const t = { ...teamToSet };
                    t.classification = match;
                    setTeamDetails(t);
                  }
                }
              }
            } catch (e) {}
          } else {
            setTeamDetails((selectedTeam as any)?.raw ?? null);
          }
        }

        const mapped: Player[] = (list || []).map((p: any, idx: number) => {
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
          } as Player;
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

  async function fetchPlayerDetails(p: Player) {
    try {
      // if cached details exist just build from raw
      const cached = p.raw;
      const buildFrom = (d: any) => {
        const comps: any[] = Array.isArray(d.competitions)
          ? d.competitions
          : d.competiciones && Array.isArray(d.competiciones)
          ? d.competiciones
          : [];
        const playerAge = d.age ?? d.ace ?? null;
        const stats = (
          comps.length > 0
            ? comps
            : [
                {
                  competitionName: d.teamCategory ?? "",
                  groupName: "",
                  teamName: d.team ?? d.teamName ?? "",
                  teamPoints: d.teamPoints ?? 0,
                },
              ]
        ).map((c: any) => ({
          seasonId: d.seasonId ? Number(d.seasonId) : 0,
          seasonName: d.seasonId ? String(d.seasonId) : "",
          dorsalNumber: d.jerseyNumber ?? d.jersey ?? "",
          position: d.position ?? "",
          categoryName: d.teamCategory ?? "",
          competitionName: c.competitionName ?? "",
          groupName: c.groupName ?? "",
          teamName: c.teamName ?? d.team ?? "",
          teamPoints: c.teamPoints ?? 0,
          age: playerAge,
          matchesPlayed: d.matches?.played ?? d.matches?.called ?? 0,
          goals: d.matches?.totalGoals ?? 0,
          headLine: d.matches?.starter ?? 0,
          substitute: d.matches?.substitute ?? 0,
          yellowCards: d.cards?.yellow ?? 0,
          redCards: d.cards?.red ?? 0,
          doubleYellowCards: d.cards?.doubleYellow ?? 0,
          teamParticipations: comps.map((cp) => ({
            competitionName: cp.competitionName,
            groupName: cp.groupName,
            teamName: cp.teamName,
            teamPoints: cp.teamPoints ?? 0,
          })),
        }));

        return {
          statisticsBySeason: stats,
          playerId: d.playerId ? Number(d.playerId) : 0,
          playerName: d.name ?? d.nombre ?? "",
          ace: d.age ?? null,
        } as PlayerDetailsResponse;
      };

      if (cached && (cached.competitions || cached.matches || cached.cards)) {
        return buildFrom(cached);
      }

      let idToFetch: string | null = null;
      if (p.playerId) idToFetch = String(p.playerId);
      if (!idToFetch) {
        const m = (p.url || "").match(/(players|fichajugador|jugador)\/(\d+)/i);
        if (m && m[2]) idToFetch = m[2];
        else {
          const m2 = (p.url || "").match(/(\d{5,})/);
          if (m2) idToFetch = m2[0];
        }
      }
      if (!idToFetch && p.id !== undefined && p.id !== null)
        idToFetch = String(p.id);
      if (!idToFetch)
        throw new Error("No player id available to fetch details");

      const data = await getPlayer(idToFetch);
      if (data && (data as any).competitions) return buildFrom(data);
      return data as PlayerDetailsResponse;
    } catch (e) {
      throw e;
    }
  }

  async function loadAgeSummary(teamId: string) {
    try {
      const data = await getTeamAgeSummary(teamId, "21");
      const map: Record<number, number> = {};
      (data || []).forEach((d: any) => {
        const a = Number(d.age ?? d.ace ?? 0);
        map[a] = Number(d.total ?? d.count ?? 0);
      });
      return map;
    } catch (e) {
      return {};
    }
  }

  async function loadParticipationSummary(teamId: string) {
    try {
      const data = await getTeamParticipationSummary(teamId, "21");
      return data || [];
    } catch (e) {
      return [];
    }
  }

  return {
    players,
    loading,
    error,
    ageCounts,
    groupCounts,
    teamDetails,
    fetchPlayerDetails,
    loadAgeSummary,
    loadParticipationSummary,
  };
}
