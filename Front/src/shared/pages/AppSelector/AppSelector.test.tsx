import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppSelector from "./AppSelector";
import { coachAuthService } from "../../../apps/coach/services/authService";
import { UserProvider } from "../../context/UserContext";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    isAuthenticated: vi.fn(() => true),
    hasRole: vi.fn(() => false),
    getToken: vi.fn(() => "fake-token"),
  },
}));

const openChangeRoleDialog = vi.fn();
const handleKeepRole = vi.fn();

vi.mock("./hooks/useTeamAppEntry", () => ({
  useTeamAppEntry: () => ({
    changeRoleOpen: false,
    openChangeRoleDialog,
    handleKeepRole,
    handleChangeRole: vi.fn(),
    userTypeOpen: false,
    openUserTypeDialog: vi.fn(),
    closeUserTypeDialog: vi.fn(),
    handleUserTypeSelect: vi.fn(),
    coachTrialOpen: false,
    coachTrialProcessing: false,
    closeCoachTrial: vi.fn(),
    handleCoachTrialAccept: vi.fn(),
    clubLicenseOpen: false,
    clubLicenseProcessing: false,
    closeClubLicense: vi.fn(),
    handleClubLicenseAccept: vi.fn(),
    codeDialogOpen: false,
    codeDialogConfig: { title: "", description: "", label: "" },
    codeDialogLoading: false,
    codeDialogError: null,
    closeCodeDialog: vi.fn(),
    handleCodeAccept: vi.fn(),
    identityDialogOpen: false,
    identityDialogLoading: false,
    identityDialogError: null,
    validatedTeamName: undefined,
    playersLoading: false,
    players: [],
    closeIdentityDialog: vi.fn(),
    handleIdentityAccept: vi.fn(),
    openPlayerRelinkDialog: vi.fn(),
  }),
}));

function renderAppSelector() {
  return render(
    <MemoryRouter>
      <UserProvider>
        <AppSelector />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppSelector — entrada de Coach a 'Mi equipo'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coachAuthService.isAuthenticated).mockReturnValue(true);
  });

  it("un coach con rol ya asignado entra directamente, sin preguntar si quiere cambiar de rol", () => {
    vi.mocked(coachAuthService.hasRole).mockImplementation((role: string) => role === "Coach");

    renderAppSelector();
    fireEvent.click(screen.getByText("Mi equipo"));

    expect(handleKeepRole).toHaveBeenCalled();
    expect(openChangeRoleDialog).not.toHaveBeenCalled();
  });
});
