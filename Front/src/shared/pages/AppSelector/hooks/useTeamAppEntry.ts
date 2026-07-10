import React from "react";
import { useNavigate } from "react-router-dom";
import { useCoachTrial } from "./useCoachTrial";
import type { UserType } from "../components/UserTypeDialog";
import teamService, { type PlayerForSelection } from "../../../../apps/coach/services/teamService";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import { invitationsApi } from "../../../services/invitations/invitationsApi";

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
  const [players, setPlayers] = React.useState<PlayerForSelection[]>([]);
  const [playersLoading, setPlayersLoading] = React.useState(false);
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
      if (selectedUserType === "ClubMember") {
        const res = await invitationsApi.validateClubCode({
          code,
          membershipKind: "ClubMember",
        });
        if (res.token) {
          coachAuthService.storeUpdatedToken(res.token);
        }
        setCodeDialogOpen(false);
        navigate("/coach/dashboard");
        return;
      }

      const team = await teamService.validateTeamCode(code);
      setCodeDialogOpen(false);
      if (selectedUserType === "Player" || selectedUserType === "FamilyMember") {
        setValidatedTeam(team);
        // Fetch players for selection
        setPlayersLoading(true);
        try {
          const response = await teamService.getTeamPlayersForSelection(team.teamId);
          setPlayers(response.players);
        } catch {
          setPlayersLoading(false);
          setIdentityDialogError("No se pudo cargar la lista de jugadores. Intenta de nuevo.");
          window.dispatchEvent(
            new CustomEvent("rffm.show_snackbar", {
              detail: { message: "Error al cargar jugadores", severity: "error" },
            })
          );
          setCodeDialogOpen(true);
          return;
        }
        setPlayersLoading(false);
        setIdentityDialogOpen(true);
      } else {
        navigate("/coach/dashboard");
      }
    } catch (error: any) {
      const data = error?.response?.data;
      const apiMessage = data?.detail ?? data?.message ?? data?.title;
      const fallback = "Código no válido. Comprueba el código e inténtalo de nuevo.";
      setCodeDialogError(apiMessage ? String(apiMessage) : fallback);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: {
            message: apiMessage ? String(apiMessage) : "Código incorrecto",
            severity: "error",
          },
        })
      );
    } finally {
      setCodeDialogLoading(false);
    }
  }

  function closeIdentityDialog() {
    setIdentityDialogOpen(false);
    setIdentityDialogError(null);
    setPlayers([]);
  }

  async function handleIdentityAccept(playerId: string) {
    if (!validatedTeam) return;
    setIdentityDialogLoading(true);
    setIdentityDialogError(null);
    try {
      // Use the playerId from selection to verify identity (new flow)
      const result = await teamService.verifyPlayerIdentity(validatedTeam.teamId, playerId);
      // Store the refreshed JWT (now includes "Player" role) so the next session skips onboarding
      if (result.token) {
        coachAuthService.storeUpdatedToken(result.token);
      }
      // Persist the associated teamId so the dashboard can auto-load it
      if (result.teamId) {
        try { localStorage.setItem("coach_player_teamId", result.teamId); } catch {}
      }
      setIdentityDialogOpen(false);
      navigate(result.teamId ? `/coach/dashboard?teamId=${result.teamId}` : "/coach/dashboard");
    } catch {
      setIdentityDialogError(
        "No se pudo verificar tu identidad. Intenta de nuevo."
      );
    } finally {
      setIdentityDialogLoading(false);
    }
  }

  function openPlayerRelinkDialog() {
    setSelectedUserType("Player");
    setCodeDialogConfig({
      title: "Código de equipo",
      description: "Introduce el código de equipo que te ha proporcionado tu club.",
      label: "Código de equipo",
    });
    setCodeDialogOpen(true);
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

    // Player identity verification step (now uses player selection)
    identityDialogOpen,
    identityDialogLoading,
    identityDialogError,
    validatedTeamName: validatedTeam?.teamName,
    playersLoading,
    players,
    closeIdentityDialog,
    handleIdentityAccept,
    openPlayerRelinkDialog,
  };
}
