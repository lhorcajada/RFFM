import CircularProgress from "@mui/material/CircularProgress";
import { useUserTeams } from "../hooks/useUserTeams";
import { useTeamPhotos } from "../hooks/useTeamPhotos";
import type { DashboardLayout } from "../hooks/useDashboardLayout";
import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../../constants/featureRoutes";
import QuickAccessGrid from "./QuickAccessGrid";
import QuickAccessList from "./QuickAccessList";
import styles from "./DashboardCards.module.css";

interface DashboardCardsProps {
  selectedSeason: string;
  isPlayer?: boolean;
  layout?: DashboardLayout;
}

function formatTeamCount(count: number): string {
  return count === 1 ? "1 equipo" : `${count} equipos`;
}

export default function DashboardCards({
  selectedSeason,
  isPlayer = false,
  layout = "desktop",
}: DashboardCardsProps) {
  const { teams: userTeams, loading: loadingUserTeams } = useUserTeams();
  const teamPhotos = useTeamPhotos(userTeams);
  const { hasFeatureAccess } = usePermissions();

  if (isPlayer) return null;

  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";
  const buildTeamRoute = (teamId: string) =>
    `/coach/team-dashboard?teamId=${teamId}${seasonSuffix}`;

  const showSettings = hasFeatureAccess(COACH_FEATURE_ROUTES.Settings);
  const isMobile = layout === "mobile";
  const visibleTeams = loadingUserTeams ? [] : userTeams;
  const sectionTitle = isMobile ? "Mis equipos" : "Acceso rápido";

  return (
    <section className={styles.section} aria-labelledby="dashboard-quick-access-title">
      <div className={`${styles.header} ${isMobile ? styles.headerMobile : ""}`.trim()}>
        <span className={styles.accentBar} aria-hidden="true" />
        <h2 id="dashboard-quick-access-title" className={styles.title}>
          {sectionTitle}
        </h2>
        {!loadingUserTeams && (
          <span className={styles.count}>{formatTeamCount(userTeams.length)}</span>
        )}
      </div>

      {loadingUserTeams && (
        <div className={styles.loading}>
          <CircularProgress aria-label="Cargando equipos" />
        </div>
      )}

      {isMobile ? (
        <QuickAccessList
          teams={visibleTeams}
          teamPhotos={teamPhotos}
          showSettings={showSettings}
          buildTeamRoute={buildTeamRoute}
        />
      ) : (
        <QuickAccessGrid
          teams={visibleTeams}
          teamPhotos={teamPhotos}
          showSettings={showSettings}
          columns={layout === "desktop" ? 5 : 3}
          buildTeamRoute={buildTeamRoute}
        />
      )}
    </section>
  );
}
