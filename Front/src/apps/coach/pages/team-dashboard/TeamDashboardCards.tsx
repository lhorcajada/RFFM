import GroupIcon from "@mui/icons-material/Group";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import SummarizeIcon from "@mui/icons-material/Summarize";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import GavelIcon from "@mui/icons-material/Gavel";
import CasinoIcon from "@mui/icons-material/Casino";
import TimelineIcon from "@mui/icons-material/Timeline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FlagIcon from "@mui/icons-material/Flag";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import DashboardCard from "../../../../shared/components/ui/DashboardCard/DashboardCard";
import type { TeamResponse } from "../../services/teamService";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import styles from "../Dashboard/Dashboard.module.css";

interface TeamDashboardCardsProps {
  team: TeamResponse | null;
  selectedSeason: string;
  isPlayer?: boolean;
}

export default function TeamDashboardCards({
  team,
  selectedSeason,
}: TeamDashboardCardsProps) {
  const seasonParam = selectedSeason ? `?seasonId=${selectedSeason}` : "";
  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";

  const { hasFeatureAccess } = usePermissions();

  return (
    <div className={styles.cards}>
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Squad) && (
        <DashboardCard
          title="Plantilla"
          description="Gestión de jugadores."
          icon={<GroupIcon style={{ fontSize: 40 }} />}
          to={
            team?.id
              ? `/coach/squad?teamId=${team.id}${seasonSuffix}`
              : `/coach/squad${seasonParam}`
          }
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Events) && (
        <DashboardCard
          title="Eventos"
          description="Eventos deportivos del equipo."
          icon={<AssignmentIcon style={{ fontSize: 40 }} />}
          to={
            team?.id
              ? `/coach/attendance?teamId=${team.id}${seasonSuffix}`
              : `/coach/attendance${seasonParam}`
          }
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.AttendanceSummary) && (
        <DashboardCard
          title="Resumen de asistencias"
          description="Resumen global de asistencias a entrenamientos y partidos."
          icon={<SummarizeIcon style={{ fontSize: 40 }} />}
          to={
            team?.id
              ? `/coach/attendance/summary?teamId=${team.id}${seasonSuffix}`
              : `/coach/attendance/summary${seasonParam}`
          }
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Convocations) && (
        <DashboardCard
          title="Partidos"
          description="Gestión de convocatorias."
          icon={<EventIcon style={{ fontSize: 40 }} />}
          to={team?.id ? `/coach/convocations?teamId=${team.id}` : "/coach/convocations"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Rivals) && (
        <DashboardCard
          title="Rivales"
          description="Añadir y gestionar rivales."
          icon={<FlagIcon style={{ fontSize: 40 }} />}
          to="/coach/rivals"
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Trainings) && (
        <DashboardCard
          title="Entrenamientos"
          description="Planificación de entrenamientos."
          icon={<FitnessCenterIcon style={{ fontSize: 40 }} />}
          to={team?.id ? `/coach/trainings?teamId=${team.id}` : "/coach/trainings"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Injured) && (
        <DashboardCard
          title="Lesionados"
          description="Control de lesionados."
          icon={<LocalHospitalIcon style={{ fontSize: 40 }} />}
          to={team?.id ? `/coach/injured?teamId=${team.id}` : "/coach/injured"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.GameModel) && (
        <DashboardCard
          title="Modelo de Juego"
          description="Estrategia y tácticas."
          icon={<TimelineIcon style={{ fontSize: 40 }} />}
          to={team?.id ? `/coach/game-model?teamId=${team.id}` : "/coach/game-model"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Sanctions) && (
        <DashboardCard
          title="Sanciones"
          description="Registro de sanciones."
          icon={<GavelIcon style={{ fontSize: 40 }} />}
          to={team?.id ? `/coach/sanctions?teamId=${team.id}` : "/coach/sanctions"}
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.Lottery) && (
        <DashboardCard
          title="Lotería"
          description="Sistema de lotería."
          icon={<CasinoIcon style={{ fontSize: 40 }} />}
          to="/coach/lottery"
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.News) && (
        <DashboardCard
          title="Noticias"
          description="Últimas noticias y comunicados."
          icon={<NewspaperIcon style={{ fontSize: 40 }} />}
          to="/coach/news"
        />
      )}
      {hasFeatureAccess(COACH_FEATURE_ROUTES.SeasonAccess) && (
        <DashboardCard
          title="Pruebas de acceso"
          description="Temporada que viene."
          icon={<CalendarMonthIcon style={{ fontSize: 40 }} />}
          to="/coach/season-access"
        />
      )}
    </div>
  );
}
