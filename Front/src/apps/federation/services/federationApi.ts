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
export const getPlayer = (playerId: string) =>
  playerService.getPlayer(playerId);

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
  }
) => teamService.getTeamGoalSectors(teamId, params);

export const getTeamCallups = (
  teamId: string,
  params?: { seasonId?: string; competitionId?: string; groupId?: string }
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

export const getTeamMatches = (
  teamId: string,
  params?: {
    season?: string;
    competition?: string;
    group?: string;
    playType?: string;
  }
) => calendarService.getTeamMatches(teamId, params);

// Acta methods
export const getActa = (
  codacta: string,
  params?: { temporada?: string; competicion?: string; grupo?: string }
) => actaService.getActa(codacta, params);

// Score methods
export const getGoleadores = (competitionId: string, groupId: string) =>
  scoreService.getGoleadores(competitionId, groupId);

// Settings methods
export { settingsService };

// In-memory cache + in-flight dedupe for getSettingsForUser
const _settingsCache = new Map<string, any>();
const _settingsInFlight = new Map<string, Promise<any>>();

export const getSettingsForUser = (userId?: string) => {
  const key = userId || "__anonymous__";

  if (_settingsCache.has(key)) {
    return Promise.resolve(_settingsCache.get(key));
  }

  if (_settingsInFlight.has(key)) {
    return _settingsInFlight.get(key)!;
  }

  const p = settingsService
    .getSettingsForUser(userId)
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
