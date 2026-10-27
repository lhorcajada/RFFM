import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

function renderAppSelector() {
  return render(
    <MemoryRouter>
      <UserProvider>
        <AppSelector />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppSelector — rediseño", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coachAuthService.isAuthenticated).mockReturnValue(true);
    vi.mocked(coachAuthService.getRoles).mockReturnValue([]);
  });

  it("muestra la etiqueta de marca y la línea de ayuda en la cabecera", () => {
    renderAppSelector();

    expect(screen.getByText("FutbolBase")).toBeInTheDocument();
    expect(screen.getByText(/Elige desde dónde quieres trabajar/)).toBeInTheDocument();
  });

  it("muestra quién puede acceder a Federación", () => {
    renderAppSelector();

    expect(screen.getByText("Acceso: administración y federación")).toBeInTheDocument();
  });

  it("muestra quién puede acceder a Mi equipo", () => {
    renderAppSelector();

    expect(screen.getByText("Entrenadores, jugadores y familias")).toBeInTheDocument();
  });

  it("muestra la acción «Entrar» en cada tarjeta", () => {
    renderAppSelector();

    expect(screen.getAllByText("Entrar")).toHaveLength(2);
  });
});
