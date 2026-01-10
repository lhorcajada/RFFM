import { client } from "../../../../core/api/client";
import type { PlayerDetailsResponse } from "../../types/player";

export class PlayerService {
  private buildFrom(d: any): PlayerDetailsResponse {
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
  }

  async getPlayer(playerId: string) {
    const res = await client.get(`players/${encodeURIComponent(playerId)}`);
    const data = res.data;

    const raw = (data && (data.player || data)) as any;

    if (
      raw &&
      (Array.isArray(raw.statisticsBySeason) || Array.isArray(raw.statistics))
    ) {
      return raw;
    }

    if (
      raw &&
      (Array.isArray(raw.competitions) ||
        Array.isArray(raw.competiciones) ||
        raw.matches ||
        raw.cards)
    ) {
      return this.buildFrom(raw);
    }

    return raw;
  }
}

export const playerService = new PlayerService();
