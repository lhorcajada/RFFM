import LauncherTile from "./components/LauncherTile";
import {
  UsersManagementIllustration,
  SquadIllustration,
  EventsIllustration,
  AttendanceSummaryIllustration,
  MatchesIllustration,
  RivalsIllustration,
  TrainingsIllustration,
  InjuredIllustration,
  GameModelIllustration,
  TeamRulesIllustration,
  SanctionsIllustration,
  LotteryIllustration,
  NewsIllustration,
  SeasonAccessIllustration,
} from "./components/tileIllustrations";
import type { TeamResponse } from "../../services/teamService";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";

interface TeamDashboardCardsProps {
  team: TeamResponse | null;
  selectedSeason: string;
  isPlayer?: boolean;
}

/**
 * Renders the quick-access LauncherTiles only — no wrapping grid element.
 * TeamDashboard.tsx places these as flat siblings of the "Próximos
 * eventos"/"Últimas noticias" widgets inside one shared grid
 * (TeamDashboard.module.css's `.dashboardGrid`) so all cards flow together
 * in the same rows instead of the tiles starting a separate grid below.
 */
export default function TeamDashboardCards({
  team,
  selectedSeason,
  isPlayer,
}: TeamDashboardCardsProps) {
  const seasonParam = selectedSeason ? `?seasonId=${selectedSeason}` : "";
  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";

  const { hasFeatureAccess } = usePermissions();

  return (
    <>
      {!isPlayer && (
        <LauncherTile
          title="Gestión de usuarios"
          illustration={<UsersManagementIllustration />}
          gradient="linear-gradient(135deg, #37474f 0%, #455a64 50%, #263238 100%)"
          to={team?.id ? `/coach/team-users?teamId=${team.id}` : "/coach/team-users"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Squad) && (
        <LauncherTile
          title="Plantilla"
          illustration={<SquadIllustration />}
          gradient="linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #145214 100%)"
          to={
            team?.id
              ? `/coach/squad?teamId=${team.id}${seasonSuffix}`
              : `/coach/squad${seasonParam}`
          }
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Events) && (
        <LauncherTile
          title="Eventos"
          illustration={<EventsIllustration />}
          gradient="linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #0a3880 100%)"
          to={
            team?.id
              ? `/coach/attendance?teamId=${team.id}${seasonSuffix}`
              : `/coach/attendance${seasonParam}`
          }
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.AttendanceSummary) && (
        <LauncherTile
          title="Resumen de asistencias"
          illustration={<AttendanceSummaryIllustration />}
          gradient="linear-gradient(135deg, #00695c 0%, #00897b 50%, #004d40 100%)"
          to={
            team?.id
              ? `/coach/attendance/summary?teamId=${team.id}${seasonSuffix}`
              : `/coach/attendance/summary${seasonParam}`
          }
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Convocations) && (
        <LauncherTile
          title="Partidos"
          illustration={<MatchesIllustration />}
          gradient="linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #9c1515 100%)"
          to={team?.id ? `/coach/convocations?teamId=${team.id}` : "/coach/convocations"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Rivals) && (
        <LauncherTile
          title="Rivales"
          illustration={<RivalsIllustration />}
          gradient="linear-gradient(135deg, #e65100 0%, #ef6c00 50%, #bf360c 100%)"
          to="/coach/rivals"
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Trainings) && (
        <LauncherTile
          title="Entrenamientos"
          illustration={<TrainingsIllustration />}
          gradient="linear-gradient(135deg, #2e7d32 0%, #43a047 50%, #1b5e20 100%)"
          to={team?.id ? `/coach/trainings?teamId=${team.id}` : "/coach/trainings"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Injured) && (
        <LauncherTile
          title="Lesionados"
          illustration={<InjuredIllustration />}
          gradient="linear-gradient(135deg, #ad1457 0%, #c2185b 50%, #880e4f 100%)"
          to={team?.id ? `/coach/injured?teamId=${team.id}` : "/coach/injured"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.GameModel) && (
        <LauncherTile
          title="Modelo de Juego"
          illustration={<GameModelIllustration />}
          gradient="linear-gradient(135deg, #4527a0 0%, #5e35b1 50%, #311b92 100%)"
          to={team?.id ? `/coach/game-model?teamId=${team.id}` : "/coach/game-model"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.TeamRulesDocument) && (
        <LauncherTile
          title="Normas del Equipo"
          illustration={<TeamRulesIllustration />}
          gradient="linear-gradient(135deg, #4e342e 0%, #6d4c41 50%, #3e2723 100%)"
          to={team?.id ? `/coach/team-rules?teamId=${team.id}` : "/coach/team-rules"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Sanctions) && (
        <LauncherTile
          title="Sanciones"
          illustration={<SanctionsIllustration />}
          gradient="linear-gradient(135deg, #7f0000 0%, #a30000 50%, #5c0000 100%)"
          to={team?.id ? `/coach/sanctions?teamId=${team.id}` : "/coach/sanctions"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Lottery) && (
        <LauncherTile
          title="Lotería"
          illustration={<LotteryIllustration />}
          gradient="linear-gradient(135deg, #f57f17 0%, #f9a825 50%, #e65100 100%)"
          to="/coach/lottery"
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.News) && (
        <LauncherTile
          title="Noticias"
          illustration={<NewsIllustration />}
          gradient="linear-gradient(135deg, #01579b 0%, #0277bd 50%, #013a63 100%)"
          to="/coach/news"
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.SeasonAccess) && (
        <LauncherTile
          title="Pruebas de acceso"
          illustration={<SeasonAccessIllustration />}
          gradient="linear-gradient(135deg, #006064 0%, #00838f 50%, #004d40 100%)"
          to="/coach/season-access"
        />
      )}
    </>
  );
}
