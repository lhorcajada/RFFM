import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SquadRatings from "../SquadRatings";

function renderSquadRatings(readOnly = false) {
  render(
    <MemoryRouter initialEntries={["/coach/squad"]}>
      <Routes>
        <Route
          path="/coach/squad"
          element={
            <SquadRatings
              teamId="team-1"
              players={[
                { teamPlayerId: "player-1", displayName: "Juan Pérez", position: "Delantero", dorsal: 9 },
              ]}
              latestRatings={{}}
              readOnly={readOnly}
            />
          }
        />
        <Route path="/coach/squad/rating-sheet" element={<div>Hoja de valoraciones</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SquadRatings — acceso a «Valorar plantilla»", () => {
  it("abre la hoja de valoraciones al pulsar «Valorar plantilla»", async () => {
    const user = userEvent.setup();
    renderSquadRatings();

    await user.click(screen.getByRole("button", { name: "Valorar plantilla" }));

    expect(screen.getByText("Hoja de valoraciones")).toBeInTheDocument();
  });

  it("no muestra «Valorar plantilla» en modo solo lectura", () => {
    renderSquadRatings(true);

    expect(screen.queryByRole("button", { name: "Valorar plantilla" })).not.toBeInTheDocument();
  });
});
