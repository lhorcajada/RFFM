import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../../../../apps/coach/services/configurationCoachService", () => ({
  default: {
    getCurrent: vi.fn(),
  },
}));

vi.mock("../../../../../apps/coach/services/teamService", () => ({
  default: {
    validateTeamCode: vi.fn(),
    getTeamPlayersForSelection: vi.fn(),
    verifyPlayerIdentity: vi.fn(),
    enterClubTeamByCode: vi.fn(),
  },
}));

vi.mock("../../../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    storeUpdatedToken: vi.fn(),
    isAuthenticated: vi.fn(),
    hasRole: vi.fn(),
  },
}));

vi.mock("../../../../services/invitations/invitationsApi", () => ({
  invitationsApi: {
    validateClubCode: vi.fn(),
  },
}));

vi.mock("../useCoachTrial", () => ({
  useCoachTrial: () => ({
    confirmOpen: false,
    isProcessing: false,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    handleAccept: vi.fn(),
  }),
}));

import configurationCoachService from "../../../../../apps/coach/services/configurationCoachService";
import teamService from "../../../../../apps/coach/services/teamService";
import { useTeamAppEntry } from "../useTeamAppEntry";

describe("useTeamAppEntry — entrada de Coach a un equipo del club por código", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre CodeInputDialog con título "Código de equipo" al pulsar Continuar cuando no hay preferredTeamId', async () => {
    (configurationCoachService.getCurrent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      coachId: "coach-1",
      preferredClubId: null,
      preferredTeamId: null,
    });

    const { result } = renderHook(() => useTeamAppEntry());

    await act(async () => {
      await result.current.handleKeepRole();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.codeDialogOpen).toBe(true);
    expect(result.current.codeDialogConfig.title).toBe("Código de equipo");
  });

  it("navega directamente a /coach/dashboard cuando ya existe un preferredTeamId (comportamiento existente)", async () => {
    (configurationCoachService.getCurrent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      coachId: "coach-1",
      preferredClubId: "club-1",
      preferredTeamId: "team-1",
    });

    const { result } = renderHook(() => useTeamAppEntry());

    await act(async () => {
      await result.current.handleKeepRole();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/coach/dashboard");
    expect(result.current.codeDialogOpen).toBe(false);
  });

  it("navega a /coach/dashboard?teamId=... cuando el código de equipo del club es válido", async () => {
    (configurationCoachService.getCurrent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      coachId: "coach-1",
      preferredClubId: null,
      preferredTeamId: null,
    });
    (teamService.enterClubTeamByCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: "team-99",
      teamName: "Alevín A",
    });

    const { result } = renderHook(() => useTeamAppEntry());

    await act(async () => {
      await result.current.handleKeepRole();
    });

    await act(async () => {
      await result.current.handleCodeAccept("ABCD1234");
    });

    expect(teamService.enterClubTeamByCode).toHaveBeenCalledWith("ABCD1234");
    expect(mockNavigate).toHaveBeenCalledWith("/coach/dashboard?teamId=team-99");
    expect(result.current.codeDialogOpen).toBe(false);
  });

  it("muestra el detalle del error 403 y mantiene el diálogo abierto cuando el código pertenece a otro club", async () => {
    (configurationCoachService.getCurrent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      coachId: "coach-1",
      preferredClubId: null,
      preferredTeamId: null,
    });
    (teamService.enterClubTeamByCode as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: {
        status: 403,
        data: { detail: "Este código pertenece a un equipo de otro club." },
      },
    });

    const { result } = renderHook(() => useTeamAppEntry());

    await act(async () => {
      await result.current.handleKeepRole();
    });

    await act(async () => {
      await result.current.handleCodeAccept("WRONG123");
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.codeDialogOpen).toBe(true);
    expect(result.current.codeDialogError).toBe("Este código pertenece a un equipo de otro club.");
  });
});
