import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShieldIcon from "@mui/icons-material/Shield";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ErrorBoundary from "../../../../shared/components/ui/ErrorBoundary/ErrorBoundary";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import { usePlayerAutoLoad } from "../Dashboard/hooks/usePlayerAutoLoad";
import TeamDashboardCards from "./TeamDashboardCards";
import UpcomingEventsWidget from "./components/UpcomingEventsWidget";
import NewsWidget from "./components/NewsWidget";
import PushActivationBanner from "../../components/PushActivationBanner/PushActivationBanner";
import styles from "../Dashboard/Dashboard.module.css";
import teamDashboardStyles from "./TeamDashboard.module.css";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

export default function TeamDashboard() {
  useAuditPageAccess('TeamDashboard');
  const navigate = useNavigate();
  const { teamTitleNode, clubSubtitleNode, team } = useTeamAndClub();
  const { isPlayer } = usePlayerAutoLoad();
  const clubId = team?.club?.id;
  const selectedSeason = "";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Dashboard de equipo"}
        subtitle={clubSubtitleNode ?? "Acciones rápidas del equipo seleccionado"}
        actionBar={
          isPlayer ? undefined : (
            <div className={styles.actionBarContent}>
              {clubId && (
                <Button
                  variant="outlined"
                  startIcon={<ShieldIcon />}
                  onClick={() => navigate(`/coach/clubs/dashboard/${clubId}`)}
                  sx={{ textTransform: "none", marginLeft: "auto" }}
                >
                  Ir al club
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/coach/dashboard")}
                sx={{ textTransform: "none", marginLeft: clubId ? undefined : "auto" }}
              >
                Volver
              </Button>
            </div>
          )
        }
      >
        <div className={teamDashboardStyles.pageContent}>
          <PushActivationBanner />
          <div className={teamDashboardStyles.layout}>
            <div className={teamDashboardStyles.widgetsGrid}>
              <ErrorBoundary>
                <UpcomingEventsWidget team={team} isPlayer={isPlayer} />
              </ErrorBoundary>
              <ErrorBoundary>
                <NewsWidget />
              </ErrorBoundary>
            </div>
            <div className={teamDashboardStyles.tilesGrid}>
              <ErrorBoundary>
                <TeamDashboardCards team={team} selectedSeason={selectedSeason} isPlayer={isPlayer} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
