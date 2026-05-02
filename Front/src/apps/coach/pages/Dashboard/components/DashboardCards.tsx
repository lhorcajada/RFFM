import { CircularProgress } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import GroupIcon from "@mui/icons-material/Group";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import GavelIcon from "@mui/icons-material/Gavel";
import CasinoIcon from "@mui/icons-material/Casino";
import TimelineIcon from "@mui/icons-material/Timeline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FlagIcon from "@mui/icons-material/Flag";
import DashboardCard from "../../../../../shared/components/ui/DashboardCard/DashboardCard";
import type { TeamResponse } from "../../../services/teamService";
import styles from "../Dashboard.module.css";

interface DashboardCardsProps {
  team: TeamResponse | null;
  teamTitleNode: React.ReactNode | null;
  selectedSeason: string;
  loadingTeam: boolean;
}

export default function DashboardCards({
  team,
  teamTitleNode,
  selectedSeason,
  loadingTeam,
}: DashboardCardsProps) {
  const seasonParam = selectedSeason ? `?seasonId=${selectedSeason}` : "";
  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";

  return (
    <div className={styles.container}>
      <div className={styles.cards}>
        <DashboardCard
          title="Configuración"
          description="Ajustes y preferencias."
          icon={<SettingsIcon style={{ fontSize: 40 }} />}
          to="/coach/settings"
        />
        <DashboardCard
          title="Clubs"
          description="Gestión de clubs."
          icon={<SportsFootballIcon style={{ fontSize: 40 }} />}
          to={`/coach/clubs${seasonParam}`}
        />
        <DashboardCard
          title="Prep. temporada"
          description="Importar plantillas de federación y planificar la nueva temporada."
          icon={<CalendarMonthIcon style={{ fontSize: 40 }} />}
          to="/coach/season-prep"
        />

        {!!teamTitleNode && (
          <>
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
            <DashboardCard
              title="Partidos"
              description="Gestión de convocatorias."
              icon={<EventIcon style={{ fontSize: 40 }} />}
              to={team?.id ? `/coach/convocations?teamId=${team.id}` : "/coach/convocations"}
            />
            <DashboardCard
              title="Rivales"
              description="Añadir y gestionar rivales."
              icon={<FlagIcon style={{ fontSize: 40 }} />}
              to="/coach/rivals"
            />
            <DashboardCard
              title="Entrenamientos"
              description="Planificación de entrenamientos."
              icon={<FitnessCenterIcon style={{ fontSize: 40 }} />}
              to={team?.id ? `/coach/trainings?teamId=${team.id}` : "/coach/trainings"}
            />
            <DashboardCard
              title="Lesionados"
              description="Control de lesionados."
              icon={<LocalHospitalIcon style={{ fontSize: 40 }} />}
              to={team?.id ? `/coach/injured?teamId=${team.id}` : "/coach/injured"}
            />
            <DashboardCard
              title="Modelo de Juego"
              description="Estrategia y tácticas."
              icon={<TimelineIcon style={{ fontSize: 40 }} />}
              to={team?.id ? `/coach/game-model?teamId=${team.id}` : "/coach/game-model"}
            />
            <DashboardCard
              title="Sanciones"
              description="Registro de sanciones."
              icon={<GavelIcon style={{ fontSize: 40 }} />}
              to={team?.id ? `/coach/sanctions?teamId=${team.id}` : "/coach/sanctions"}
            />
            <DashboardCard
              title="Lotería"
              description="Sistema de lotería."
              icon={<CasinoIcon style={{ fontSize: 40 }} />}
              to="/coach/lottery"
            />
            <DashboardCard
              title="Noticias"
              description="Últimas noticias y comunicados."
              icon={<NewspaperIcon style={{ fontSize: 40 }} />}
              to="/coach/news"
            />
          </>
        )}
      </div>

      {loadingTeam && (
        <div className={styles.spinnerOverlay}>
          <CircularProgress />
        </div>
      )}
    </div>
  );
}
