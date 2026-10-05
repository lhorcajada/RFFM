import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../MatchesGrid/MatchesGrid", () => ({
  default: () => null,
}));

import RoundPanel from "../RoundPanel";

describe("RoundPanel", () => {
  it("muestra los partidos fuera del fin de semana de la jornada como Aplazados, no como Descanso", () => {
    render(
      <RoundPanel
        round={{
          partidos: [
            { fecha: "04-10-2025", equipo_local: "A", equipo_visitante: "B" },
            { fecha: "08-10-2025", equipo_local: "C", equipo_visitante: "D" },
          ],
        }}
      />
    );

    expect(screen.getByText("Aplazados")).toBeInTheDocument();
    expect(screen.queryByText("Descanso")).not.toBeInTheDocument();
  });
});
