import axios from "axios";
export interface Goleador {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName?: string;
  matchesPlayed: number;
  scores: number;
  penaltyScores: number;
  averageScores: number;
}

export async function getGoleadores(
  competitionId: string,
  gropuId: string
): Promise<Goleador[]> {
  const res = await client.get(
    `scores?competitionId=${encodeURIComponent(
      competitionId
    )}&gropuId=${encodeURIComponent(gropuId)}`
  );
  return res.data as Goleador[];
}

const BASE = (import.meta.env.VITE_API_BASE_URL || "")
  .toString()
  .replace(/\/?$/, "/");

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 60000);
const DEFAULT_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 3);
const client = axios.create({ baseURL: BASE, timeout: DEFAULT_TIMEOUT });

// navigation helper: React app can register a navigate function (e.g. from useNavigate)
let navigateTo: ((path: string) => void) | null = null;
export function registerNavigate(fn: (path: string) => void) {
  navigateTo = fn;
}

function gotoErrorPage(reason?: string) {
  const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  const path = `/error-500${suffix}`;
  try {
    if (navigateTo) {
      navigateTo(path);
      return;
    }
    // fallback: change location
    if (typeof window !== "undefined") window.location.href = path;
  } catch (e) {
    // no-op
  }
}

// Response interceptor to catch 500 internal server errors
client.interceptors.response.use(
  (resp) => resp,
  (error) => {
    try {
      const status = error?.response?.status;
      // network error (no response)
      if (!error?.response) {
        console.error("API network error:", error);
        // axios uses code 'ECONNABORTED' for timeouts
        if (error?.code === "ECONNABORTED") {
          gotoErrorPage("timeout");
        } else {
          gotoErrorPage("network");
        }
        return Promise.reject(error);
      }

      if (status === 500) {
        console.error("API 500 error:", error);
        gotoErrorPage();
        return Promise.reject(error);
      }
    } catch (e) {
      // ignore interceptor errors
    }
    return Promise.reject(error);
  }
);

export async function getPlayer(playerId: string) {
  const res = await client.get(`players/${encodeURIComponent(playerId)}`);
  return res.data;
}

import type { PlayersByTeamResponse, TeamResponse } from "../types/player";
import type { Acta } from "../types/acta";
import type { CalendarResponse, MatchEntry, Round } from "../types/match";

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
        seasonId: j?.temporada ?? j?.seasonId ?? j?.season ?? null,
        name: j?.nombre ?? j?.name ?? "",
        age: j?.age ?? j?.ace ?? j?.edad ?? null,
        birthYear: j?.birthYear ?? j?.anio_nacimiento ?? j?.anio_nac ?? null,
        team: j?.equipo ?? j?.team ?? null,
        teamCode: j?.codigo_equipo ?? j?.teamCode ?? null,
        teamCategory:
          j?.categoria_equipo ?? j?.teamCategory ?? j?.categoria ?? null,
        jerseyNumber:
          j?.jerseyNumber ?? j?.dorsal ?? j?.numero ?? j?.number ?? null,
        position:
          j?.posicion ??
          j?.position ??
          j?.puesto ??
          j?.descripcion_posicion ??
          null,
        isGoalkeeper: j?.portero ?? j?.isGoalkeeper ?? j?.es_portero ?? false,
        photoUrl: j?.photoUrl ?? j?.foto ?? j?.url_foto ?? "",
        teamShieldUrl:
          j?.teamShieldUrl ??
          j?.escudo_equipo ??
          j?.team_shield ??
          j?.teamShield ??
          "",
        matches: j?.matches ??
          j?.partidos ??
          j?.estadisticas_partidos ?? {
            called: j?.llamados ?? 0,
            starter: j?.titular ?? 0,
            substitute: j?.suplente ?? 0,
            played: j?.jugados ?? 0,
            totalGoals: j?.goles_total ?? j?.goles ?? 0,
            goalsPerMatch: j?.goles_por_partido ?? 0,
          },
        cards: j?.cards ??
          j?.amarillas_rojas ??
          j?.tarjetas ?? {
            yellow: j?.amarilla ?? j?.yellow ?? 0,
            red: j?.roja ?? j?.red ?? 0,
            doubleYellow: j?.doble_amarilla ?? j?.doubleYellow ?? 0,
          },
        competitions:
          j?.competitions ??
          j?.competiciones ??
          j?.participaciones_competiciones ??
          [],
        teamParticipations: j?.teamParticipations || j?.participaciones || [],
        // keep original raw object for future needs
        raw: j,
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

