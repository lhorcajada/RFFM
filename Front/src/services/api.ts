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

import type { Team } from "../types/team";
import type {
  ClassificationResponse,
  ClassificationTeam,
} from "../types/classification";
import type { Acta } from "../types/acta";
import type {
  CalendarResponse,
  MatchEntry,
  Round,
  MatchApiResponse,
  MatchDay,
  MatchApiMatch,
} from "../types/match";

// Local raw shapes (incoming API may use Spanish or English fields)
interface RawPlayer {
  playerId?: string | number;
  cod_jugador?: string | number;
  id?: string | number;
  seasonId?: string | number;
  temporada?: string | number;
  season?: string | number;
  name?: string;
  nombre?: string;
  age?: number | string;
  ace?: number | string;
  birthYear?: number | string;
  anio_nacimiento?: number | string;
  anio_nac?: number | string;
  team?: string;
  equipo?: string;
  teamCode?: string | number;
  codigo_equipo?: string | number;
  teamCategory?: string;
  categoria?: string;
  jerseyNumber?: string | number;
  dorsal?: string | number;
  numero?: string | number;
  position?: string;
  posicion?: string;
  isGoalkeeper?: boolean;
  portero?: boolean;
  es_portero?: boolean;
  photoUrl?: string;
  foto?: string;
  url_foto?: string;
  teamShieldUrl?: string;
  escudo_equipo?: string;
  team_shield?: string;
  matches?: any;
  partidos?: any;
  cards?: any;
  tarjetas?: any;
  competitions?: any[];
  competiciones?: any[];
  participaciones_competiciones?: any[];
  [key: string]: unknown;
}

interface RawTeam {
  // english or spanish variants
  players?: RawPlayer[];
  jugadores_equipo?: RawPlayer[];
  jugadores?: RawPlayer[];
  delegates?: any[];
  delegados_equipo?: any[];
  delegados?: any[];
  assistants?: any[];
  auxiliares_equipo?: any[];
  auxiliares?: any[];
  coaches?: any[];
  tecnicos_equipo?: any[];
  tecnicos?: any[];
  [key: string]: unknown;
}

export async function getPlayersByTeam(teamId: string): Promise<Team> {
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

      const players = (playersArr || []).map((p: RawPlayer) => ({
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
        categoryCode: String(raw?.categoryCode ?? raw?.codigo_categoria ?? ""),
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
        players: players,
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
  const res = await client.get(`classification?${q.toString()}`);
  const raw = res.data as ClassificationResponse | any;
  const list: ClassificationTeam[] = Array.isArray(raw)
    ? raw
    : raw?.teams ?? raw?.classifications ?? [];

  return (list || []).map((r: ClassificationTeam) => {
    const parseNum = (v: any) => {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };

    return {
      color: r?.color ?? "",
      position: parseNum(r?.position ?? r?.posicion ?? 0),
      imageUrl: r?.imageUrl ?? r?.url_img ?? r?.escudo_equipo ?? "",
      teamId: r?.teamId ?? r?.codequipo ?? r?.codigo_equipo ?? "",
      teamName: r?.teamName ?? r?.nombre ?? r?.nombre_equipo ?? "",
      played: parseNum(r?.played ?? r?.jugados ?? 0),
      won: parseNum(r?.won ?? r?.ganados ?? 0),
      lost: parseNum(r?.lost ?? r?.perdidos ?? 0),
      drawn: parseNum(r?.drawn ?? r?.empatados ?? 0),
      penalties: parseNum(r?.penalties ?? r?.penaltis ?? 0),
      goalsFor: parseNum(r?.goalsFor ?? r?.goles_a_favor ?? 0),
      goalsAgainst: parseNum(r?.goalsAgainst ?? r?.goles_en_contra ?? 0),
      homePlayed: parseNum(r?.homePlayed ?? r?.jugados_casa ?? 0),
      homeWon: parseNum(r?.homeWon ?? r?.ganados_casa ?? 0),
      homeDrawn: parseNum(r?.homeDrawn ?? r?.empatados_casa ?? 0),
      homePenaltyWins: parseNum(
        r?.homePenaltyWins ?? r?.ganados_penalti_casa ?? 0
      ),
      homeLost: parseNum(r?.homeLost ?? r?.perdidos_casa ?? 0),
      awayPlayed: parseNum(r?.awayPlayed ?? r?.jugados_fuera ?? 0),
      awayWon: parseNum(r?.awayWon ?? r?.ganados_fuera ?? 0),
      awayDrawn: parseNum(r?.awayDrawn ?? r?.empatados_fuera ?? 0),
      awayPenaltyWins: parseNum(
        r?.awayPenaltyWins ?? r?.ganados_penalti_fuera ?? 0
      ),
      awayLost: parseNum(r?.awayLost ?? r?.perdidos_fuera ?? 0),
      points: parseNum(r?.points ?? r?.puntos ?? 0),
      sanctionPoints: parseNum(r?.sanctionPoints ?? r?.puntos_sancion ?? 0),
      homePoints: parseNum(r?.homePoints ?? r?.puntos_local ?? 0),
      awayPoints: parseNum(r?.awayPoints ?? r?.puntos_visitante ?? 0),
      showCoefficient: Boolean(
        r?.showCoefficient ?? r?.mostrar_coeficiente ?? false
      ),
      coefficient: parseNum(r?.coefficient ?? r?.coeficiente ?? 0),
      matchStreaks:
        (r?.matchStreaks ?? r?.racha_partidos ?? []).map((s: any) => ({
          type: s?.type ?? s?.tipo ?? "",
          color: s?.color ?? s?.color ?? "",
        })) || [],
      raw: r,
    };
  });
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
}): Promise<CalendarResponse | MatchApiResponse> {
  const q = new URLSearchParams();
  if (params?.season) q.append("season", params.season);
  if (params?.competition) q.append("competition", params.competition);
  if (params?.group) q.append("group", params.group);
  if (params?.playType) q.append("playType", params.playType);
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await client.get(`calendar${qs}`);
  const raw = res.data as any;

  // If the API returns the new `matchDays` payload we can return it directly
  if (raw && (raw.matchDays || raw.matchDays === null)) {
    // ensure it's typed as MatchApiResponse
    return raw as MatchApiResponse;
  }

  // Otherwise fall back to previous `rounds`/`jornadas` normalization
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
