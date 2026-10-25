import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { TeamResponse } from "../../../../services/teamService";
import PreferredTeamHero from "../PreferredTeamHero";

const team: TeamResponse = {
  id: "team-7",
  name: "Infantil B",
  category: { id: 3, name: "Infantil F11" },
  league: {},
  club: { id: "club-1", name: "CD Barrio", country: { id: 1, name: "España", code: "ES" } },
  canEdit: true,
  standardHalfDurationMinutes: null,
};

function renderHero(layout: "mobile" | "tablet" | "desktop" = "desktop") {
  return render(
    <MemoryRouter>
      <PreferredTeamHero team={team} teamImageUrl={null} clubEmblemUrl={null} layout={layout} />
    </MemoryRouter>,
  );
}

describe("PreferredTeamHero", () => {
  it("muestra el nombre del equipo, su club y su categoría", () => {
    renderHero();

    const hero = screen.getByRole("region", { name: /equipo preferido/i });
    expect(within(hero).getByRole("heading", { name: "Infantil B" })).toBeInTheDocument();
    expect(within(hero).getByText("CD Barrio")).toBeInTheDocument();
    expect(within(hero).getByText(/Infantil F11/)).toBeInTheDocument();
  });

  it("enlaza «Abrir panel» al panel del equipo preferido", () => {
    renderHero();

    expect(screen.getByRole("link", { name: /abrir panel/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=team-7",
    );
  });

  it("en móvil el enlace dice «Abrir panel del equipo» y apunta al mismo panel", () => {
    renderHero("mobile");

    expect(screen.getByRole("link", { name: /abrir panel del equipo/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=team-7",
    );
  });
});