export async function getCalendar(params?: {
  season?: string;
  competition?: string;
  group?: string;
  playType?: string;
}) {
  const q = new URLSearchParams();
  if (params?.season) q.append("season", params.season);
  if (params?.competition) q.append("competition", params.competition);
  if (params?.group) q.append("group", params.group);
  if (params?.playType) q.append("playType", params.playType);
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await client.get(`calendar${qs}`);
  const raw = res.data as any;

  // Normalize rounds and match entries to our typed model so UI components
  // can rely on consistent field names.
  function normalizeMatch(r: any): MatchEntry {
    if (!r) return {} as MatchEntry;
    return {
      codacta:
        r.codacta ??
        r.cod_acta ??
        r.id_acta ??
        r.idacta ??
        r.actaId ??
        r.acta_id ??
        r.acta,
      codigo_equipo_local:
        r.codigo_equipo_local ??
        r.codigo_local ??
        r.cod_equipo_local ??
        r.localTeamId ??
        r.localCode,
      escudo_equipo_local:
        r.escudo_equipo_local ?? r.escudo_local ?? r.localImage ?? "",
      escudo_equipo_local_url:
        r.escudo_equipo_local_url ??
        r.escudo_equipo_local ??
        r.localImage ??
        "",
      equipo_local:
        r.equipo_local ?? r.localTeamName ?? r.local ?? r.nombre ?? "",
      goles_casa: r.goles_casa ?? r.LocalGoals ?? r.goles ?? null,

      codigo_equipo_visitante:
        r.codigo_equipo_visitante ??
        r.codigo_visitante ??
        r.cod_equipo_visitante ??
        r.awayTeamId ??
        r.awayCode,
      escudo_equipo_visitante:
        r.escudo_equipo_visitante ?? r.escudo_visitante ?? r.awayImage ?? "",
      escudo_equipo_visitante_url:
        r.escudo_equipo_visitante_url ??
        r.escudo_equipo_visitante ??
        r.awayImage ??
        "",
      equipo_visitante:
        r.equipo_visitante ??
        r.awayTeamName ??
        r.visitante ??
        r.nombre_visitante ??
        "",
      goles_visitante: r.goles_visitante ?? r.AwayGoals ?? r.goles_v ?? null,

      codigo_campo: r.codigo_campo ?? r.codigo_campo ?? r.codigoCampo ?? null,
      campo: r.campo ?? r.field ?? "",
      fecha: r.fecha ?? r.date ?? "",
      hora: r.hora ?? r.time ?? r.hour ?? "",

      // keep the original raw object for any other use
      raw: r,
    } as MatchEntry;
  }

  const normalized: CalendarResponse = {
    estado: raw?.estado ?? raw?.status,
    sesion_ok: raw?.sesion_ok,
    competicion: raw?.competicion,
    tipo_competicion: raw?.tipo_competicion,
    grupo: raw?.grupo,
    temporada: raw?.temporada,
    rounds: (raw?.rounds ?? raw?.jornadas ?? []).map((rr: any) => {
      const equipos = (rr.equipos ?? rr.partidos ?? rr.matches ?? []) as any[];
      return {
        codjornada: rr.codjornada ?? rr.cod_jornada ?? rr.id ?? undefined,
        jornada: rr.jornada ?? rr.jornada ?? undefined,
        equipos: (equipos || []).map(normalizeMatch),
        raw: rr,
      } as Round;
    }),
  };

  return normalized;
}

export async function getTeamAgeSummary(teamId: string, seasonId?: string) {
  const q = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";
  const res = await client.get(
    `teams/${encodeURIComponent(teamId)}/age-summary${q}`
  );
  return res.data as Array<{ age: number; total: number }>;
}

export async function getTeamParticipationSummary(
  teamId: string,
  season?: string
) {
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

export async function getTeamGoalSectors(
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

export async function getActa(
  codacta: string,
  params?: { temporada?: string; competicion?: string; grupo?: string }
) {
  // Build query params, using passed params first, then falling back
  // to localStorage selection (`rffm.current_selection`, then saved combinations)
  let temporada = params?.temporada;
  let competicion = params?.competicion;
  let grupo = params?.grupo;
  let equipo: string | undefined = undefined;

  try {
    // Try current selection first
    const cur = localStorage.getItem("rffm.current_selection");
    let combo: any = null;
    if (cur) {
      try {
        combo = JSON.parse(cur);
      } catch (e) {
        combo = null;
      }
    }

    // If no current, load saved combinations and pick primary
    if (!combo) {
      const raw = localStorage.getItem("rffm.saved_combinations_v1");
      const arr = raw ? JSON.parse(raw) : [];
      const primaryId = localStorage.getItem("rffm.primary_combination_id");
      if (Array.isArray(arr) && arr.length > 0) {
        if (primaryId)
          combo = arr.find((c: any) => String(c.id) === String(primaryId));
        if (!combo) combo = arr.find((c: any) => c.isPrimary) || arr[0];
      }
    }

    if (combo) {
      if (!competicion && combo.competition && combo.competition.id)
        competicion = String(combo.competition.id);
      if (!grupo && combo.group && combo.group.id)
        grupo = String(combo.group.id);
      if (combo.team && combo.team.id) equipo = String(combo.team.id);
    }
  } catch (e) {
    // ignore localStorage errors (e.g., SSR or parsing issues)
  }

  const q = new URLSearchParams();
  if (temporada) q.append("temporada", temporada);
  if (competicion) q.append("competicion", competicion);
  if (grupo) q.append("grupo", grupo);
  if (equipo) q.append("equipo", equipo);
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await client.get(`acta/${encodeURIComponent(codacta)}${qs}`);
  return res.data as Acta;
}

export default client;
