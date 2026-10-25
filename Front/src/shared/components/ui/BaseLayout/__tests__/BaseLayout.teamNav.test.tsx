import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../AppHeader/AppHeader", () => ({
  default: () => <div>app-header</div>,
}));

vi.mock("../../Footer/Footer", () => ({
  default: ({ teamNav }: { teamNav?: boolean }) => (
    <div>{teamNav ? "footer-with-team-nav" : "footer-default"}</div>
  ),
}));

vi.mock("../../../../../apps/coach/navigation/CoachTeamNav", () => ({
  default: () => <nav aria-label="Navegación del equipo" />,
}));

import BaseLayout from "../BaseLayout";

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BaseLayout hideFooterMenu>
        <div>page-content</div>
      </BaseLayout>
    </MemoryRouter>,
  );
}

describe("BaseLayout — navegación del equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la navegación del equipo en una página del equipo", () => {
    renderAt("/coach/squad?teamId=team-1");

    expect(screen.getByRole("navigation", { name: "Navegación del equipo" })).toBeInTheDocument();
    expect(screen.getByText("footer-with-team-nav")).toBeInTheDocument();
  });

  it("no muestra la navegación del equipo en el panel general", () => {
    renderAt("/coach/dashboard");

    expect(screen.queryByRole("navigation", { name: "Navegación del equipo" })).not.toBeInTheDocument();
    expect(screen.getByText("footer-default")).toBeInTheDocument();
  });

  it("no muestra la navegación del equipo fuera de la app Coach", () => {
    renderAt("/federation/dashboard");

    expect(screen.queryByRole("navigation", { name: "Navegación del equipo" })).not.toBeInTheDocument();
  });
});
