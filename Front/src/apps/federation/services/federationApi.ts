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
export const getGoleadores = (competitionId: string, gropuId: string) =>
  scoreService.getGoleadores(competitionId, gropuId);

export default client;
