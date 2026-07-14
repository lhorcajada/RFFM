import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
      <div>{actionBar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({ teamTitleNode: "Equipo", clubSubtitleNode: null, loading: false }),
}));

const mockTeamPlayer = {
  id: "tp-1",
  dorsal: 9,
  player: { name: "Juan", lastName: "Pérez", alias: "Juanito" },
  demarcation: { activePositionName: "Delantero" },
};

vi.mock("../hooks/usePlayerDetailData", () => ({
  usePlayerDetailData: () => ({
    teamPlayer: mockTeamPlayer,
    setTeamPlayer: vi.fn(),
    form: {},
    setForm: vi.fn(),
    photo: null,
    setPhoto: vi.fn(),
    demarcationOptions: [],
  }),
}));

vi.mock("../hooks/usePlayerSave", () => ({
  usePlayerSave: () => ({ saving: false, handleSave: vi.fn() }),
}));

vi.mock("../hooks/usePlayerMatchHistory", () => ({
  usePlayerMatchHistory: () => ({
    matchHistory: [],
    loadingHistory: false,
    loadHistory: vi.fn(),
  }),
}));

vi.mock("../../../services/teamplayerService", () => ({
  createPlayerInjury: vi.fn(),
  getPlayerInjuries: vi.fn().mockResolvedValue([]),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import PlayerDetail from "../PlayerDetail";

function renderPage(initialState?: Record<string, unknown>) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/coach/player/tp-1", state: initialState ?? null }]}
    >
      <Routes>
        <Route path="/coach/player/:id" element={<PlayerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlayerDetail — visibilidad de edición según rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra Editar ni Guardar para el rol Player", () => {
    mockUsePermissions.mockReturnValue({ role: "Player", loading: false });

    renderPage();

    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  it("no muestra Editar ni Guardar para el rol FamilyMember", () => {
    mockUsePermissions.mockReturnValue({ role: "FamilyMember", loading: false });

    renderPage();

    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  it("no permite modo edición para Player aunque se navegue con location.state.editing=true", () => {
    mockUsePermissions.mockReturnValue({ role: "Player", loading: false });

    renderPage({ editing: true });

    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it("no permite modo edición para FamilyMember aunque se navegue con location.state.editing=true", () => {
    mockUsePermissions.mockReturnValue({ role: "FamilyMember", loading: false });

    renderPage({ editing: true });

    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it("muestra Editar para el rol Coach y al pulsarlo aparece Guardar", async () => {
    mockUsePermissions.mockReturnValue({ role: "Coach", loading: false });

    renderPage();

    const editButton = screen.getByRole("button", { name: /^editar$/i });
    expect(editButton).toBeInTheDocument();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(editButton);

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("muestra Editar para el rol Administrator", () => {
    mockUsePermissions.mockReturnValue({ role: "Administrator", loading: false });

    renderPage();

    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
  });
});

describe("PlayerDetail — visibilidad de 'Registrar lesión' según rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function goToInjuriesTab() {
    const { default: userEvent } = await import("@testing-library/user-event");
    const injuriesTab = screen.getByRole("tab", { name: /lesiones/i });
    await userEvent.click(injuriesTab);
  }

  it("no muestra 'Registrar lesión' para el rol Player", async () => {
    mockUsePermissions.mockReturnValue({ role: "Player", loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.queryByRole("button", { name: /registrar lesión/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra 'Registrar lesión' para el rol FamilyMember", async () => {
    mockUsePermissions.mockReturnValue({ role: "FamilyMember", loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.queryByRole("button", { name: /registrar lesión/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra 'Registrar lesión' para el rol Coach", async () => {
    mockUsePermissions.mockReturnValue({ role: "Coach", loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.getByRole("button", { name: /registrar lesión/i }),
    ).toBeInTheDocument();
  });

  it("muestra 'Registrar lesión' para el rol Administrator", async () => {
    mockUsePermissions.mockReturnValue({ role: "Administrator", loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.getByRole("button", { name: /registrar lesión/i }),
    ).toBeInTheDocument();
  });
});
