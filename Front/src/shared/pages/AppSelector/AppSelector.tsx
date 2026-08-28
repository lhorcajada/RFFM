import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import SportsIcon from "@mui/icons-material/Sports";
import GroupsIcon from "@mui/icons-material/Groups";
import styles from "./AppSelector.module.css";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../components/ui/ContentLayout/ContentLayout";
import { coachAuthService } from "../../../apps/coach/services/authService";
import { useTeamAppEntry } from "./hooks/useTeamAppEntry";
import AppCard from "./components/AppCard";
import TrialConfirmDialog from "../../components/TrialConfirmDialog";
import UserTypeDialog from "./components/UserTypeDialog";
import ClubLicenseDialog from "./components/ClubLicenseDialog";
import CodeInputDialog from "./components/CodeInputDialog";
import ChangeRoleDialog from "./components/ChangeRoleDialog";
import PlayerIdentityDialog from "./components/PlayerIdentityDialog";

function dispatchSnackbar(message: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("rffm.show_snackbar", {
        detail: { message, severity: "warning" },
      })
    );
  } catch {}
}

export default function AppSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    changeRoleOpen,
    handleKeepRole,
    handleChangeRole,
    userTypeOpen,
    openUserTypeDialog,
    closeUserTypeDialog,
    handleUserTypeSelect,
    coachTrialOpen,
    coachTrialProcessing,
    closeCoachTrial,
    handleCoachTrialAccept,
    clubLicenseOpen,
    clubLicenseProcessing,
    closeClubLicense,
    handleClubLicenseAccept,
    codeDialogOpen,
    codeDialogConfig,
    codeDialogLoading,
    codeDialogError,
    closeCodeDialog,
    handleCodeAccept,
    identityDialogOpen,
    identityDialogLoading,
    identityDialogError,
    validatedTeamName,
    playersLoading,
    players,
    closeIdentityDialog,
    handleIdentityAccept,
    openPlayerRelinkDialog,
  } = useTeamAppEntry();

  // If the dashboard sent us back because the player has no team linked, open the re-link dialog
  useEffect(() => {
    const state = location.state as { needsTeamRelink?: boolean } | null;
    if (state?.needsTeamRelink && coachAuthService.isAuthenticated()) {
      openPlayerRelinkDialog();
      // Clear the state so a refresh doesn't re-trigger the dialog
      window.history.replaceState({}, "", location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BaseLayout hideFooterMenu>
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <ContentLayout
            title="Selecciona tu aplicación"
            headerClassName={styles.headerEdgeToEdge}
          >
            <div className={styles.gridContainer}>
              <AppCard
                icon={<GroupsIcon className={styles.icon} />}
                title="Federación"
                description="Gestión de competiciones, equipos, clasificaciones y estadísticas de la Federación de Fútbol de Madrid"
                onClick={() => {
                  if (!coachAuthService.isAuthenticated()) {
                    navigate("/login");
                    return;
                  }
                  if (
                    coachAuthService.hasRole("Administrator") ||
                    coachAuthService.hasRole("Federation")
                  ) {
                    navigate("/federation/dashboard");
                  } else {
                    dispatchSnackbar("No tienes permisos para acceder a Federación.");
                  }
                }}
              />
              <AppCard
                icon={<SportsIcon className={styles.icon} />}
                title="Mi equipo"
                description="Herramientas de gestión, análisis y planificación para equipos de fútbol base"
                onClick={() => {
                  if (!coachAuthService.isAuthenticated()) {
                    navigate("/login");
                    return;
                  }
                  if (
                    coachAuthService.hasRole("Administrator") ||
                    coachAuthService.hasRole("Coach")
                  ) {
                    // El cambio de rol al entrar en "Mi equipo" está oculto
                    // temporalmente: se reactivará en una próxima versión.
                    handleKeepRole();
                    return;
                  }
                  if (
                    coachAuthService.hasRole("Player") ||
                    coachAuthService.hasRole("FamilyPlayer") ||
                    coachAuthService.hasRole("FamilyMember") ||
                    coachAuthService.hasRole("ClubMember") ||
                    coachAuthService.hasRole("Follower")
                  ) {
                    navigate("/coach/dashboard");
                    return;
                  }
                  openUserTypeDialog();
                }}
              />
              <ChangeRoleDialog
                open={changeRoleOpen}
                onClose={handleKeepRole}
                onKeep={handleKeepRole}
                onChange={handleChangeRole}
              />
              <UserTypeDialog
                open={userTypeOpen}
                onClose={closeUserTypeDialog}
                onSelect={handleUserTypeSelect}
              />
              <TrialConfirmDialog
                open={coachTrialOpen}
                isProcessing={coachTrialProcessing}
                onClose={closeCoachTrial}
                onAccept={handleCoachTrialAccept}
              />
              <ClubLicenseDialog
                open={clubLicenseOpen}
                isProcessing={clubLicenseProcessing}
                onClose={closeClubLicense}
                onAccept={handleClubLicenseAccept}
              />
              <CodeInputDialog
                open={codeDialogOpen}
                title={codeDialogConfig.title}
                description={codeDialogConfig.description}
                label={codeDialogConfig.label}
                loading={codeDialogLoading}
                error={codeDialogError}
                onClose={closeCodeDialog}
                onAccept={handleCodeAccept}
              />
              <PlayerIdentityDialog
                open={identityDialogOpen}
                teamName={validatedTeamName}
                loading={identityDialogLoading}
                playersLoading={playersLoading}
                players={players}
                error={identityDialogError}
                onClose={closeIdentityDialog}
                onAccept={handleIdentityAccept}
              />
            </div>
          </ContentLayout>
        </div>
      </div>
    </BaseLayout>
  );
}
