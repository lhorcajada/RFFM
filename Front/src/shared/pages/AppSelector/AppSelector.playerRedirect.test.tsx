import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppSelector from "./AppSelector";
import { coachAuthService } from "../../../apps/coach/services/authService";
import { UserProvider } from "../../context/UserContext";

vi.mock("../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    isAuthenticated: vi.fn(() => true),
    hasRole: vi.fn(() => false),
    getRoles: vi.fn(() => []),
    getToken: vi.fn(() => "fake-token"),
  },
}));

vi.mock("./hooks/useTeamAppEntry", () => ({
  useTeamAppEntry: () => ({
    changeRoleOpen: false,
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

function renderAt(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/appSelector", state }]}>
      <UserProvider>
        <Routes>
          <Route path="/appSelector" element={<AppSelector />} />
          <Route path="/coach/dashboard" element={<div>Coach dashboard</div>} />
        </Routes>
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppSelector — jugadores y familiares van directos a Mi equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coachAuthService.isAuthenticated).mockReturnValue(true);
  });

  it("redirige a un jugador directamente a /coach/dashboard", async () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player"]);

    renderAt();

    expect(await screen.findByText("Coach dashboard")).toBeInTheDocument();
  });

  it("redirige a un familiar de jugador directamente a /coach/dashboard", async () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["FamilyMember"]);

    renderAt();

    expect(await screen.findByText("Coach dashboard")).toBeInTheDocument();
  });

  it("muestra el selector a un jugador que también es entrenador", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player", "Coach"]);

    renderAt();

    expect(screen.getByText("Selecciona tu aplicación")).toBeInTheDocument();
  });

  it("muestra el selector a un jugador que debe volver a vincular su equipo", () => {
    vi.mocked(coachAuthService.getRoles).mockReturnValue(["Player"]);

    renderAt({ needsTeamRelink: true });

    expect(screen.getByText("Selecciona tu aplicación")).toBeInTheDocument();
  });
});
