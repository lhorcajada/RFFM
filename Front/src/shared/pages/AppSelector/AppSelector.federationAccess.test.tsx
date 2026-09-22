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

vi.mock("./hooks/useTeamAppEntry", () => ({
  useTeamAppEntry: () => ({
    changeRoleOpen: false,
    openChangeRoleDialog: vi.fn(),
    handleKeepRole: vi.fn(),
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

describe("AppSelector — entrada de Player/FamilyMember a 'Federación'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coachAuthService.isAuthenticated).mockReturnValue(true);
  });

  it("un usuario con rol FamilyMember accede a Federación", () => {
    vi.mocked(coachAuthService.hasRole).mockImplementation(
      (role: string) => role === "FamilyMember"
    );

    renderAppSelector();
    fireEvent.click(screen.getByText("Federación"));

    expect(mockNavigate).toHaveBeenCalledWith("/federation/dashboard");
  });

  it("un usuario con rol Player accede a Federación", () => {
    vi.mocked(coachAuthService.hasRole).mockImplementation(
      (role: string) => role === "Player"
    );

    renderAppSelector();
    fireEvent.click(screen.getByText("Federación"));

    expect(mockNavigate).toHaveBeenCalledWith("/federation/dashboard");
  });

  it("un usuario sin ningún rol permitido no accede y ve el aviso de permisos", () => {
    vi.mocked(coachAuthService.hasRole).mockReturnValue(false);

    renderAppSelector();
    fireEvent.click(screen.getByText("Federación"));

    expect(mockNavigate).not.toHaveBeenCalledWith("/federation/dashboard");
  });
});
