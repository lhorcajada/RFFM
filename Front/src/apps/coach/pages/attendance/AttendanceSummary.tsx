import { Box, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import AttendanceSummaryContent from "./components/summary/AttendanceSummaryContent";
import styles from "./AttendanceSummary.module.css";

export default function AttendanceSummary() {
  const navigate = useNavigate();
  const { team, teamTitleNode, loading: teamLoading } = useTeamAndClub();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Resumen de asistencias"
        subtitle={teamTitleNode ?? "Visión global de asistencias a entrenamientos y partidos"}
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/coach/dashboard")}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
      >
        <Box className={styles.body}>
          {!teamLoading && !team ? (
            <EmptyState
              title="Seleccione un equipo"
              description="Añada el parámetro ?teamId=... en la URL o seleccione un equipo en el selector."
            />
          ) : (
            team?.id && <AttendanceSummaryContent teamId={team.id} />
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
