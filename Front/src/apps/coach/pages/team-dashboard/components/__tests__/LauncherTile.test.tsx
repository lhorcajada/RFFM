import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import LauncherTile from "../LauncherTile";
import { EventsIllustration } from "../tileIllustrations";

function renderTile(to = "/coach/attendance?teamId=team-1") {
  return render(
    <MemoryRouter>
      <LauncherTile
        title="Eventos"
        illustration={<EventsIllustration />}
        gradient="linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #0a3880 100%)"
        to={to}
      />
    </MemoryRouter>,
  );
}

describe("LauncherTile", () => {
  it("renders a navigable link with the full title as its accessible name", () => {
    renderTile();

    const link = screen.getByRole("link", { name: "Eventos" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/coach/attendance?teamId=team-1");
  });

  it("renders the short label text visibly beneath the illustrated cover", () => {
    renderTile();

    expect(screen.getByText("Eventos")).toBeInTheDocument();
  });

  it("renders the illustration as an svg cover instead of a bare icon glyph", () => {
    const { container } = renderTile();

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("never renders a description, unlike DashboardCard", () => {
    renderTile();

    // The tile has no description prop at all — nothing beyond the cover and the label text.
    const link = screen.getByRole("link", { name: "Eventos" });
    expect(link.textContent).toBe("Eventos");
  });
});
