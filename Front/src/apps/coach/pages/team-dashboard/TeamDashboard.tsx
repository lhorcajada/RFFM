import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShieldIcon from "@mui/icons-material/Shield";
import { IconButton, Tooltip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ErrorBoundary from "../../../../shared/components/ui/ErrorBoundary/ErrorBoundary";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import { usePlayerAutoLoad } from "../Dashboard/hooks/usePlayerAutoLoad";
import UpcomingEventsWidget from "./components/UpcomingEventsWidget";
import NewsWidget from "./components/NewsWidget";
import LeagueSnapshot from "./components/LeagueSnapshot";
import QuinielaPromoCard from "./components/QuinielaPromoCard";
import QuickActions from "./components/QuickActions";
import PushActivationBanner from "../../components/PushActivationBanner/PushActivationBanner";
import teamDashboardStyles from "./TeamDashboard.module.css";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

export default function TeamDashboard() {
  useAuditPageAccess('TeamDashboard');
  const navigate = useNavigate();
  const { teamTitleNode, clubSubtitleNode, team } = useTeamAndClub();
  const { isPlayer } = usePlayerAutoLoad();
  const clubId = team?.club?.id;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Dashboard de equipo"}
        subtitle={clubSubtitleNode ?? "Acciones rápidas del equipo seleccionado"}
        actionBar={
          isPlayer ? undefined : (
            <div className={teamDashboardStyles.actionBar}>
              {clubId && (
                <Tooltip title="Ir al club">
                  <IconButton
                    aria-label="Ir al club"
                    className={teamDashboardStyles.headerButton}
                    onClick={() => navigate(`/coach/clubs/dashboard/${clubId}`)}
                  >
                    <ShieldIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Volver">
                <IconButton
                  aria-label="Volver"
                  className={teamDashboardStyles.headerButton}
                  onClick={() => navigate("/coach/dashboard")}
                >
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
            </div>
          )
        }
      >
        <div className={teamDashboardStyles.pageContent}>
          <PushActivationBanner />
          <div className={teamDashboardStyles.widgetsGrid}>
            <div className={teamDashboardStyles.mainColumn}>
              {team?.id && (
                <ErrorBoundary>
                  <QuinielaPromoCard teamId={team.id} />
                </ErrorBoundary>
              )}
              <ErrorBoundary>
                <UpcomingEventsWidget team={team} isPlayer={isPlayer} />
              </ErrorBoundary>
              <ErrorBoundary>
                <LeagueSnapshot team={team} isPlayer={isPlayer} />
              </ErrorBoundary>
            </div>
            <div className={teamDashboardStyles.sideColumn}>
              {!isPlayer && (
                <ErrorBoundary>
                  <QuickActions teamId={team?.id ?? null} />
                </ErrorBoundary>
              )}
              <ErrorBoundary>
                <NewsWidget />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
