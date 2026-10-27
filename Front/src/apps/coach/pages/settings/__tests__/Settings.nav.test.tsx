import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";

const mockGetRoles = vi.fn();
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getUserId: vi.fn().mockReturnValue("coach-1"),
    getToken: vi.fn().mockReturnValue(null),
    isAuthenticated: vi.fn().mockReturnValue(false),
    getRoles: () => mockGetRoles(),
    hasRole: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("../../../services/configurationCoachService", () => ({
  default: { getCurrent: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/seasonService", () => ({
  default: { getSeasons: vi.fn().mockResolvedValue([]), getActiveSeason: vi.fn().mockResolvedValue(null) },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "coach.active_season_changed",
}));

vi.mock("../components/Seasons/SeasonOption/SeasonOption", () => ({ default: () => <div>Panel Temporadas</div> }));
vi.mock("../components/ClubSelector/ClubSelector", () => ({ default: () => <div>Panel Clubes</div> }));
vi.mock("../components/MyTeams/MyTeams", () => ({ default: () => <div>Panel Equipos</div> }));
vi.mock("../components/NotificationSettings/NotificationSettings", () => ({
  default: () => <div>Panel Notificaciones</div>,
}));

import Settings from "../Settings";

const setMobile = (isMobile: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
};

const renderSettings = () =>
  render(
    <UserProvider>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </UserProvider>
  );

describe("Settings · navegación de secciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRoles.mockReturnValue(["Coach"]);
  });

  it("en escritorio marca la sección activa como página actual", async () => {
    setMobile(false);
    renderSettings();

    const nav = screen.getByRole("navigation", { name: /secciones de ajustes/i });
    expect(within(nav).getByRole("button", { name: /temporadas/i })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: /mis equipos/i })).not.toHaveAttribute("aria-current");
  });

  it("en escritorio cambia de sección al pulsar un botón del menú", async () => {
    setMobile(false);
    renderSettings();

    await userEvent.click(screen.getByRole("button", { name: /mis equipos/i }));

    expect(await screen.findByText("Panel Equipos")).toBeInTheDocument();
  });

  it("en móvil oculta la lista de secciones tras un selector", () => {
    setMobile(true);
    renderSettings();

    expect(screen.getByRole("button", { name: /sección.*temporadas/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /secciones de ajustes/i })).not.toBeInTheDocument();
  });

  it("en móvil despliega la lista y cambia de sección al elegir una", async () => {
    setMobile(true);
    renderSettings();

    await userEvent.click(screen.getByRole("button", { name: /sección.*temporadas/i }));
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /mis equipos/i }));

    expect(await screen.findByText("Panel Equipos")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("un jugador solo ve la sección Notificaciones", () => {
    setMobile(false);
    mockGetRoles.mockReturnValue(["Player"]);
    renderSettings();

    const nav = screen.getByRole("navigation", { name: /secciones de ajustes/i });
    expect(within(nav).getAllByRole("button")).toHaveLength(1);
    expect(within(nav).getByRole("button", { name: /notificaciones/i })).toBeInTheDocument();
  });
});
