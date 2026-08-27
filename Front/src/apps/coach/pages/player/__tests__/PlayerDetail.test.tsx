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
  familyMembers: [
    { name: "Ana", phone: "111", email: "ana@test.com", familyMember: "Mother" },
  ],
};

const mockForm = {
  familyMembers: [
    { name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 },
  ],
};

vi.mock("../hooks/usePlayerDetailData", () => ({
  usePlayerDetailData: () => ({
    teamPlayer: mockTeamPlayer,
    setTeamPlayer: vi.fn(),
    form: mockForm,
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

  it("muestra Editar para el rol Player (edición restringida)", () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage();

    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
  });

  it("muestra Editar para el rol FamilyMember (edición restringida)", () => {
    mockUsePermissions.mockReturnValue({ roles: ["FamilyMember"], loading: false });

    renderPage();

    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
  });

  it("permite el modo edición para Player cuando se navega con location.state.editing=true", () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("permite el modo edición para FamilyMember cuando se navega con location.state.editing=true", () => {
    mockUsePermissions.mockReturnValue({ roles: ["FamilyMember"], loading: false });

    renderPage({ editing: true });

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("muestra Editar para el rol Coach y al pulsarlo aparece Guardar", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });

    renderPage();

    const editButton = screen.getByRole("button", { name: /^editar$/i });
    expect(editButton).toBeInTheDocument();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(editButton);

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("muestra Editar para el rol Administrator", () => {
    mockUsePermissions.mockReturnValue({ roles: ["Administrator"], loading: false });

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
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.queryByRole("button", { name: /registrar lesión/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra 'Registrar lesión' para el rol FamilyMember", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["FamilyMember"], loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.queryByRole("button", { name: /registrar lesión/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra 'Registrar lesión' para el rol Coach", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.getByRole("button", { name: /registrar lesión/i }),
    ).toBeInTheDocument();
  });

  it("muestra 'Registrar lesión' para el rol Administrator", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Administrator"], loading: false });

    renderPage();
    await goToInjuriesTab();

    expect(
      screen.getByRole("button", { name: /registrar lesión/i }),
    ).toBeInTheDocument();
  });
});

describe("PlayerDetail — edición restringida por pestaña (Player/FamilyMember)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra controles de edición en Demarcación para el rol Player, aunque esté en modo edición", () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    // El tab activo por defecto es Demarcación (0).
    expect(screen.queryByLabelText(/posibles demarcaciones/i)).not.toBeInTheDocument();
  });

  it("muestra el formulario de Contacto para el rol Player en modo edición", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /contacto/i }));

    expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
  });

  it("muestra los campos de dirección (Calle, Ciudad, Código Postal) en Contacto en modo edición", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /contacto/i }));

    expect(screen.getByLabelText(/^calle$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ciudad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/código postal/i)).toBeInTheDocument();
  });

  it("muestra los campos de Enfermedades y Alergias en Físico en modo edición", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /físico/i }));

    expect(screen.getByLabelText(/^enfermedades$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^alergias$/i)).toBeInTheDocument();
  });

  it("muestra el campo Procedencia en Contacto en modo edición", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /contacto/i }));

    expect(screen.getByLabelText(/^procedencia$/i)).toBeInTheDocument();
  });

  it("muestra el formulario de Físico para el rol Player en modo edición", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /físico/i }));

    expect(screen.getByLabelText(/altura/i)).toBeInTheDocument();
  });

  it("muestra el formulario de edición de Familia para el rol Player en modo edición", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Player"], loading: false });

    renderPage({ editing: true });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /familia/i }));

    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
  });

  it("muestra el formulario de edición de Familia para el rol Coach en modo edición (nuevo, sin regresión)", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });

    renderPage();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: /^editar$/i }));
    await userEvent.click(screen.getByRole("tab", { name: /familia/i }));

    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
  });

  it("muestra controles de edición en Demarcación para el rol Coach en modo edición (sin regresión)", async () => {
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });

    renderPage();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: /^editar$/i }));

    expect(screen.getByLabelText(/posibles demarcaciones/i)).toBeInTheDocument();
  });
});
