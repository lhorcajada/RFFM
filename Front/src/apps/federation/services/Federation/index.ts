// Re-export all services for easy access
export { playerService, PlayerService } from "./PlayerService";
export { teamService, TeamService } from "./TeamService";
export {
  classificationService,
  ClassificationService,
} from "./ClassificationService";
export { competitionService, CompetitionService } from "./CompetitionService";
export { calendarService, CalendarService } from "./CalendarService";
export { actaService, ActaService } from "./ActaService";
export { scoreService, ScoreService } from "./ScoreService";
export {
  client,
  registerNavigate,
  DEFAULT_RETRIES,
} from "../../../../core/api/client";
