import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../components/ClubHeader/ClubHeader", () => ({
  default: () => <div data-testid="club-header" />,
}));

vi.mock("../hooks/useClubPendingRequests", () => ({
  useClubPendingRequests: () => ({ count: 2, loading: false }),
}));

vi.mock("../components/ClubQuickActions", () => ({
  default: (props: { clubId: string; seasonId?: string; pendingRequests?: number }) => (
    <div data-testid="quick-actions">{`${props.clubId}|${props.seasonId ?? ""}|${props.pendingRequests}`}</div>
  ),
}));

vi.mock("../components/ClubTeamsWidget", () => ({
  default: (props: { clubId: string; seasonId?: string }) => (
    <div data-testid="teams-widget">{`${props.clubId}|${props.seasonId ?? ""}`}</div>
  ),
}));

vi.mock("../components/ClubPendingWidget", () => ({
  default: (props: { clubId: string; pendingRequests: number }) => (
    <div data-testid="pending-widget">{`${props.clubId}|${props.pendingRequests}`}</div>
  ),
}));

import ClubsDashboard from "../Dashboard";

const renderPage = (url = "/coach/clubs/dashboard/club-1") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/coach/clubs/dashboard/:id" element={<ClubsDashboard />} />
        <Route path="/coach/dashboard" element={<div>Inicio coach</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ClubsDashboard", () => {
  it("muestra el club en la cabecera", () => {
    renderPage();

    expect(screen.getAllByTestId("club-header").length).toBeGreaterThan(0);
  });

  it("vuelve al inicio del coach con el botón Volver", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(screen.getByText("Inicio coach")).toBeInTheDocument();
  });

  it("compone equipos, acciones rápidas y pendientes del club", () => {
    renderPage();

    expect(screen.getByTestId("teams-widget")).toHaveTextContent("club-1|");
    expect(screen.getByTestId("quick-actions")).toHaveTextContent("club-1||2");
    expect(screen.getByTestId("pending-widget")).toHaveTextContent("club-1|2");
  });

  it("propaga la temporada seleccionada a los widgets", () => {
    renderPage("/coach/clubs/dashboard/club-1?seasonId=s-9");

    expect(screen.getByTestId("teams-widget")).toHaveTextContent("club-1|s-9");
    expect(screen.getByTestId("quick-actions")).toHaveTextContent("club-1|s-9|2");
  });
});
