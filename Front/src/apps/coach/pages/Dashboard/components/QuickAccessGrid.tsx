import SettingsIcon from "@mui/icons-material/Settings";
import DashboardCard from "../../../../../shared/components/ui/DashboardCard/DashboardCard";
import type { TeamResponse } from "../../../services/teamService";
import type { TeamPhotos } from "../hooks/useTeamPhotos";
import TeamShield from "./TeamShield";
import styles from "./QuickAccessGrid.module.css";

interface QuickAccessGridProps {
  teams: TeamResponse[];
  teamPhotos: TeamPhotos;
  showSettings: boolean;
  columns: 3 | 5;
  buildTeamRoute: (teamId: string) => string;
}

export default function QuickAccessGrid({
  teams,
  teamPhotos,
  showSettings,
  columns,
  buildTeamRoute,
}: QuickAccessGridProps) {
  const gridClass = columns === 5 ? styles.fiveColumns : styles.threeColumns;

  return (
    <ul className={`${styles.grid} ${gridClass}`} aria-label="Acceso rápido">
      {teams.map((team) => (
        <li key={team.id} className={styles.item}>
          <DashboardCard
            title={team.name}
            description={`${team.category.name} • ${team.club.name}`}
            icon={<TeamShield name={team.name} imageUrl={teamPhotos[team.id]} size="md" />}
            to={buildTeamRoute(team.id)}
            className={styles.card}
            iconClassName={styles.icon}
            titleClassName={styles.title}
            descriptionClassName={styles.description}
          />
        </li>
      ))}
      {showSettings && (
        <li className={styles.item}>
          <DashboardCard
            title="Configuración"
            description="Ajustes y preferencias."
            icon={<SettingsIcon className={styles.settingsIcon} />}
            to="/coach/settings"
            className={`${styles.card} ${styles.settingsCard}`}
            iconClassName={styles.icon}
            titleClassName={styles.title}
            descriptionClassName={styles.description}
          />
        </li>
      )}
    </ul>
  );
}
