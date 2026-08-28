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

// JSDOM does not implement scrollIntoView; stub it globally so any error-path
// call in production code does not throw during unrelated tests.
Element.prototype.scrollIntoView = vi.fn();

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

  // Rol "Seguidor" (Fan) oculto temporalmente en RoleSelector — se reactivará
  // cuando el rol vuelva a estar disponible en el selector de tipo de cuenta.
  it.skip("Fan: enables submit with just alias/email/password, no dialog, no code field", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Seguidor"));
    expect(
      screen.queryByText(/activar la licencia gratuita/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/código de invitación/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
  });

  it("Coach with club code: renders only one invitation code field, not two", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Entrenador"));
    fireEvent.click(screen.getByLabelText("Sí"));

    expect(screen.getAllByLabelText(/código de invitación de club/i)).toHaveLength(1);
  });

  // Rol "Directivo de club" (ClubDirector) oculto temporalmente en RoleSelector
  // — se reactivará cuando el rol vuelva a estar disponible en el selector.
  it.skip("ClubDirector: opens TrialConfirmDialog; cancel resets role and keeps submit disabled", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Directivo de club"));
    expect(screen.getByText(/activar la licencia gratuita/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeDisabled();
  });

  // Rol "Directivo de club" (ClubDirector) oculto temporalmente en RoleSelector
  // — se reactivará cuando el rol vuelva a estar disponible en el selector.
  it.skip("ClubDirector: accepting the trial closes the dialog and enables submit", async () => {
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
});

describe("Register — Player/FamilyMember player link code flow", () => {
  beforeEach(() => {
    vi.mocked(coachAuthService.registerPayingAccount).mockReset();
    vi.mocked(invitationsApi.previewClubCode).mockReset();
    vi.mocked(invitationsApi.previewTeamCode).mockReset();
  });

  it("Player: shows only the player link code field, no team code field nor roster picker", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));

    expect(screen.getByLabelText(/Código del jugador/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/código de invitación de equipo/i)).not.toBeInTheDocument();
    expect(invitationsApi.previewTeamCode).not.toHaveBeenCalled();
  });

  it("FamilyMember: shows only the player link code field, no team code field nor roster picker", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Familiar de jugador"));

    expect(screen.getByLabelText(/Código del jugador/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/código de invitación de equipo/i)).not.toBeInTheDocument();
  });

  it("Player: submit is disabled until the player link code field has content", () => {
    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));

    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "ABC123" },
    });

    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
  });

  it("Player: submits the payload with only playerLinkCode, no teamInvitationCode/teamPlayerId", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockResolvedValue({
      roles: [],
      status: "Active",
    } as any);

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "ABC123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(coachAuthService.registerPayingAccount).toHaveBeenCalledWith(
        expect.objectContaining({ playerLinkCode: "ABC123" })
      );
    });
    const payload = vi.mocked(coachAuthService.registerPayingAccount).mock.calls[0][0];
    expect(payload).not.toHaveProperty("teamInvitationCode");
    expect(payload).not.toHaveProperty("teamPlayerId");
  });

  it("Player: PlayerLinkCodeInvalid shows an error under the field and allows retrying (attempt 1)", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockRejectedValue({
      response: { data: { code: "PlayerLinkCodeInvalid" } },
    });

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "BADCODE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/does not match any player/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Código del jugador/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
  });

  it("Player: scrolls the title into view when submit fails, so the error alert is visible", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockRejectedValue({
      response: { data: { code: "PlayerLinkCodeInvalid" } },
    });
    const scrollIntoViewSpy = vi.spyOn(Element.prototype, "scrollIntoView");

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "BADCODE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    });
  });

  it("Player: allows a second retry after a second PlayerLinkCodeInvalid rejection", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockRejectedValue({
      response: { data: { code: "PlayerLinkCodeInvalid" } },
    });

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "BADCODE" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));
    await waitFor(() => {
      expect(coachAuthService.registerPayingAccount).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));
    await waitFor(() => {
      expect(coachAuthService.registerPayingAccount).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByLabelText(/Código del jugador/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
  });

  it("Player: locks the field and button after the 3rd consecutive PlayerLinkCodeInvalid rejection", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockRejectedValue({
      response: { data: { code: "PlayerLinkCodeInvalid" } },
    });

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "BADCODE" },
    });

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));
      await waitFor(() => {
        expect(coachAuthService.registerPayingAccount).toHaveBeenCalledTimes(i + 1);
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/número máximo de intentos/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Código del jugador/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeDisabled();
  });

  it("Player: LinkedPlayerAlreadyClaimed shows a form error and does not count as a code attempt", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockRejectedValue({
      response: { data: { code: "LinkedPlayerAlreadyClaimed" } },
    });

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "ABC123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/already has a linked account/i)
      ).toBeInTheDocument();
    });

    // Field/button remain enabled: this rejection is not counted as a code attempt.
    expect(screen.getByLabelText(/Código del jugador/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /Registrarse/i })).toBeEnabled();
    expect(screen.queryByText(/número máximo de intentos/i)).not.toBeInTheDocument();
  });

  it("Player: successful registration (status Active) shows the success message, no pending-approval notice", async () => {
    vi.mocked(coachAuthService.registerPayingAccount).mockResolvedValue({
      roles: [],
      status: "Active",
    } as any);

    renderRegister();
    fillBaseFields();
    fireEvent.click(screen.getByLabelText("Jugador"));
    fireEvent.change(screen.getByLabelText(/Código del jugador/i), {
      target: { value: "ABC123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(screen.getByText(/Registro exitoso/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/pendiente de aprobación/i)).not.toBeInTheDocument();
  });
});
