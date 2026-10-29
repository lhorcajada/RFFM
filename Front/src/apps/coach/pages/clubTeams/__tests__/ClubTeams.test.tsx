import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockUseLocation = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => mockUseLocation(),
  };
});

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: () => undefined,
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    children,
    actionBar,
  }: {
    children: React.ReactNode;
    actionBar?: React.ReactNode;
  }) => (
    <div>
      <div>{actionBar}</div>
      {children}
    </div>
  ),
}));
vi.mock("../../../components/ClubHeader/ClubHeader", () => ({
  default: () => <div>Cabecera club</div>,
}));

const mockGetTeams = vi.fn();
const mockDeleteTeam = vi.fn();
const mockFetchTeamPhoto = vi.fn();
vi.mock("../../../services/teamService", () => ({
  default: {
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
    deleteTeam: (...args: unknown[]) => mockDeleteTeam(...args),
    fetchTeamPhoto: (...args: unknown[]) => mockFetchTeamPhoto(...args),
  },
}));
const mockGetSeasons = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  default: { getSeasons: (...args: unknown[]) => mockGetSeasons(...args) },
}));

const mockGetCurrent = vi.fn();
const mockCreateConfig = vi.fn();
const mockUpdateConfig = vi.fn();
vi.mock("../../../services/configurationCoachService", () => ({
  default: {
    getCurrent: (...args: unknown[]) => mockGetCurrent(...args),
    create: (...args: unknown[]) => mockCreateConfig(...args),
    update: (...args: unknown[]) => mockUpdateConfig(...args),
  },
}));
vi.mock("../../../services/authService", () => ({
  coachAuthService: { getUserId: () => "coach-1" },
}));

import ClubTeams from "../ClubTeams";

function makeTeam(id: string, name: string, category: string, league: string, joinCode?: string) {
  return {
    id,
    name,
    category: { id: 1, name: category },
    league: { id: 1, name: league },
    club: { id: "club-1", name: "FC Uno", country: { id: 1, name: "España", code: "ES" } },
    joinCode: joinCode ?? null,
    canEdit: true,
    standardHalfDurationMinutes: null,
  };
}

const teams = [
  makeTeam("t1", "Juvenil B", "Juvenil", "Liga Norte", "JUV123"),
  makeTeam("t2", "Cadete A", "Cadete", "Liga Sur"),
  makeTeam("t3", "Juvenil A", "Juvenil", "Liga Sur"),
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ClubTeams />
    </MemoryRouter>
  );
}

