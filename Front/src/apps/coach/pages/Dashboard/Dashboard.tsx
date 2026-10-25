import { Slide, Snackbar, Alert } from "@mui/material";
import React from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { usePreferredSelection } from "./hooks/usePreferredSelection";
import { usePlayerAutoLoad } from "./hooks/usePlayerAutoLoad";
import { useDashboardLayout } from "./hooks/useDashboardLayout";
import type { DashboardLayout } from "./hooks/useDashboardLayout";
import { useGreetingName } from "./hooks/useGreetingName";
import DashboardActionBar from "./components/DashboardActionBar";
import DashboardCards from "./components/DashboardCards";
import DashboardHeader from "./components/DashboardHeader";
import PreferredTeamHero from "./components/PreferredTeamHero";
import PushActivationBanner from "../../components/PushActivationBanner/PushActivationBanner";
import type { PushActivationBannerVariant } from "../../components/PushActivationBanner/PushActivationBanner";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import styles from "./Dashboard.module.css";

const BANNER_VARIANT_BY_LAYOUT: Record<DashboardLayout, PushActivationBannerVariant> = {
  desktop: "card",
  tablet: "strip",
  mobile: "row",
};

export default function CoachDashboard() {
  useAuditPageAccess('Dashboard');
  const { team, teamImageUrl, clubEmblemUrl } = useTeamAndClub();
  const selectedSeason = "";
  const { snackbar, setSnackbar } = usePreferredSelection(selectedSeason);
  const { isPlayer } = usePlayerAutoLoad();
  const layout = useDashboardLayout();
  const greetingName = useGreetingName();
  const isMobile = layout === "mobile";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout>
        <div className={`${styles.homePage} ${styles[`homePage_${layout}`] ?? ""}`.trim()}>
          <DashboardHeader
            name={greetingName}
            compact={isMobile}
            action={isMobile ? undefined : <DashboardActionBar isPlayer={isPlayer} />}
          />
          <div className={`${styles.homeTopRow} ${styles[`homeTopRow_${layout}`] ?? ""}`.trim()}>
            {team && (
              <div className={styles.homeHeroSlot}>
                <PreferredTeamHero
                  team={team}
                  teamImageUrl={teamImageUrl ?? null}
                  clubEmblemUrl={clubEmblemUrl ?? null}
                  layout={layout}
                />
              </div>
            )}
            <div className={styles.homeBannerSlot}>
              <PushActivationBanner variant={BANNER_VARIANT_BY_LAYOUT[layout]} />
            </div>
          </div>
          <DashboardCards
            selectedSeason={selectedSeason}
            isPlayer={isPlayer}
            layout={layout}
          />
        </div>
      </ContentLayout>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        TransitionComponent={(props) => <Slide {...props} direction="down" />}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </BaseLayout>
  );
}
