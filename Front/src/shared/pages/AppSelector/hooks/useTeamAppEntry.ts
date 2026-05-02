import React from "react";
import { useNavigate } from "react-router-dom";
import { useCoachTrial } from "./useCoachTrial";
import type { UserType } from "../components/UserTypeDialog";
import teamService from "../../../../apps/coach/services/teamService";

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
        setCodeDialogConfig({
          title: "Código de equipo",
          description: "Introduce el código de equipo que te ha proporcionado tu club.",
          label: "Código de equipo",
        });
        setCodeDialogOpen(true);
        break;

      case "ClubMember":
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
      await teamService.validateTeamCode(code);
      setCodeDialogOpen(false);
      navigate("/coach/dashboard");
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
  };
}
