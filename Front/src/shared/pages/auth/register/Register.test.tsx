import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Register from "./Register";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import { invitationsApi } from "../../../services/invitations/invitationsApi";
import { UserProvider } from "../../../context/UserContext";

vi.mock("../../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    registerPayingAccount: vi.fn(),
    getToken: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false),
    hasRole: vi.fn(() => false),
  },
}));

vi.mock("../../../services/invitations/invitationsApi", () => ({
  invitationsApi: { previewClubCode: vi.fn(), previewTeamCode: vi.fn() },
}));

function fillBaseFields() {
  fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), {
    target: { value: "user@test.com" },
  });
  fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
    target: { value: "testuser" },
  });
  fireEvent.change(screen.getByLabelText(/Contraseña/i), {
    target: { value: "S3cure!Pass" },
  });
}

function renderRegister() {
  return render(
    <MemoryRouter>
      <UserProvider>
        <Register />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("Register — role gating", () => {
  beforeEach(() => {
    vi.mocked(coachAuthService.registerPayingAccount).mockReset();
    vi.mocked(invitationsApi.previewClubCode).mockReset();
    vi.mocked(invitationsApi.previewTeamCode).mockReset();
  });

  it("Fan: enables submit with just alias/email/password, no dialog, no code field", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Seguidor"));
    expect(
      screen.queryByText(/activar la licencia gratuita/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/código de invitación/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
  });

  it("ClubDirector: opens TrialConfirmDialog; cancel resets role and keeps submit disabled", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Directivo de club"));
    expect(screen.getByText(/activar la licencia gratuita/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeDisabled();
  });

  it("ClubDirector: accepting the trial closes the dialog and enables submit", async () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Directivo de club"));
    fireEvent.click(screen.getByRole("button", { name: /Aceptar 7 días/i }));
    await waitFor(() => {
      expect(
        screen.queryByText(/activar la licencia gratuita/i)
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
  });

  it("Player: submits with the typed team invitation code, not an empty string", async () => {
    vi.mocked(invitationsApi.previewTeamCode).mockResolvedValue({
      teamId: "t1",
      teamName: "Test Team",
      clubId: "c1",
      membershipKind: "Player",
      players: [
        {
          teamPlayerId: "tp1",
          playerId: "p1",
          name: "John",
          lastName: "Doe",
          urlPhoto: null,
          dorsal: 10,
          alreadyLinked: false,
        },
      ],
    });
    vi.mocked(coachAuthService.registerPayingAccount).mockResolvedValue({
      roles: [],
      status: "Active",
    } as any);

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));

    const input = screen.getByLabelText(/código de invitación de equipo/i);
    fireEvent.change(input, { target: { value: "TEAM123" } });

    await waitFor(() => {
      expect(invitationsApi.previewTeamCode).toHaveBeenCalled();
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("John Doe"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(coachAuthService.registerPayingAccount).toHaveBeenCalledWith(
        expect.objectContaining({ teamInvitationCode: "TEAM123" })
      );
    });
  });
});