describe("ClubTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: "club-1" });
    mockUseLocation.mockReturnValue({ search: "?seasonId=s1" });
    mockGetTeams.mockResolvedValue(teams);
    mockGetSeasons.mockResolvedValue([{ id: "s1", name: "2026/27" }]);
    mockFetchTeamPhoto.mockResolvedValue(null);
    mockDeleteTeam.mockResolvedValue(undefined);
    mockGetCurrent.mockResolvedValue(null);
    mockCreateConfig.mockImplementation(async (req) => ({ id: 7, ...req }));
    mockUpdateConfig.mockImplementation(async (id, req) => ({ id, ...req }));
  });

  it("marca como preferido el equipo que indica la configuración del entrenador", async () => {
    mockGetCurrent.mockResolvedValue({ id: 3, coachId: "coach-1", preferredTeamId: "t2" });
    renderPage();
    expect(await screen.findByRole("button", { name: "Quitar equipo preferido" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Marcar como equipo preferido" })).toHaveLength(2);
  });

  it("crea la configuración con el equipo y el club cuando el entrenador no tenía ninguna", async () => {
    renderPage();
    await screen.findByText("Cadete A");
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como equipo preferido" })[0]);
    await waitFor(() =>
      expect(mockCreateConfig).toHaveBeenCalledWith({
        coachId: "coach-1",
        preferredClubId: "club-1",
        preferredTeamId: "t2",
      })
    );
    expect(await screen.findByRole("button", { name: "Quitar equipo preferido" })).toBeInTheDocument();
  });

  it("actualiza la configuración existente al elegir otro equipo preferido", async () => {
    mockGetCurrent.mockResolvedValue({ id: 3, coachId: "coach-1", preferredTeamId: "t1" });
    renderPage();
    await screen.findByText("Cadete A");
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como equipo preferido" })[0]);
    await waitFor(() =>
      expect(mockUpdateConfig).toHaveBeenCalledWith(3, {
        coachId: "coach-1",
        preferredClubId: "club-1",
        preferredTeamId: "t2",
      })
    );
    expect(mockCreateConfig).not.toHaveBeenCalled();
  });

  it("quita el equipo preferido conservando el club", async () => {
    mockGetCurrent.mockResolvedValue({ id: 3, coachId: "coach-1", preferredTeamId: "t2" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Quitar equipo preferido" }));
    await waitFor(() =>
      expect(mockUpdateConfig).toHaveBeenCalledWith(3, {
        coachId: "coach-1",
        preferredClubId: "club-1",
        preferredTeamId: null,
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Quitar equipo preferido" })).not.toBeInTheDocument()
    );
  });

  it("avisa del error y no cambia el preferido si falla el guardado", async () => {
    mockCreateConfig.mockRejectedValue({ response: { data: { detail: "Sin permiso" } } });
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    renderPage();
    await screen.findByText("Cadete A");
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como equipo preferido" })[0]);
    await waitFor(() => expect(listener).toHaveBeenCalled());
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: "Sin permiso",
      severity: "error",
    });
    expect(screen.queryByRole("button", { name: "Quitar equipo preferido" })).not.toBeInTheDocument();
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("agrupa los equipos por categoría en orden alfabético", async () => {
    renderPage();
    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Cadete", "Juvenil"]);
  });

  it("ordena los equipos de cada grupo por nombre", async () => {
    renderPage();
    await screen.findByText("Juvenil A");
    const names = screen.getAllByRole("link").map((l) => l.textContent ?? "");
    expect(names[1]).toContain("Juvenil A");
    expect(names[2]).toContain("Juvenil B");
  });

  it("enlaza cada tarjeta al dashboard del equipo con la temporada", async () => {
    renderPage();
    await screen.findByText("Cadete A");
    const link = screen.getByRole("link", { name: /Cadete A/ });
    expect(link).toHaveAttribute("href", "/coach/dashboard?teamId=t2&seasonId=s1");
  });

  it("muestra el contador de equipos visibles", async () => {
    renderPage();
    expect(await screen.findByText("3 equipos")).toBeInTheDocument();
  });

  it("filtra por categoría y actualiza el contador", async () => {
    renderPage();
    await screen.findByText("3 equipos");
    await userEvent.click(screen.getByRole("combobox", { name: "Categoría" }));
    await userEvent.click(await screen.findByRole("option", { name: "Cadete" }));
    expect(await screen.findByText("1 equipo")).toBeInTheDocument();
    expect(screen.queryByText("Juvenil A")).not.toBeInTheDocument();
  });

  it("muestra mensaje cuando los filtros no dejan equipos", async () => {
    renderPage();
    await screen.findByText("3 equipos");
    await userEvent.click(screen.getByRole("combobox", { name: "Categoría" }));
    await userEvent.click(await screen.findByRole("option", { name: "Cadete" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Liga" }));
    await userEvent.click(await screen.findByRole("option", { name: "Liga Norte" }));
    expect(
      await screen.findByText("No hay equipos con los filtros seleccionados.")
    ).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando el club no tiene equipos", async () => {
    mockGetTeams.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No hay equipos por mostrar.")).toBeInTheDocument();
  });

  it("muestra el error cuando falla la carga", async () => {
    mockGetTeams.mockRejectedValue(new Error("Fallo de red"));
    renderPage();
    expect(await screen.findByText("Fallo de red")).toBeInTheDocument();
  });

  it("elimina el equipo tras confirmar y recarga la lista", async () => {
    renderPage();
    await screen.findByText("Cadete A");
    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar equipo" })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mockDeleteTeam).toHaveBeenCalledWith("t2"));
    await waitFor(() => expect(mockGetTeams).toHaveBeenCalledTimes(2));
  });

  it("no elimina nada al cancelar la confirmación", async () => {
    renderPage();
    await screen.findByText("Cadete A");
    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar equipo" })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(mockDeleteTeam).not.toHaveBeenCalled();
  });

  it("copia el código del equipo y avisa al usuario", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    renderPage();
    await screen.findByText("Juvenil B");
    await userEvent.click(screen.getByRole("button", { name: "Copiar código de equipo" }));
    expect(writeText).toHaveBeenCalledWith("JUV123");
    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("navega a la edición del equipo conservando la temporada", async () => {
    renderPage();
    await screen.findByText("Cadete A");
    await userEvent.click(screen.getAllByRole("button", { name: "Editar equipo" })[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/coach/clubs/club-1/teams/t2/edit?seasonId=s1");
  });
});
