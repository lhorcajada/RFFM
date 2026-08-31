import GroupIcon from "@mui/icons-material/Group";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import SummarizeIcon from "@mui/icons-material/Summarize";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import GavelIcon from "@mui/icons-material/Gavel";
import CasinoIcon from "@mui/icons-material/Casino";
import TimelineIcon from "@mui/icons-material/Timeline";
import RuleIcon from "@mui/icons-material/Rule";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FlagIcon from "@mui/icons-material/Flag";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import LauncherTile from "./components/LauncherTile";
import type { TeamResponse } from "../../services/teamService";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import styles from "./TeamDashboardCards.module.css";

interface TeamDashboardCardsProps {
  team: TeamResponse | null;
  selectedSeason: string;
  isPlayer?: boolean;
}

export default function TeamDashboardCards({
  team,
  selectedSeason,
  isPlayer,
}: TeamDashboardCardsProps) {
  const seasonParam = selectedSeason ? `?seasonId=${selectedSeason}` : "";
  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";

  const { hasFeatureAccess } = usePermissions();

  return (
    <div className={styles.grid}>
      {!isPlayer && (
        <LauncherTile
          title="Gestión de usuarios"
          icon={<ManageAccountsIcon />}
          to={team?.id ? `/coach/team-users?teamId=${team.id}` : "/coach/team-users"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Squad) && (
        <LauncherTile
          title="Plantilla"
          icon={<GroupIcon />}
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
          icon={<AssignmentIcon />}
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
          icon={<SummarizeIcon />}
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
          icon={<EventIcon />}
          to={team?.id ? `/coach/convocations?teamId=${team.id}` : "/coach/convocations"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Rivals) && (
        <LauncherTile title="Rivales" icon={<FlagIcon />} to="/coach/rivals" />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Trainings) && (
        <LauncherTile
          title="Entrenamientos"
          icon={<FitnessCenterIcon />}
          to={team?.id ? `/coach/trainings?teamId=${team.id}` : "/coach/trainings"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Injured) && (
        <LauncherTile
          title="Lesionados"
          icon={<LocalHospitalIcon />}
          to={team?.id ? `/coach/injured?teamId=${team.id}` : "/coach/injured"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.GameModel) && (
        <LauncherTile
          title="Modelo de Juego"
          icon={<TimelineIcon />}
          to={team?.id ? `/coach/game-model?teamId=${team.id}` : "/coach/game-model"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.TeamRulesDocument) && (
        <LauncherTile
          title="Normas del Equipo"
          icon={<RuleIcon />}
          to={team?.id ? `/coach/team-rules?teamId=${team.id}` : "/coach/team-rules"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Sanctions) && (
        <LauncherTile
          title="Sanciones"
          icon={<GavelIcon />}
          to={team?.id ? `/coach/sanctions?teamId=${team.id}` : "/coach/sanctions"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Lottery) && (
        <LauncherTile title="Lotería" icon={<CasinoIcon />} to="/coach/lottery" />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.News) && (
        <LauncherTile title="Noticias" icon={<NewspaperIcon />} to="/coach/news" />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.SeasonAccess) && (
        <LauncherTile
          title="Pruebas de acceso"
          icon={<CalendarMonthIcon />}
          to="/coach/season-access"
        />
      )}
    </div>
  );
}
