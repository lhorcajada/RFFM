import { Link } from "react-router-dom";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import StarIcon from "@mui/icons-material/Star";
import { usePreferredTeam } from "../hooks/usePreferredTeam";
import styles from "./PreferredTeamCard.module.css";

export default function PreferredTeamCard(): JSX.Element | null {
  const { preferredTeam, loading } = usePreferredTeam();

  if (loading) return null;

  if (!preferredTeam) {
    return (
      <Link
        to="/federation/settings"
        className={styles.emptyCard}
        aria-label="Configurar equipo preferido"
      >
        <StarIcon className={styles.starIconMuted} />
        <span className={styles.emptyText}>
          No tienes ningún equipo preferido configurado. Elígelo en
          Configuración.
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/federation/get-players"
      className={styles.card}
      aria-label="Equipo preferido"
    >
      <div className={styles.header}>
        <StarIcon className={styles.starIcon} />
        <span className={styles.label}>Equipo preferido</span>
      </div>
      <span className={styles.teamName}>{preferredTeam.teamName}</span>
      <Stack direction="row" spacing={0.5} className={styles.chips}>
        {preferredTeam.competitionName && (
          <Chip
            size="small"
            label={preferredTeam.competitionName}
            variant="outlined"
            className={styles.chip}
          />
        )}
        {preferredTeam.groupName && (
          <Chip
            size="small"
            label={preferredTeam.groupName}
            variant="outlined"
            className={styles.chip}
          />
        )}
        {preferredTeam.seasonLabel && (
          <Chip
            size="small"
            label={`Temporada ${preferredTeam.seasonLabel}`}
            variant="outlined"
            className={styles.chip}
          />
        )}
      </Stack>
    </Link>
  );
}
