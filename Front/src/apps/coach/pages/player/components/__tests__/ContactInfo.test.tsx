import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ContactInfo from "../ContactInfo";
import type { TeamPlayerResponse } from "../../../../services/teamplayerService";

function buildTeamPlayer(overrides: Partial<TeamPlayerResponse> = {}): TeamPlayerResponse {
  return {
    id: "tp-1",
    playerId: "p-1",
    player: { name: "Pedro", lastName: "Ruiz", alias: "Pedrito", dni: "12345678A" },
    teamId: "team-1",
    joinedDate: "2024-01-01",
    contactInfo: { phone: "600000000", email: "pedro@test.com", address: null },
    ...overrides,
  } as TeamPlayerResponse;
}

describe("ContactInfo", () => {
  it("muestra el DNI del jugador cuando está disponible", () => {
    render(<ContactInfo teamPlayer={buildTeamPlayer()} />);

    expect(screen.getByText(/^dni$/i)).toBeInTheDocument();
    expect(screen.getByText("12345678A")).toBeInTheDocument();
  });

  it("muestra 'Sin datos' cuando el jugador no tiene DNI registrado", () => {
    render(
      <ContactInfo
        teamPlayer={buildTeamPlayer({ player: { name: "Pedro", lastName: "Ruiz", alias: "Pedrito", dni: null } } as any)}
      />
    );

    expect(screen.getByText(/^dni$/i)).toBeInTheDocument();
  });
});
