import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import { usePlayerAutoLoad } from "../Dashboard/hooks/usePlayerAutoLoad";
import TeamDashboardCards from "./TeamDashboardCards";
import styles from "../Dashboard/Dashboard.module.css";

export default function TeamDashboard() {
  const navigate = useNavigate();
  const { teamTitleNode, clubSubtitleNode, team } = useTeamAndClub();
  const { isPlayer } = usePlayerAutoLoad();
  const selectedSeason = "";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Dashboard de equipo"}
        subtitle={clubSubtitleNode ?? "Acciones rápidas del equipo seleccionado"}
        actionBar={
          <div className={styles.actionBarContent}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(isPlayer ? "/appSelector" : "/coach/dashboard")}
              sx={{ textTransform: "none", marginLeft: "auto" }}
            >
              {isPlayer ? "Volver" : "Volver al dashboard de entrenador"}
            </Button>
          </div>
        }
      >
        <TeamDashboardCards team={team} selectedSeason={selectedSeason} isPlayer={isPlayer} />
      </ContentLayout>
    </BaseLayout>
  );
}
