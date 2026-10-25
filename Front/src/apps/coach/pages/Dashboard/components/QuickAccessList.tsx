import { Link } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import type { TeamResponse } from "../../../services/teamService";
import type { TeamPhotos } from "../hooks/useTeamPhotos";
import TeamShield from "./TeamShield";
import styles from "./QuickAccessList.module.css";

interface QuickAccessListProps {
  teams: TeamResponse[];
  teamPhotos: TeamPhotos;
  showSettings: boolean;
  buildTeamRoute: (teamId: string) => string;
}

export default function QuickAccessList({
  teams,
  teamPhotos,
  showSettings,
  buildTeamRoute,
}: QuickAccessListProps) {
  return (
    <>
      <ul className={styles.list} aria-label="Mis equipos">
        {teams.map((team) => (
          <li key={team.id}>
            <Link className={styles.row} to={buildTeamRoute(team.id)}>
              <TeamShield name={team.name} imageUrl={teamPhotos[team.id]} size="sm" />
              <span className={styles.text}>
                <span className={styles.name}>{team.name}</span>
                <span className={styles.description}>
                  {`${team.category.name} • ${team.club.name}`}
                </span>
              </span>
              <ChevronRightIcon className={styles.chevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        {showSettings && (
          <Link className={`${styles.actionLink} ${styles.settingsLink}`} to="/coach/settings">
            <SettingsOutlinedIcon className={styles.actionIcon} aria-hidden="true" />
            Configuración
          </Link>
        )}
        <Link className={`${styles.actionLink} ${styles.homeLink}`} to="/">
          <HomeOutlinedIcon className={styles.actionIcon} aria-hidden="true" />
          Inicio
        </Link>
      </div>
    </>
  );
}
