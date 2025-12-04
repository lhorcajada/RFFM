import React from "react";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
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
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TimelineIcon from "@mui/icons-material/Timeline";
import BaseLayout from "../components/ui/BaseLayout/BaseLayout";
import PageHeader from "../../../shared/components/ui/PageHeader/PageHeader";
import ActionBar from "../../../shared/components/ui/ActionBar/ActionBar";
import DashboardCard from "../../../shared/components/ui/DashboardCard/DashboardCard";
import styles from "./Dashboard.module.css";

export default function CoachDashboard() {
  const navigate = useNavigate();

  return (
    <BaseLayout appTitle="Entrenadores">
      <PageHeader
        title="Panel de Control"
        subtitle="Gestión y herramientas para entrenadores"
      />
      <ActionBar>
        <Button
          variant="outlined"
          startIcon={<HomeIcon />}
          onClick={() => navigate("/")}
          sx={{ textTransform: "none" }}
        >
          Volver al inicio
        </Button>
      </ActionBar>
      <div className={styles.container}>
        <div className={styles.cards}>
          <DashboardCard
            title="Configuración"
            description="Ajustes y preferencias."
            icon={<SettingsIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/settings"
          />
          <DashboardCard
            title="Noticias"
            description="Últimas noticias y comunicados."
            icon={<NewspaperIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/news"
          />
          <DashboardCard
            title="Plantilla"
            description="Gestión de jugadores."
            icon={<GroupIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/squad"
          />
          <DashboardCard
            title="Asistencias"
            description="Control de asistencias."
            icon={<AssignmentIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/attendance"
          />
          <DashboardCard
            title="Convocatorias"
            description="Gestión de convocatorias."
            icon={<EventIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/convocations"
          />
          <DashboardCard
            title="Partidos"
            description="Información de partidos."
            icon={
              <EmojiEventsIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/coach/matches"
          />
          <DashboardCard
            title="Entrenamientos"
            description="Planificación de entrenamientos."
            icon={
              <FitnessCenterIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/coach/trainings"
          />
          <DashboardCard
            title="Lesionados"
            description="Control de lesionados."
            icon={
              <LocalHospitalIcon style={{ fontSize: 40, color: "#05313b" }} />
            }
            to="/coach/injured"
          />
          <DashboardCard
            title="Modelo de Juego"
            description="Estrategia y tácticas."
            icon={<TimelineIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/game-model"
          />
          <DashboardCard
            title="Sanciones"
            description="Registro de sanciones."
            icon={<GavelIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/sanctions"
          />
          <DashboardCard
            title="Lotería"
            description="Sistema de lotería."
            icon={<CasinoIcon style={{ fontSize: 40, color: "#05313b" }} />}
            to="/coach/lottery"
          />
        </div>
      </div>
    </BaseLayout>
  );
}
