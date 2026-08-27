import { Slide, Snackbar, Alert } from "@mui/material";
import React from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { usePreferredSelection } from "./hooks/usePreferredSelection";
import { usePlayerAutoLoad } from "./hooks/usePlayerAutoLoad";
import DashboardActionBar from "./components/DashboardActionBar";
import DashboardCards from "./components/DashboardCards";

export default function CoachDashboard() {
  const { teamTitleNode, clubSubtitleNode } = useTeamAndClub();
  const selectedSeason = "";
  const { snackbar, setSnackbar } = usePreferredSelection(selectedSeason);
  const { isPlayer } = usePlayerAutoLoad();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Panel de Control de entrenador"}
        subtitle={clubSubtitleNode ?? "Gestión y herramientas para entrenadores"}
        actionBar={
          <DashboardActionBar
            isPlayer={isPlayer}
          />
        }
      >
        <DashboardCards
          selectedSeason={selectedSeason}
          isPlayer={isPlayer}
        />
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
