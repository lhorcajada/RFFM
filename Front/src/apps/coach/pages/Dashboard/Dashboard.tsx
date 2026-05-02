import { Slide, Snackbar, Alert } from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { useDashboardSeason } from "./hooks/useDashboardSeason";
import { usePreferredSelection } from "./hooks/usePreferredSelection";
import { usePlayerAutoLoad } from "./hooks/usePlayerAutoLoad";
import DashboardActionBar from "./components/DashboardActionBar";
import DashboardCards from "./components/DashboardCards";

export default function CoachDashboard() {
  const { teamTitleNode, clubSubtitleNode, loading: loadingTeam, team } = useTeamAndClub();
  const { selectedSeason, handleSeasonChange } = useDashboardSeason();
  const { hasPreferredSelection, loadingConfig, snackbar, setSnackbar, handleLoadPreferred } =
    usePreferredSelection(selectedSeason);
  const { isPlayer } = usePlayerAutoLoad();

  return (
    <BaseLayout appTitle="Futbol Base - Entrenadores" hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Panel de Control de entrenador"}
        subtitle={clubSubtitleNode ?? "Gestión y herramientas para entrenadores"}
        actionBar={
          <DashboardActionBar
            selectedSeason={selectedSeason}
            onSeasonChange={handleSeasonChange}
            hasPreferredSelection={hasPreferredSelection}
            loadingConfig={loadingConfig}
            onLoadPreferred={handleLoadPreferred}
            isPlayer={isPlayer}
          />
        }
      >
        <DashboardCards
          team={team}
          teamTitleNode={teamTitleNode}
          selectedSeason={selectedSeason}
          loadingTeam={loadingTeam}
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
