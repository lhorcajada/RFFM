import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FamilyMembers from "../FamilyMembers";
import * as teamplayerService from "../../../../services/teamplayerService";
import { saveFamilyMemberCredentials } from "../../utils/familyMemberCredentials";
import i18next from "../../../../../../shared/i18n/i18n";
import { useIsPlayerRole } from "../../../../hooks/useIsPlayerRole";

vi.mock("../../../../services/teamplayerService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/teamplayerService")>(
    "../../../../services/teamplayerService"
  );
  return {
    ...actual,
    registerFamilyMemberAccount: vi.fn(),
    approveFamilyMemberAccountRequest: vi.fn(),
    rejectFamilyMemberAccountRequest: vi.fn(),
  };
});

vi.mock("../../../../hooks/useIsPlayerRole", () => ({
  useIsPlayerRole: vi.fn(() => false),
}));

function buildTeamPlayer(familyMembers: any[]) {
  return {
    id: "tp-1",
    playerId: "p-1",
    player: { name: "Pedro", lastName: "Ruiz" },
    teamId: "team-1",
    joinedDate: "2024-01-01",
    familyMembers,
  } as any;
}

describe("FamilyMembers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(useIsPlayerRole).mockReturnValue(false);
    localStorage.clear();
    await i18next.changeLanguage("es");
  });

  it("muestra el botón 'Registrar en la app' cuando el familiar no tiene cuenta", () => {
    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "None" },
    ]);

    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /registrar en la app/i })).toBeEnabled();
  });

  it("deshabilita el botón de registro cuando el familiar no tiene email guardado", () => {
    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: null, registrationStatus: "None" },
    ]);

    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /registrar en la app/i })).toBeDisabled();
  });

  it("al registrar con éxito guarda las credenciales y muestra el diálogo con el mensaje de WhatsApp", async () => {
    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "None" },
    ]);

    vi.mocked(teamplayerService.registerFamilyMemberAccount).mockResolvedValue({
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana García",
      playerName: "Pedro",
      status: "Pending",
    });

    const onFamilyMembersChange = vi.fn();
    const user = userEvent.setup();
    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={onFamilyMembersChange} />);

    await user.click(screen.getByRole("button", { name: /registrar en la app/i }));

    await waitFor(() => {
      expect(teamplayerService.registerFamilyMemberAccount).toHaveBeenCalledWith("fm-1");
    });

    await waitFor(() => {
      expect(screen.getByText("anagarcia")).toBeInTheDocument();
      expect(screen.getByText("Pedro1234!")).toBeInTheDocument();
    });

    expect(screen.getByText(/Usuario: anagarcia/)).toBeInTheDocument();
    expect(onFamilyMembersChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "fm-1", registrationStatus: "Pending" }),
    ]);
  });

  it("muestra el detalle del error del backend (email duplicado) en vez del mensaje genérico", async () => {
    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "None" },
    ]);

    vi.mocked(teamplayerService.registerFamilyMemberAccount).mockRejectedValue({
      response: {
        status: 400,
        data: {
          type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
          title: "No se pudo crear el usuario",
          status: 400,
          detail: "Email '2cvluis@gmail.com' is already taken.",
          code: "UserCreationFailed",
        },
      },
    });

    const user = userEvent.setup();
    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /registrar en la app/i }));

    await waitFor(() => {
      expect(screen.getByText("Email '2cvluis@gmail.com' is already taken.")).toBeInTheDocument();
    });

    expect(screen.queryByText(/no se pudo crear el usuario\. inténtalo de nuevo\./i)).not.toBeInTheDocument();
  });

  it("muestra el mensaje i18n genérico cuando el error UserCreationFailed no trae detalle", async () => {
    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "None" },
    ]);

    vi.mocked(teamplayerService.registerFamilyMemberAccount).mockRejectedValue({
      response: { status: 400, data: { code: "UserCreationFailed" } },
    });

    const user = userEvent.setup();
    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /registrar en la app/i }));

    await waitFor(() => {
      expect(screen.getByText("No se pudo crear el usuario. Inténtalo de nuevo.")).toBeInTheDocument();
    });
  });

  it("muestra el estado pendiente con botón Aprobar cuando hay credenciales guardadas", async () => {
    saveFamilyMemberCredentials("fm-1", {
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    });

    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "Pending" },
    ]);

    vi.mocked(teamplayerService.approveFamilyMemberAccountRequest).mockResolvedValue(undefined);

    const onFamilyMembersChange = vi.fn();
    const user = userEvent.setup();
    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={onFamilyMembersChange} />);

    expect(screen.getByText(/pendiente de aprobación/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^aprobar$/i }));

    await waitFor(() => {
      expect(teamplayerService.approveFamilyMemberAccountRequest).toHaveBeenCalledWith("req-1");
    });

    expect(onFamilyMembersChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "fm-1", registrationStatus: "Approved" }),
    ]);
  });

  it("permite reabrir el mensaje de WhatsApp desde las credenciales guardadas sin llamar al backend", async () => {
    saveFamilyMemberCredentials("fm-1", {
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    });

    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "Approved" },
    ]);

    const user = userEvent.setup();
    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    expect(screen.getByText(/cuenta activa/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ver mensaje de whatsapp/i }));

    expect(screen.getByText(/Usuario: anagarcia/)).toBeInTheDocument();
    expect(teamplayerService.registerFamilyMemberAccount).not.toHaveBeenCalled();
  });

  it("no muestra los botones de gestión de cuenta cuando el que mira la ficha es un Jugador/Familiar", () => {
    vi.mocked(useIsPlayerRole).mockReturnValue(true);
    saveFamilyMemberCredentials("fm-1", {
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    });

    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "Pending" },
    ]);

    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /registrar en la app/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^aprobar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver mensaje de whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/pendiente de aprobación/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("copia el mensaje de WhatsApp al portapapeles", async () => {
    saveFamilyMemberCredentials("fm-1", {
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    });

    const teamPlayer = buildTeamPlayer([
      { id: "fm-1", name: "Ana", lastName: "García", email: "ana@test.com", registrationStatus: "Approved" },
    ]);

    const user = userEvent.setup();
    render(<FamilyMembers teamPlayer={teamPlayer} onFamilyMembersChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /ver mensaje de whatsapp/i }));

    const clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardSpy },
      configurable: true,
      writable: true,
    });

    await user.click(screen.getByRole("button", { name: /copiar mensaje/i }));

    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledWith(
        "Hola Ana!\n\nYa tienes creada tu cuenta en la app de Fútbol Base para seguir a Pedro.\n\nUsuario: anagarcia\nContraseña: Pedro1234!\n\n¡Un saludo!"
      );
    });
  });
});
