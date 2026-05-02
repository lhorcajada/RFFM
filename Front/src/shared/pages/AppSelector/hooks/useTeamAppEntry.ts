import React from "react";
import { useNavigate } from "react-router-dom";
import { useCoachTrial } from "./useCoachTrial";
import type { UserType } from "../components/UserTypeDialog";
import teamService from "../../../../apps/coach/services/teamService";
import { coachAuthService } from "../../../../apps/coach/services/authService";

export function useTeamAppEntry() {
  const navigate = useNavigate();
  const coachTrial = useCoachTrial();

  const [changeRoleOpen, setChangeRoleOpen] = React.useState(false);
  const [userTypeOpen, setUserTypeOpen] = React.useState(false);
  const [clubLicenseOpen, setClubLicenseOpen] = React.useState(false);
  const [clubLicenseProcessing, setClubLicenseProcessing] = React.useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = React.useState(false);
  const [codeDialogConfig, setCodeDialogConfig] = React.useState<{
    title: string;
    description: string;
    label: string;
  }>({ title: "", description: "", label: "" });
  const [codeDialogLoading, setCodeDialogLoading] = React.useState(false);
  const [codeDialogError, setCodeDialogError] = React.useState<string | null>(null);
  const [selectedUserType, setSelectedUserType] = React.useState<UserType | null>(null);
  const [validatedTeam, setValidatedTeam] = React.useState<{ teamId: string; teamName: string } | null>(null);
  const [identityDialogOpen, setIdentityDialogOpen] = React.useState(false);
  const [identityDialogLoading, setIdentityDialogLoading] = React.useState(false);
  const [identityDialogError, setIdentityDialogError] = React.useState<string | null>(null);

  function openChangeRoleDialog() {
    setChangeRoleOpen(true);
  }

  function handleKeepRole() {
    setChangeRoleOpen(false);
    navigate("/coach/dashboard");
  }

  function handleChangeRole() {
    setChangeRoleOpen(false);
    setUserTypeOpen(true);
  }

  function openUserTypeDialog() {
    setUserTypeOpen(true);
  }

  function closeUserTypeDialog() {
    setUserTypeOpen(false);
  }

  function handleUserTypeSelect(type: UserType) {
    setUserTypeOpen(false);

    switch (type) {
      case "Coach":
        coachTrial.openDialog();
        break;

      case "ClubDirector":
        setClubLicenseOpen(true);
        break;

      case "Player":
      case "FamilyMember":
      case "Fan":
        setSelectedUserType(type);
        setCodeDialogConfig({
          title: "Código de equipo",
          description: "Introduce el código de equipo que te ha proporcionado tu club.",
          label: "Código de equipo",
        });
        setCodeDialogOpen(true);
        break;

      case "ClubMember":
        setSelectedUserType(type);
        setCodeDialogConfig({
          title: "Código de club",
          description: "Introduce el código de club que te ha proporcionado tu organización.",
          label: "Código de club",
        });
        setCodeDialogOpen(true);
        break;
    }
  }

  function closeClubLicense() {
    setClubLicenseOpen(false);
  }

  function handleClubLicenseAccept() {
    // TODO: wire up real club license acquisition
    setClubLicenseProcessing(true);
    setTimeout(() => {
      setClubLicenseProcessing(false);
      setClubLicenseOpen(false);
      navigate("/coach/dashboard");
    }, 0);
  }

  function closeCodeDialog() {
    setCodeDialogOpen(false);
    setCodeDialogError(null);
  }

  async function handleCodeAccept(code: string) {
    setCodeDialogLoading(true);
    setCodeDialogError(null);
    try {
      const team = await teamService.validateTeamCode(code);
      setCodeDialogOpen(false);
      if (selectedUserType === "Player") {
        setValidatedTeam(team);
        setIdentityDialogOpen(true);
      } else {
        navigate("/coach/dashboard");
      }
    } catch {
      setCodeDialogError("Código no válido. Comprueba el código e inténtalo de nuevo.");
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Código de equipo incorrecto", severity: "error" },
        })
      );
    } finally {
      setCodeDialogLoading(false);
    }
  }

  function closeIdentityDialog() {
    setIdentityDialogOpen(false);
    setIdentityDialogError(null);
  }

  async function handleIdentityAccept(name: string, lastName: string, birthDate: string) {
    if (!validatedTeam) return;
    setIdentityDialogLoading(true);
    setIdentityDialogError(null);
    try {
      const result = await teamService.verifyPlayerIdentity(validatedTeam.teamId, name, lastName, birthDate);
      // Store the refreshed JWT (now includes "Player" role) so the next session skips onboarding
      if (result.token) {
        coachAuthService.storeUpdatedToken(result.token);
      }
      setIdentityDialogOpen(false);
      navigate("/coach/dashboard");
    } catch {
      setIdentityDialogError(
        "No se encontraron tus datos en la plantilla. Comprueba nombre, apellidos y fecha de nacimiento."
      );
    } finally {
      setIdentityDialogLoading(false);
    }
  }

  return {
    // Change role step (for already-authenticated users)
    changeRoleOpen,
    openChangeRoleDialog,
    handleKeepRole,
    handleChangeRole,

    // User type step
    userTypeOpen,
    openUserTypeDialog,
    closeUserTypeDialog,
    handleUserTypeSelect,

    // Coach trial step (Entrenador)
    coachTrialOpen: coachTrial.confirmOpen,
    coachTrialProcessing: coachTrial.isProcessing,
    closeCoachTrial: coachTrial.closeDialog,
    handleCoachTrialAccept: coachTrial.handleAccept,

    // Club license step (Directivo)
    clubLicenseOpen,
    clubLicenseProcessing,
    closeClubLicense,
    handleClubLicenseAccept,

    // Code input step (Jugador / Familiar / Seguidor / Miembro)
    codeDialogOpen,
    codeDialogConfig,
    codeDialogLoading,
    codeDialogError,
    closeCodeDialog,
    handleCodeAccept,

    // Player identity verification step
    identityDialogOpen,
    identityDialogLoading,
    identityDialogError,
    validatedTeamName: validatedTeam?.teamName,
    closeIdentityDialog,
    handleIdentityAccept,
  };
}
