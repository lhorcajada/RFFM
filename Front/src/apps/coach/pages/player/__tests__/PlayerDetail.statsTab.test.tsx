import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PlayerMatchRecord } from "../../convocations/components/simulation/liveMatch.types";

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
  familyMembers: [],
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

function buildRecord(overrides: Partial<PlayerMatchRecord> = {}): PlayerMatchRecord {
  return {
    eventId: "ev-1",
    minutesPlayed: 60,
    isStarter: true,
    enteredAtMinute: null,
    exitedAtMinute: null,
    goalsScored: 1,
    yellowCards: 2,
    redCards: 1,
    rivalName: "CD Rival",
    eventTypeId: 1,
    eventTypeName: "Partido",
    substitutionWindows: [],
    scoreLocal: 2,
    scoreVisitor: 1,
    matchDate: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

vi.mock("../hooks/usePlayerMatchHistory", () => ({
  usePlayerMatchHistory: () => ({
    matchHistory: [buildRecord()],
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/coach/player/tp-1", state: null }]}>
      <Routes>
        <Route path="/coach/player/:id" element={<PlayerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlayerDetail — pestaña Estadísticas: amarillas/rojas y tabla de partidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });
  });

  it("muestra los tiles de resumen 'amarillas' y 'rojas' con el acumulado del historial", async () => {
    renderPage();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /estadísticas/i }));

    expect(await screen.findByText("amarillas")).toBeInTheDocument();
    expect(screen.getByText("rojas")).toBeInTheDocument();
  });

  it("renderiza la tabla de historial de partidos con columna Rival", async () => {
    renderPage();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /estadísticas/i }));

    expect(await screen.findByText("CD Rival")).toBeInTheDocument();
  });
});
