import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

const mockUseIsPlayerRole = vi.fn();
vi.mock("../../../hooks/useIsPlayerRole", () => ({
  default: () => mockUseIsPlayerRole(),
  useIsPlayerRole: () => mockUseIsPlayerRole(),
}));

vi.mock("../../../navigation/useTeamContextId", () => ({
  useTeamContextId: () => "team-1",
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({ teamTitleNode: <span>Infantil B</span>, team: null }),
}));

const mockGetActiveSeason = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  default: { getActiveSeason: () => mockGetActiveSeason() },
}));

import TeamMenu from "../TeamMenu";

function renderMenu() {
  render(
    <MemoryRouter initialEntries={["/coach/menu?teamId=team-1"]}>
      <TeamMenu />
    </MemoryRouter>,
  );
}

describe("TeamMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => true });
    mockUseIsPlayerRole.mockReturnValue(false);
    mockGetActiveSeason.mockResolvedValue({ id: "s1", name: "2026/27" });
  });

  it("muestra los grupos de secciones como encabezados", () => {
    renderMenu();

    for (const title of ["Equipo", "Actividad", "Competición", "Disciplina", "Otros", "Cuenta"]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("enlaza cada sección al equipo en contexto", () => {
    renderMenu();

    expect(screen.getByRole("link", { name: "Plantilla" })).toHaveAttribute(
      "href",
      "/coach/squad?teamId=team-1",
    );
  });

  it("muestra la temporada activa en la cabecera", async () => {
    renderMenu();

    expect(await screen.findByText("Temporada 2026/27")).toBeInTheDocument();
  });

  it("aplica las reglas del jugador: Mis documentos sí, Gestión de usuarios no", () => {
    mockUseIsPlayerRole.mockReturnValue(true);

    renderMenu();

    expect(screen.getByRole("link", { name: "Mis documentos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gestión de usuarios" })).not.toBeInTheDocument();
  });

  it("no muestra secciones restringidas mientras se cargan los permisos", () => {
    mockUsePermissions.mockReturnValue({ loading: true, hasFeatureAccess: () => true });

    renderMenu();

    expect(screen.queryByRole("link", { name: "Plantilla" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notificaciones" })).toBeInTheDocument();
  });

  it("filtra las secciones sin distinguir tildes ni mayúsculas", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.type(screen.getByRole("searchbox", { name: "Buscar sección" }), "CLASIFICACION");

    expect(screen.getByRole("link", { name: "Clasificación" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plantilla" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Equipo" })).not.toBeInTheDocument();
  });

  it("avisa cuando ninguna sección coincide con la búsqueda", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.type(screen.getByRole("searchbox", { name: "Buscar sección" }), "zzz");

    expect(screen.getByText("No hay ninguna sección con ese nombre.")).toBeInTheDocument();
  });
});
