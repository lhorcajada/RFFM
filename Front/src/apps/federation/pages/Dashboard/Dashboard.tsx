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
import PageHeader from "../../../../shared/components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
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
    <BaseLayout>
      <PageHeader
        title="Panel de Control"
        subtitle="Resumen y accesos rápidos"
      />
      <div
        style={{
          padding: "24px 24px 16px",
          display: "flex",
          justifyContent: "flex-end",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <Button
          variant="outlined"
          startIcon={<HomeIcon />}
          onClick={() => navigate("/")}
          sx={{ textTransform: "none" }}
        >
          Volver al inicio
        </Button>
      </div>
      <div
        style={{
          padding: "0 24px 24px",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <div className={styles.cards}>
          <DashboardCard
            title="Plantilla"
            description="Accede a la plantilla de jugadores."
            icon={<GroupIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/federation/get-players"
          />
          <DashboardCard
            title="Calendario"
            description="Consulta el calendario de partidos."
            icon={
              <CalendarMonthIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/federation/calendar"
          />
          <DashboardCard
            title="Jornada"
            description="Partidos de la jornada de tus equipos."
            icon={
              <EventAvailableIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/federation/matchday"
          />
          <DashboardCard
            title="Clasificación"
            description="Ver la clasificación actual."
            icon={
              <LeaderboardIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/federation/classification"
          />
          <DashboardCard
            title="Goleadores"
            description="Listado de máximos goleadores."
            icon={
              <SportsSoccerIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/federation/goleadores"
          />
          <DashboardCard
            title="Configuración"
            description="Ajustes y preferencias de la aplicación."
            icon={<SettingsIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/federation/settings"
          />
          <DashboardCard
            title="Convocatorias"
            description="Ver convocatorias por jugador."
            icon={<HowToRegIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/federation/callups"
          />
        </div>
      </div>
    </BaseLayout>
  );
}
