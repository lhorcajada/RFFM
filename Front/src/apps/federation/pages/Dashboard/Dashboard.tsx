import SettingsIcon from "@mui/icons-material/Settings";
import GroupIcon from "@mui/icons-material/Group";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
// import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HomeIcon from "@mui/icons-material/Home";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import DashboardCard from "../../../../shared/components/ui/DashboardCard/DashboardCard";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import styles from "./Dashboard.module.css";
import { coachAuthService } from "../../../coach/services/authService";
import { useEffect } from "react";

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    if (!coachAuthService.isAuthenticated()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return (
    <BaseLayout appTitle="Futbol Base - Federación de Fútbol de Madrid ">
      <ContentLayout
        title="Panel de Control"
        subtitle="Resumen y accesos rápidos"
        actionBar={
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
            className={styles.homeButton}
          >
            Volver al inicio
          </Button>
        }
      >
        <div className={styles.contentWrap}>
          <div className={styles.cards}>
            <DashboardCard
              title="Plantilla"
              description="Accede a la plantilla de jugadores."
              icon={<GroupIcon className={styles.iconLarge} />}
              to="/federation/get-players"
            />
            <DashboardCard
              title="Calendario"
              description="Consulta el calendario de partidos."
              icon={<CalendarMonthIcon className={styles.iconLarge} />}
              to="/federation/calendar"
            />
            <DashboardCard
              title="Jornada"
              description="Partidos de la jornada de tus equipos."
              icon={<EventAvailableIcon className={styles.iconLarge} />}
              to="/federation/matchday"
            />
            <DashboardCard
              title="Clasificación"
              description="Ver la clasificación actual."
              icon={<LeaderboardIcon className={styles.iconLarge} />}
              to="/federation/classification"
            />
            <DashboardCard
              title="Goleadores"
              description="Listado de máximos goleadores."
              icon={<SportsSoccerIcon className={styles.iconLarge} />}
              to="/federation/goleadores"
            />
            <DashboardCard
              title="Configuración"
              description="Ajustes y preferencias de la aplicación."
              icon={<SettingsIcon className={styles.iconLarge} />}
              to="/federation/settings"
            />
            <DashboardCard
              title="Convocatorias"
              description="Ver convocatorias por jugador."
              icon={<HowToRegIcon className={styles.iconLarge} />}
              to="/federation/callups"
            />
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
