import { client, DEFAULT_RETRIES } from "../../../../core/api/client";
import type { Team } from "../../types/team";
import type { TeamCallupsResponse } from "../../types/callups";
import type { TeamsGoalSectorsComparison } from "../../types/goalSectors";
import type { RawPlayer } from "../../types/rawPlayer";
import type { RawTeam } from "../../types/rawTeam";

export class TeamService {
  async getPlayersByTeam(teamId: string): Promise<Team> {
    const maxAttempts = DEFAULT_RETRIES;
    let attempt = 0;
    let lastErr: any = null;

    const toNumber = (v: unknown) => {
      const n = Number(v as any);
      return Number.isNaN(n) ? 0 : n;
    };

    while (attempt < maxAttempts) {
      try {
        const res = await client.get(`teams/${encodeURIComponent(teamId)}`);
        const raw = res.data as RawTeam;

        // players array under various keys
        const playersArr =
          raw?.players ?? raw?.jugadores_equipo ?? raw?.jugadores ?? [];

        const players = (playersArr || [])
          .filter((p: any) => p != null && typeof p === "object")
          .map((p: RawPlayer) => ({
            playerId: String(p.playerId ?? p.cod_jugador ?? p.id ?? ""),
            seasonId: String(p.seasonId ?? p.temporada ?? p.season ?? ""),
            name: (p.name ?? p.nombre ?? "") as string,
            age: p.age ? toNumber(p.age) : p.ace ? toNumber(p.ace) : 0,
            birthYear: toNumber(
              p.birthYear ?? p.anio_nacimiento ?? p.anio_nac ?? 0
            ),
            team: (p.team ?? p.equipo ?? "") as string,
            teamCode: String(p.teamCode ?? p.codigo_equipo ?? ""),
            teamCategory: (p.teamCategory ?? p.categoria ?? "") as string,
            jerseyNumber: String(p.jerseyNumber ?? p.dorsal ?? p.numero ?? ""),
            position: (p.position ?? p.posicion ?? "") as string,
            isGoalkeeper: Boolean(
              p.isGoalkeeper ?? p.portero ?? p.es_portero ?? false
            ),
            photoUrl: String(p.photoUrl ?? p.foto ?? p.url_foto ?? ""),
            teamShieldUrl: String(
              p.teamShieldUrl ?? p.escudo_equipo ?? p.team_shield ?? ""
            ),
            matches: {
              called: toNumber(
                (p as any).matches?.called ??
                  (p as any).llamados ??
                  (p as any).partidos?.llamados ??
                  0
              ),
              starter: toNumber(
                (p as any).matches?.starter ??
                  (p as any).titular ??
                  (p as any).partidos?.titular ??
                  0
              ),
              substitute: toNumber(
                (p as any).matches?.substitute ??
                  (p as any).suplente ??
                  (p as any).partidos?.suplente ??
                  0
              ),
              played: toNumber(
                (p as any).matches?.played ??
                  (p as any).jugados ??
                  (p as any).partidos?.jugados ??
                  0
              ),
              totalGoals: toNumber(
                (p as any).matches?.totalGoals ??
                  (p as any).goles ??
                  (p as any).partidos?.goles_total ??
                  0
              ),
              goalsPerMatch: Number(
                (p as any).matches?.goalsPerMatch ??
                  (p as any).goles_por_partido ??
                  0
              ),
            },
            cards: {
              yellow: toNumber(
                (p as any).cards?.yellow ??
                  (p as any).amarilla ??
                  (p as any).amarillas ??
                  0
              ),
              red: toNumber((p as any).cards?.red ?? (p as any).roja ?? 0),
              doubleYellow: toNumber(
                (p as any).cards?.doubleYellow ?? (p as any).doble_amarilla ?? 0
              ),
            },
            competitions: ((p as any).competitions ??
              (p as any).competiciones ??
              (p as any).participaciones_competiciones) as any[],
          }));

        // remove players that ended up with empty playerId and name
        const cleanPlayers = players.filter(
          (pl) =>
            (pl.playerId && String(pl.playerId).trim() !== "") ||
            (pl.name && String(pl.name).trim() !== "")
        );

        const team: Team = {
          status: String(raw?.status ?? raw?.estado ?? ""),
          sessionOk: String(raw?.sessionOk ?? raw?.sesion_ok ?? ""),
          teamCode: String(raw?.teamCode ?? raw?.codigo_equipo ?? teamId),
          clubCode: String(raw?.clubCode ?? raw?.codigo_club ?? ""),
          accessKey: String(raw?.accessKey ?? raw?.clave_acceso ?? ""),
          teamName: String(
            raw?.teamName ?? raw?.nombre_equipo ?? raw?.nombre ?? ""
          ),
          clubShield: String(raw?.clubShield ?? raw?.escudo_club ?? ""),
          clubName: String(raw?.clubName ?? raw?.nombre_club ?? ""),
          category: String(raw?.category ?? raw?.categoria ?? ""),
          categoryCode: String(
            raw?.categoryCode ?? raw?.codigo_categoria ?? ""
          ),
          website: String(raw?.website ?? raw?.portal_web ?? ""),
          fieldCode: String(raw?.fieldCode ?? raw?.codigo_campo ?? ""),
          field: String(raw?.field ?? raw?.campo ?? ""),
          fieldPhoto: String(
            raw?.fieldPhoto ?? raw?.foto_campo ?? raw?.fieldPhoto ?? ""
          ),
          trainingField: String(
            raw?.trainingField ?? raw?.campo_entrenamiento ?? ""
          ),
          correspondenceHolder: String(
            raw?.correspondenceHolder ?? raw?.titular_correspondencia ?? ""
          ),
          correspondenceTitle: String(
            raw?.correspondenceTitle ?? raw?.tratamiento_correspondencia ?? ""
          ),
          correspondenceAddress: String(
            raw?.correspondenceAddress ?? raw?.domicilio_correspondencia ?? ""
          ),
          correspondenceCity: String(
            raw?.correspondenceCity ?? raw?.localidad_correspondencia ?? ""
          ),
          correspondenceProvince: String(
            raw?.correspondenceProvince ?? raw?.provincia_correspondencia ?? ""
          ),
          correspondencePostalCode: String(
            raw?.correspondencePostalCode ??
              raw?.codigo_postal_correspondencia ??
              ""
          ),
          correspondenceEmail: String(
            raw?.correspondenceEmail ?? raw?.email_correspondencia ?? ""
          ),
          phones: String(raw?.phones ?? raw?.telefonos ?? ""),
          playDay: String(raw?.playDay ?? raw?.jugar_dia ?? ""),
          playSchedule: String(raw?.playSchedule ?? raw?.jugar_horario ?? ""),
          fax: String(raw?.fax ?? raw?.fax ?? ""),
          delegates: (
            raw?.delegates ??
            raw?.delegados_equipo ??
            raw?.delegados ??
            []
          ).map((d: any) => ({
            delegateCode: String(
              d?.delegateCode ?? d?.cod_delegado ?? d?.id ?? ""
            ),
            name: d?.name ?? d?.nombre ?? "",
          })),
          assistants: (
            raw?.assistants ??
            raw?.auxiliares_equipo ??
            raw?.auxiliares ??
            []
          ).map((a: any) => ({
            assistantCode: String(
              a?.assistantCode ?? a?.cod_auxiliar ?? a?.id ?? ""
            ),
            name: a?.name ?? a?.nombre ?? "",
          })),
          coaches: (
            raw?.coaches ??
            raw?.tecnicos_equipo ??
            raw?.tecnicos ??
            []
          ).map((t: any) => ({
            coachCode: String(t?.coachCode ?? t?.cod_tecnico ?? t?.id ?? ""),
            name: t?.name ?? t?.nombre ?? "",
          })),
          players: cleanPlayers,
        };

        return team;
      } catch (err) {
        lastErr = err;
        attempt++;
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastErr;
  }

  async getTeamAgeSummary(teamId: string, seasonId?: string) {
    const q = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";
    const res = await client.get(
      `teams/${encodeURIComponent(teamId)}/age-summary${q}`
    );
    return res.data as Array<{ age: number; total: number }>;
  }

  async getTeamParticipationSummary(teamId: string, season?: string) {
    const q = season ? `?season=${encodeURIComponent(season)}` : "";
    const res = await client.get(
      `teams/${encodeURIComponent(teamId)}/participation-summary${q}`
    );
    const raw = res.data;
    return (raw || []).map((r: any) => ({
      competitionName: r?.competitionName ?? r?.competition_name ?? "",
      groupName: r?.groupName ?? r?.group_name ?? "",
      teamName: r?.teamName ?? r?.team_name ?? "",
      teamCode: r?.teamCode ?? r?.team_code ?? "",
      teamPoints: r?.teamPoints ?? r?.team_points ?? 0,
      count: r?.count ?? (r?.players || []).length ?? 0,
      players: (r?.players || []).map((p: any) => ({
        playerId: p?.playerId ?? p?.player_id ?? p?.id ?? "",
        name: p?.name ?? p?.nombre ?? "",
      })),
    }));
  }

  async getTeamGoalSectors(
    teamId: string,
    params?: {
      temporada?: string;
      competicion?: string;
      grupo?: string;
      tipojuego?: string;
    }
  ) {
    const q = new URLSearchParams();
    if (params?.temporada) q.append("temporada", params.temporada);
    if (params?.competicion) q.append("competicion", params.competicion);
    if (params?.grupo) q.append("grupo", params.grupo);
    if (params?.tipojuego) q.append("tipojuego", params.tipojuego);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await client.get(
      `teams/${encodeURIComponent(teamId)}/goal-sectors${qs}`
    );
    return res.data as {
      teamCode: string;
      matchesProcessed: number;
      sectors: Array<{
        startMinute: number;
        endMinute: number;
        goalsFor: number;
        goalsAgainst: number;
      }>;
    };
  }

  async getTeamCallups(
    teamId: string,
    params?: { seasonId?: string; competitionId?: string; groupId?: string }
  ): Promise<TeamCallupsResponse> {
    const q = new URLSearchParams();
    if (params?.seasonId) q.append("seasonId", params?.seasonId);
    if (params?.competitionId) q.append("competitionId", params?.competitionId);
    if (params?.groupId) q.append("groupId", params?.groupId);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await client.get(
      `teams/${encodeURIComponent(teamId)}/callups${qs}`
    );
    return res.data as TeamCallupsResponse;
  }

  async getTeamsGoalSectorsComparison(params: {
    teamCode: string; // base path param (first team in path)
    competitionId?: string;
    groupId?: string;
    teamCode1?: string;
    teamCode2?: string;
  }) {
    const { teamCode, competitionId, groupId, teamCode1, teamCode2 } = params;
    const q = new URLSearchParams();
    if (competitionId) q.append("competitionId", competitionId);
    if (groupId) q.append("groupId", groupId);
    if (teamCode1) q.append("teamCode1", teamCode1);
    if (teamCode2) q.append("teamCode2", teamCode2);
    const qs = q.toString() ? `?${q.toString()}` : "";

    const res = await client.get(
      `teams/${encodeURIComponent(teamCode)}/goal-sectors${qs}`
    );

    return res.data as TeamsGoalSectorsComparison;
  }
}

export const teamService = new TeamService();
