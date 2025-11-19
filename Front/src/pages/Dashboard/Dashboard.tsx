import SettingsIcon from "@mui/icons-material/Settings";
import GroupIcon from "@mui/icons-material/Group";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import DashboardCard from "../../components/ui/DashboardCard/DashboardCard";
import styles from "./Dashboard.module.css";

export default function Dashboard(): JSX.Element {
  return (
    <BaseLayout>
      <PageHeader
        title="Panel de Control"
        subtitle="Resumen y accesos rápidos"
      />
      <div className={styles.cards}>
        <DashboardCard
          title="Plantilla"
          description="Accede a la plantilla de jugadores."
          icon={<GroupIcon style={{ fontSize: 40, color: "#05313b" }} />}
          to="/get-players"
        />
        <DashboardCard
          title="Calendario"
          description="Consulta el calendario de partidos."
          icon={
            <CalendarMonthIcon style={{ fontSize: 40, color: "#05313b" }} />
          }
          to="/calendar"
        />
        <DashboardCard
          title="Clasificación"
          description="Ver la clasificación actual."
          icon={<LeaderboardIcon style={{ fontSize: 40, color: "#05313b" }} />}
          to="/classification"
        />
        <DashboardCard
          title="Configuración"
          description="Ajustes y preferencias de la aplicación."
          icon={<SettingsIcon style={{ fontSize: 40, color: "#05313b" }} />}
          to="/settings"
        />
      </div>
    </BaseLayout>
  );
}
