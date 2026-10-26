import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../components/SessionBlockEditor", () => ({
  default: () => <div data-testid="session-block-editor" />,
}));

const mockUseLocation = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn(), useLocation: () => mockUseLocation() };
});

vi.mock("../../../../services/trainingService", () => ({
  default: { getSessionById: vi.fn(), createSession: vi.fn(), updateSession: vi.fn(), getExercises: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../../../services/seasonService", () => ({ default: { getActiveSeason: vi.fn().mockResolvedValue(null) } }));
vi.mock("../../../../services/seasonPlanService", () => ({ default: { getByTeamIdAndSeason: vi.fn().mockResolvedValue(null) } }));
vi.mock("../../../../services/sportEventService", () => ({
  getSportEvents: vi.fn().mockResolvedValue({ items: [] }),
  default: { getSportEvents: vi.fn().mockResolvedValue({ items: [] }) },
}));

import NewSessionPage from "../NewSessionPage";

const DRAFT_PREFIX = "rffm.session-draft.";

function renderPage(search = "clubId=club-1&teamId=team-1") {
  mockUseLocation.mockReturnValue({ pathname: "/coach/trainings/new-session", search: `?${search}`, state: null });
  return render(
    <MemoryRouter initialEntries={[`/coach/trainings/new-session?${search}`]}>
      <NewSessionPage />
    </MemoryRouter>
  );
}

describe("NewSessionPage — diseño por secciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("agrupa los campos en las secciones Datos de la sesión, Cuándo y dónde y Resumen", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Datos de la sesión" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cuándo y dónde" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumen" })).toBeInTheDocument();
  });

  it("el resumen cuenta los bloques y los ejercicios de la sesión", () => {
    sessionStorage.setItem(
      DRAFT_PREFIX + "k",
      JSON.stringify({
        draft: {
          name: "Sesión",
          blocks: [
            { order: 1, nombre: "A", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "e1", position: 1 }, { exerciseId: "e2", position: 2 }] },
            { order: 2, nombre: "B", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "e3", position: 1 }] },
          ],
        },
        pendingBlockIndex: null,
      })
    );
    renderPage("clubId=club-1&teamId=team-1&sessionDraftKey=k");

    const summary = screen.getByRole("region", { name: "Resumen" });
    expect(within(summary).getByTestId("summary-blocks")).toHaveTextContent("2");
    expect(within(summary).getByTestId("summary-exercises")).toHaveTextContent("3");
  });
});
