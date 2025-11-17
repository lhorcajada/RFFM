import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE_URL || "")
  .toString()
  .replace(/\/?$/, "/");

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 60000);
const DEFAULT_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 3);
const client = axios.create({ baseURL: BASE, timeout: DEFAULT_TIMEOUT });

export async function getPlayer(playerId: string) {
  const res = await client.get(`players/${encodeURIComponent(playerId)}`);
  return res.data;
}

import type { PlayersByTeamResponse, TeamResponse } from "../types/player";

export async function getPlayersByTeam(
  teamId: string
): Promise<TeamResponse | PlayersByTeamResponse> {
  const maxAttempts = DEFAULT_RETRIES;
  let attempt = 0;
  let lastErr: any = null;
  while (attempt < maxAttempts) {
    try {
      // New API endpoint returning full team info including players
      const res = await client.get(`teams/${encodeURIComponent(teamId)}`);
      const raw = res.data;

      // If API already returns an array or { players: [...] } keep backward compatibility
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.players))
        return { players: raw.players } as PlayersByTeamResponse;

      // Map Spanish fields to english-named object
      const team = {
        teamCode: raw?.codigo_equipo ?? raw?.teamCode,
        clubCode: raw?.codigo_club ?? raw?.clubCode,
        accessKey: raw?.clave_acceso ?? raw?.accessKey,
        name: raw?.nombre_equipo ?? raw?.nombre ?? raw?.teamName,
        clubShield: raw?.escudo_club ?? raw?.clubShield,
        clubName: raw?.nombre_club ?? raw?.clubName,
        category: raw?.categoria ?? raw?.category,
        categoryCode: raw?.codigo_categoria ?? raw?.categoryCode,
        website: raw?.portal_web ?? raw?.website,
        fieldCode: raw?.codigo_campo ?? raw?.fieldCode,
        field: raw?.campo ?? raw?.field,
        trainingField: raw?.campo_entrenamiento ?? raw?.trainingField,
        correspondenceName:
          raw?.titular_correspondencia ?? raw?.correspondenceName,
        correspondenceTreatment:
          raw?.tratamiento_correspondencia ?? raw?.correspondenceTreatment,
        address: raw?.domicilio_correspondencia ?? raw?.address,
        locality: raw?.localidad_correspondencia ?? raw?.locality,
        province: raw?.provincia_correspondencia ?? raw?.province,
        postalCode: raw?.codigo_postal_correspondencia ?? raw?.postalCode,
        contactEmail: raw?.email_correspondencia ?? raw?.contactEmail,
        phones: raw?.telefonos ?? raw?.phones,
        playDay: raw?.jugar_dia ?? raw?.playDay,
        playSchedule: raw?.jugar_horario ?? raw?.playSchedule,
        fax: raw?.fax ?? raw?.faxNumber,
        delegates: (
          raw?.delegados_equipo ||
          raw?.delegados ||
          raw?.delegates ||
          []
        ).map((d: any) => ({
          id: d?.cod_delegado ?? d?.id,
          name: d?.nombre ?? d?.name,
        })),
        assistants: (
          raw?.auxiliares_equipo ||
          raw?.auxiliares ||
          raw?.assistants ||
          []
        ).map((a: any) => ({
          id: a?.cod_auxiliar ?? a?.id,
          name: a?.nombre ?? a?.name,
        })),
        technicians: (
          raw?.tecnicos_equipo ||
          raw?.tecnicos ||
          raw?.technicians ||
          []
        ).map((t: any) => ({
          id: t?.cod_tecnico ?? t?.cod_tecnico ?? t?.id,
          name: t?.nombre ?? t?.name,
        })),
      };

      const players = (
        raw?.jugadores_equipo ||
        raw?.jugadores ||
        raw?.players ||
        []
      ).map((j: any) => ({
        playerId: j?.cod_jugador ?? j?.playerId ?? j?.id,
        name: j?.nombre ?? j?.name,
      }));

      const mapped: TeamResponse = { team, players };
      return mapped;
    } catch (err) {
      lastErr = err;
      attempt++;
      const delay = 500 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function getTeamsForClassification(params: {
  season?: string;
  competition?: string;
  group?: string;
  playType?: string;
}) {
  const q = new URLSearchParams();
  if (params.season) q.append("season", params.season);
  if (params.competition) q.append("competition", params.competition);
  if (params.group) q.append("group", params.group);
  if (params.playType) q.append("playType", params.playType);
  const res = await client.get(`teams?${q.toString()}`);
  const raw = res.data;
  // expected raw to be an array of classifications or wrapped
  const list = Array.isArray(raw)
    ? raw
    : raw?.teams ?? raw?.classifications ?? [];
  return (list || []).map((r: any) => ({
    color: r?.color ?? r?.color_equipo ?? "",
    position: r?.posicion ?? r?.position ?? "",
    imageUrl: r?.url_img ?? r?.imageUrl ?? r?.escudo_equipo ?? "",
    teamId: r?.codequipo ?? r?.teamId ?? r?.codigo_equipo ?? "",
    teamName: r?.nombre ?? r?.teamName ?? r?.nombre_equipo ?? "",
    played: r?.jugados ?? "",
    won: r?.ganados ?? "",
    lost: r?.perdidos ?? "",
    drawn: r?.empatados ?? "",
    penalties: r?.penaltis ?? "",
    goalsFor: r?.goles_a_favor ?? "",
    goalsAgainst: r?.goles_en_contra ?? "",
    homePlayed: r?.jugados_casa ?? "",
    homeWon: r?.ganados_casa ?? "",
    homeDrawn: r?.empatados_casa ?? "",
    homePenaltyWins: r?.ganados_penalti_casa ?? "",
    homeLost: r?.perdidos_casa ?? "",
    awayPlayed: r?.jugados_fuera ?? "",
    awayWon: r?.ganados_fuera ?? "",
    awayDrawn: r?.empatados_fuera ?? "",
    awayPenaltyWins: r?.ganados_penalti_fuera ?? "",
    awayLost: r?.perdidos_fuera ?? "",
    points: r?.puntos ?? "",
    sanctionPoints: r?.puntos_sancion ?? "",
    homePoints: r?.puntos_local ?? "",
    awayPoints: r?.puntos_visitante ?? "",
    showCoefficient: r?.mostrar_coeficiente ?? "",
    coefficient: r?.coeficiente ?? "",
    matchStreaks:
      (r?.racha_partidos ?? r?.matchStreaks ?? []).map((s: any) => ({
        type: s?.tipo ?? s?.type ?? "",
        color: s?.color ?? s?.color ?? "",
      })) || [],
  }));
}

export async function getCompetitions() {
  const res = await client.get("competitions");
  return res.data;
}

export async function getGroups(competitionId?: string) {
  const q = competitionId
    ? `?competitionId=${encodeURIComponent(competitionId)}`
    : "";
  const res = await client.get(`groups${q}`);
  return res.data;
}

export async function getTeamAgeSummary(teamId: string, seasonId?: string) {
  const q = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";
  const res = await client.get(`teams/${encodeURIComponent(teamId)}/age-summary${q}`);
  return res.data as Array<{ age: number; total: number }>;
}

export default client;
