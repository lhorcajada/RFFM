import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../../context/UserContext", () => ({
  useUser: () => ({ user: null }),
}));
vi.mock("../../../../hooks/usePrimaryTeam", () => ({
  default: () => ({ isPrimary: () => false }),
}));

import MatchCard from "../MatchCard";

const item = {
  match: { codacta: "5440937", equipo_local: "CD Local", equipo_visitante: "UD Visitante", goles_casa: "1", goles_visitante: "0" },
};

describe("MatchCard - enlace de acta personalizado", () => {
  it("con hideActaButton y un enlace resuelto muestra «Ver acta» apuntando a ese enlace", () => {
    render(
      <MemoryRouter>
        <MatchCard item={item} hideActaButton resolveActaLink={(codacta) => (codacta === "5440937" ? "/coach/match-report?eventId=e1" : null)} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Ver acta" })).toHaveAttribute("href", "/coach/match-report?eventId=e1");
  });

  it("con hideActaButton y sin enlace resuelto no muestra un botón accesible", () => {
    render(
      <MemoryRouter>
        <MatchCard item={item} hideActaButton resolveActaLink={() => null} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Ver acta" })).not.toBeInTheDocument();
  });
});
