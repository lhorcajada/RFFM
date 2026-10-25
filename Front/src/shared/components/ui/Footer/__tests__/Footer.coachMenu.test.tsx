import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../apps/coach/services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue(null) },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
}));
vi.mock("../../../../../apps/federation/services/federationApi", () => ({
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../../context/UserContext", () => ({
  useUser: () => ({ user: null }),
}));
vi.mock("../../../../../apps/coach/services/authService", () => ({
  coachAuthService: { hasRole: vi.fn() },
}));

import Footer from "../Footer";
import { coachAuthService } from "../../../../../apps/coach/services/authService";

const hasRoleMock = coachAuthService.hasRole as ReturnType<typeof vi.fn>;

function renderFooter(path: string, hideMenu = true) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Footer hideMenu={hideMenu} />
    </MemoryRouter>
  );
}

describe("Footer — menú inferior de Coach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasRoleMock.mockImplementation((role: string) => role === "Coach");
  });

  it("muestra el acceso a Inicio que lleva al dashboard de coach desde cualquier página de coach", () => {
    renderFooter("/coach/squad");

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/coach/dashboard");
  });

  it("muestra el acceso a Configuración cuando el usuario es entrenador", () => {
    renderFooter("/coach/squad");

    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("href", "/coach/settings");
  });

  it("oculta el acceso a Configuración cuando el usuario no es entrenador", () => {
    hasRoleMock.mockReturnValue(false);

    renderFooter("/coach/team-dashboard");

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
  });

  it("no muestra las opciones del menú de federación en páginas de coach", () => {
    renderFooter("/coach/team-users", false);

    expect(screen.queryByRole("link", { name: "Calendario" })).not.toBeInTheDocument();
  });

  it("no muestra el menú Inicio/Configuración cuando la página tiene la navegación del equipo", () => {
    render(
      <MemoryRouter initialEntries={["/coach/squad"]}>
        <Footer hideMenu teamNav />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Inicio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
  });

  it("no muestra ningún menú fuera de coach cuando se oculta el menú", () => {
    renderFooter("/app-selector");

    expect(screen.queryByRole("link", { name: "Inicio" })).not.toBeInTheDocument();
  });
});
