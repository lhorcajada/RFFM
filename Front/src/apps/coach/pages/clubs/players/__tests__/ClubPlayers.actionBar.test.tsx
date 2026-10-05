import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../components/ClubHeader/ClubHeader", () => ({
  default: () => <div data-testid="club-header" />,
}));

vi.mock("../../../../components/ClubPlayerSearch/ClubPlayerSearch", () => ({
  default: () => <div data-testid="club-player-search" />,
}));

vi.mock("../../components/PreferredClubPlayersList", () => ({
  default: () => <div data-testid="preferred-club-players-list" />,
}));

vi.mock("../../../../services/playerService", () => ({
  getPlayersByClub: vi.fn().mockResolvedValue([]),
  createPlayer: vi.fn(),
}));

vi.mock("../../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

import ClubPlayers from "../ClubPlayers";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/coach/clubs/club-1/players"]}>
      <Routes>
        <Route path="/coach/clubs/:id/players" element={<ClubPlayers />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ClubPlayers — barra de acciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón Guardar en la barra de acciones junto a Volver", () => {
    renderPage();

    const saveButton = screen.getByRole("button", { name: "Guardar" });
    const backButton = screen.getByRole("button", { name: "Volver" });
    expect(saveButton.parentElement).toBe(backButton.parentElement);
  });

  it("avisa de que hay que seleccionar jugadores al pulsar Guardar sin selección", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Selecciona al menos un jugador antes de guardar."),
    ).toBeInTheDocument();
  });
});
