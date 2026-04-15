// Backward compatibility layer - Re-exports from Federation services
import {
  client,
  playerService,
  teamService,
  classificationService,
  competitionService,
  calendarService,
  actaService,
  scoreService,
  settingsService,
} from "./Federation";

// Re-export client and utilities
export { registerNavigate } from "./Federation";

// Player methods
export const getPlayer = (playerId: string, params?: { seasonId?: string }) =>
  playerService.getPlayer(playerId, params);

// Team methods
export const getPlayersByTeam = (teamId: string) =>
  teamService.getPlayersByTeam(teamId);

export const getTeamAgeSummary = (teamId: string, seasonId?: string) =>
  teamService.getTeamAgeSummary(teamId, seasonId);

export const getTeamParticipationSummary = (teamId: string, season?: string) =>
  teamService.getTeamParticipationSummary(teamId, season);

export const getTeamGoalSectors = (
  teamId: string,
  params?: {
    temporada?: string;
    competicion?: string;
    grupo?: string;
    tipojuego?: string;
  },
) => teamService.getTeamGoalSectors(teamId, params);

export const getTeamCallups = (
  teamId: string,
  params?: { seasonId?: string; competitionId?: string; groupId?: string },
) => teamService.getTeamCallups(teamId, params);

export const getTeamsGoalSectorsComparison = (params: {
  teamCode: string;
  competitionId?: string;
  groupId?: string;
  teamCode1?: string;
  teamCode2?: string;
}) => teamService.getTeamsGoalSectorsComparison(params);

// Classification methods
export const getTeamsForClassification = (params: {
  season?: string;
  competition?: string;
  group?: string;
  playType?: string;
}) => classificationService.getTeamsForClassification(params);

// Competition methods
export const getCompetitions = () => competitionService.getCompetitions();

export const getGroups = (competitionId?: string) =>
  competitionService.getGroups(competitionId);

// Calendar methods
export const getCalendar = (params?: {
  season?: string;
  competition?: string;
  group?: string;
  playType?: string;
}) => calendarService.getCalendar(params);

export const getCalendarMatchDay = (params: {
  season?: string;
  group: string;
  round: number;
  playType?: string;
}) =>
  calendarService.getCalendarMatchDay({
    season: params.season,
    group: params.group,
    round: params.round,
    playType: params.playType,
  });

export const getTeamMatches = (
  teamId: string,
  params?: {
    season?: string;
    competition?: string;
    group?: string;
    playType?: string;
  },
) => calendarService.getTeamMatches(teamId, params);

// Acta methods
export const getActa = (
  codacta: string,
  params?: { temporada?: string; competicion?: string; grupo?: string },
) => actaService.getActa(codacta, params);

/**
 * Builds a map { [codjugador]: string[] } of positions found across all actas
 * for the given team. Fetches actas from every match in the calendar jornada by
 * jornada and collects whatever `posicion` the coaches registered. If a player
 * has appeared in several positions, all of them are returned.
 */
export const getPlayerPositionsFromActas = async (
  teamId: string,
  params?: { season?: string; competition?: string; group?: string },
): Promise<Record<string, string[]>> => {
  const matches: any[] = await calendarService.getTeamMatches(teamId, params);

  // Collect unique codactas
  const seen = new Set<string>();
  const codactas: string[] = [];
  for (const m of matches) {
    const match = m?.match ?? m;
    const cod = String(
      match?.codacta ??
        match?.matchRecordCode ??
        match?.cod_acta ??
        match?.acta ??
        "",
    ).trim();
    if (cod && !seen.has(cod)) {
      seen.add(cod);
      codactas.push(cod);
    }
  }

  const positionsMap: Record<string, Set<string>> = {};

  // Fetch in parallel batches to avoid flooding the API
  const BATCH = 5;
  for (let i = 0; i < codactas.length; i += BATCH) {
    const batch = codactas.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((cod) => actaService.getActa(cod)),
    );
    for (const res of results) {
      if (res.status !== "fulfilled") continue;
      const acta = res.value as any;
      if (!acta) continue;

      const localCode = String(acta.codigo_equipo_local ?? "").trim();
      const visitCode = String(acta.codigo_equipo_visitante ?? "").trim();
      const tid = String(teamId).trim();

      let players: any[] = [];
      if (localCode === tid) {
        players = acta.jugadores_equipo_local ?? [];
      } else if (visitCode === tid) {
        players = acta.jugadores_equipo_visitante ?? [];
      } else {
        // Fallback: include both sides (team code mismatch can happen with
        // legacy string ids vs numeric ids)
        players = [
          ...(acta.jugadores_equipo_local ?? []),
          ...(acta.jugadores_equipo_visitante ?? []),
        ];
      }

      for (const p of players) {
        const pid = String(p?.codjugador ?? "").trim();
        if (!pid) continue;
        const pos = String(
          p?.posicion ?? p?.posicion_jugador_abreviatura ?? "",
        ).trim();
        if (!pos) continue;
        if (!positionsMap[pid]) positionsMap[pid] = new Set<string>();
        positionsMap[pid].add(pos);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(positionsMap).map(([k, v]) => [k, Array.from(v)]),
  );
};

// Score methods
export const getGoleadores = (competitionId: string, groupId: string) =>
  scoreService.getGoleadores(competitionId, groupId);

// Settings methods
export { settingsService };

// In-memory cache + in-flight dedupe for getSettingsForUser
const _settingsCache = new Map<string, any>();
const _settingsInFlight = new Map<string, Promise<any>>();

export const getSettingsForUser = (userId?: string, signal?: AbortSignal) => {
  const key = userId || "__anonymous__";

  if (_settingsCache.has(key)) {
    return Promise.resolve(_settingsCache.get(key));
  }

  if (_settingsInFlight.has(key)) {
    return _settingsInFlight.get(key)!;
  }

  const p = settingsService
    .getSettingsForUser(userId, signal)
    .then((res: any) => {
      _settingsCache.set(key, res);
      _settingsInFlight.delete(key);
      return res;
    })
    .catch((err: any) => {
      _settingsInFlight.delete(key);
      throw err;
    });

  _settingsInFlight.set(key, p);
  return p;
};

if (typeof window !== "undefined") {
  window.addEventListener("rffm.saved_combinations_changed", () => {
    _settingsCache.clear();
  });
}

export default client;
