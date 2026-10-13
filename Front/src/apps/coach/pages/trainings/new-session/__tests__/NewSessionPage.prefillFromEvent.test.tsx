import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => mockUseLocation(),
  };
});

vi.mock("../../../../services/trainingService", () => ({
  default: {
    getSessionById: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    getExercises: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../../services/seasonPlanService", () => ({
  default: { getByTeamIdAndSeason: vi.fn().mockResolvedValue(null) },
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../../services/sportEventService", () => ({
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
}));

import NewSessionPage from "../NewSessionPage";

function renderPage(search: string) {
  mockUseLocation.mockReturnValue({ pathname: "/coach/trainings/new-session", search: `?${search}`, state: null });
  return render(
    <MemoryRouter initialEntries={[`/coach/trainings/new-session?${search}`]}>
      <NewSessionPage />
    </MemoryRouter>
  );
}

describe("NewSessionPage — sesión nueva creada desde un evento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSportEventsMock.mockResolvedValue({
      items: [{ id: "event-1", eventType: "Entrenamiento", eveDateTime: "2026-09-10T18:00:00" }],
      pageNumber: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it("precarga la fecha del evento recibida en la URL", () => {
    renderPage("clubId=club-1&teamId=team-1&date=2026-09-10&sportEventId=event-1");

    expect(screen.getByLabelText(/^Fecha /i)).toHaveValue("2026-09-10");
  });

  it("deja seleccionado el evento deportivo recibido en la URL", async () => {
    renderPage("clubId=club-1&teamId=team-1&date=2026-09-10&sportEventId=event-1");

    const eventInput = await screen.findByLabelText(/Evento deportivo \(opcional\)/i);
    await waitFor(() => {
      expect((eventInput as HTMLInputElement).value).toMatch(/Entrenamiento/i);
    });
  });
});
