import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import type { TeamResponse } from "../../services/teamService";
import styles from "./TeamCompetitionMissing.module.css";

export default function TeamCompetitionMissing({ team }: { team: TeamResponse }) {
  const { hasFeatureAccess } = usePermissions();
  const canConfigureCompetition =
    Boolean(team.canEdit) && hasFeatureAccess(COACH_FEATURE_ROUTES.ClubTeams);

  return (
    <div className={styles.root}>
      <EmptyState description="El equipo no tiene una competición configurada. Configúrala desde la edición del equipo." />
      {canConfigureCompetition && (
        <Button
          component={Link}
          to={`/coach/clubs/${team.club.id}/teams/${team.id}/edit`}
          variant="contained"
          size="small"
        >
          Configurar competición
        </Button>
      )}
    </div>
  );
}
