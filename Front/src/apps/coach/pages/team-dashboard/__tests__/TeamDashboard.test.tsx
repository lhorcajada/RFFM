import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    team: null,
  })),
}));

const mockUsePlayerAutoLoad = vi.fn();
vi.mock("../../Dashboard/hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: () => mockUsePlayerAutoLoad(),
}));

vi.mock("../TeamDashboardCards", () => ({
  default: () => <div>TeamDashboardCards</div>,
}));

vi.mock("../components/UpcomingEventsWidget", () => ({
  default: () => <div>upcoming-events-widget</div>,
}));

vi.mock("../components/NewsWidget", () => ({
  default: () => <div>news-widget</div>,
}));

import TeamDashboard from "../TeamDashboard";

describe("TeamDashboard back button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Volver' and navigates to /appSelector when the user is a player", async () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: true });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Volver" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/appSelector");
  });

  it("shows 'Volver al dashboard de entrenador' and navigates to /coach/dashboard when the user is a coach", async () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Volver al dashboard de entrenador" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/coach/dashboard");
  });
});

describe("TeamDashboard — A la vista section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
  });

  it("renders the upcoming-events and news widgets above the dashboard cards", () => {
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const widgetOrder = screen.getAllByText(
      /upcoming-events-widget|news-widget|TeamDashboardCards/
    );
    const texts = widgetOrder.map((el) => el.textContent);

    expect(texts.indexOf("upcoming-events-widget")).toBeLessThan(
      texts.indexOf("TeamDashboardCards")
    );
    expect(texts.indexOf("news-widget")).toBeLessThan(texts.indexOf("TeamDashboardCards"));
  });

  it("wraps the page content in a bottom-padded container so the last card isn't hidden behind the footer", () => {
    const { container } = render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    // TeamDashboardCards is the last item rendered — it must sit inside a
    // container that reserves extra bottom space (mirrors the pattern
    // already used elsewhere, e.g. Clubs.module.css's `.wrapper`), not flush
    // against the end of the scroll area.
    const cards = screen.getByText("TeamDashboardCards");
    const paddedAncestor = cards.closest('[class*="pageContent"]');
    expect(paddedAncestor).not.toBeNull();
    expect(container.contains(paddedAncestor)).toBe(true);
  });

  it("renders both widgets and the tiles as direct siblings inside the same dashboardGrid (so they flow through the same rows)", () => {
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const eventsWidget = screen.getByText("upcoming-events-widget");
    const newsWidget = screen.getByText("news-widget");
    const cards = screen.getByText("TeamDashboardCards");
    const dashboardGrid = eventsWidget.closest('[class*="dashboardGrid"]');

    expect(dashboardGrid).not.toBeNull();
    // All three must be direct children — the shared grid (desktop: 4
    // columns, mobile: 2) only lands each in its own cell if they're
    // actually siblings there, not nested inside another wrapper.
    expect(Array.from(dashboardGrid!.children)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textContent: "upcoming-events-widget" }),
        expect.objectContaining({ textContent: "news-widget" }),
        expect.objectContaining({ textContent: "TeamDashboardCards" }),
      ])
    );
    expect(dashboardGrid!.contains(newsWidget)).toBe(true);
    expect(dashboardGrid!.contains(cards)).toBe(true);
  });
});
