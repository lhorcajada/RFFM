import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventIcon from "@mui/icons-material/Event";
import LauncherTile from "../LauncherTile";

function renderTile(to = "/coach/attendance?teamId=team-1") {
  return render(
    <MemoryRouter>
      <LauncherTile title="Eventos" icon={<EventIcon />} to={to} />
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

  it("renders the short label text visibly beneath the icon", () => {
    renderTile();

    expect(screen.getByText("Eventos")).toBeInTheDocument();
  });

  it("never renders a description, unlike DashboardCard", () => {
    renderTile();

    // The tile has no description prop at all — nothing beyond the label text.
    const link = screen.getByRole("link", { name: "Eventos" });
    expect(link.textContent).toBe("Eventos");
  });
});
