import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Link } from "react-router-dom";
import teamService, { type TeamResponse } from "../../../../services/teamService";
import styles from "./ClubTeamsWidget.module.css";

interface ClubTeamsWidgetProps {
  clubId: string;
  seasonId?: string;
}

export default function ClubTeamsWidget({ clubId, seasonId }: ClubTeamsWidgetProps) {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    teamService
      .getTeams(clubId, seasonId)
      .then((result) => mounted && setTeams(result ?? []))
      .catch(() => mounted && setError(true))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [clubId, seasonId]);

  const allTeamsHref = `/coach/clubs/${clubId}/teams${seasonId ? `?seasonId=${seasonId}` : ""}`;

  return (
    <section aria-labelledby="club-teams-title" className={styles.section}>
      <div className={styles.header}>
        <h3 id="club-teams-title" className={styles.title}>Equipos del club</h3>
        <Link to={allTeamsHref} className={styles.headerLink}>Ver todos</Link>
      </div>

      {loading && (
        <div className={styles.placeholder}>
          <CircularProgress size={32} aria-label="Cargando equipos" />
        </div>
      )}
      {!loading && error && (
        <p className={styles.message}>No se pudieron cargar los equipos</p>
      )}
      {!loading && !error && teams.length === 0 && (
        <p className={styles.message}>El club no tiene equipos</p>
      )}
      {!loading && !error && teams.length > 0 && (
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.id}>
              <Link to={`/coach/team-dashboard?teamId=${team.id}`} className={styles.row}>
                <span className={styles.text}>
                  <span className={styles.name}>{team.name}</span>
                  <span className={styles.category}>{team.category?.name}</span>
                </span>
                <ChevronRightIcon className={styles.chevron} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
