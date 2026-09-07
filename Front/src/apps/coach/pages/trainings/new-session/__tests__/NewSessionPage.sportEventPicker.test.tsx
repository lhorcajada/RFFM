import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderPage(search = "clubId=club-1&teamId=team-1") {
  mockUseLocation.mockReturnValue({ pathname: "/coach/trainings/new-session", search: `?${search}`, state: null });
  return render(
    <MemoryRouter initialEntries={[`/coach/trainings/new-session?${search}`]}>
      <NewSessionPage />
    </MemoryRouter>
  );
}

describe("NewSessionPage — selector de evento deportivo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSportEventsMock.mockResolvedValue({ items: [], pageNumber: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
  });

  it("el selector de evento deportivo está deshabilitado cuando no hay fecha", () => {
    renderPage();

    expect(getSportEventsMock).not.toHaveBeenCalled();
    const input = screen.getByLabelText(/Evento deportivo \(elige antes una fecha\)/i);
    expect(input).toBeDisabled();
  });

  it("al introducir una fecha, consulta los eventos deportivos de ESE día para el equipo", async () => {
    renderPage();

    const dateInput = screen.getByLabelText(/^Fecha /i);
    fireEvent.change(dateInput, { target: { value: "2026-09-10" } });

    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenCalledWith("team-1", 1, 100, "2026-09-10", "2026-09-10");
    });
  });

  it("muestra un aviso claro cuando no hay eventos deportivos para la fecha elegida", async () => {
    renderPage();

    const dateInput = screen.getByLabelText(/^Fecha /i);
    fireEvent.change(dateInput, { target: { value: "2026-09-10" } });

    await waitFor(() => {
      expect(screen.getByText(/No hay eventos deportivos para esta fecha/i)).toBeInTheDocument();
    });
  });

  it("lista los eventos deportivos de esa fecha con una etiqueta legible (no el GUID)", async () => {
    getSportEventsMock.mockResolvedValue({
      items: [
        {
          id: "event-1",
          matchCategory: "League",
          eveDateTime: "2026-09-10T10:00:00",
          rivalName: "CD Rival",
        },
      ],
      pageNumber: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
    });
    renderPage();
    const user = userEvent.setup();

    const dateInput = screen.getByLabelText(/^Fecha /i);
    fireEvent.change(dateInput, { target: { value: "2026-09-10" } });

    const eventInput = await screen.findByLabelText(/Evento deportivo \(opcional\)/i);
    await user.click(eventInput);

    expect(await screen.findByText(/Liga.*vs CD Rival/i)).toBeInTheDocument();
  });

  it("al editar una sesión con sportEventId ya guardado, lo mantiene seleccionado si sigue apareciendo en la lista de esa fecha", async () => {
    const trainingService = (await import("../../../../services/trainingService")).default;
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sess-1",
      name: "Sesión existente",
      description: "",
      date: "2026-09-10",
      startTime: "10:00",
      endTime: null,
      location: null,
      sportEventId: "event-1",
      microcicloId: null,
      objetivoGeneral: null,
      mapaCampoTexto: null,
      urlImage: null,
      blocks: [],
      targets: [],
    });
    getSportEventsMock.mockResolvedValue({
      items: [
        {
          id: "event-1",
          matchCategory: "League",
          eveDateTime: "2026-09-10T10:00:00",
          rivalName: "CD Rival",
        },
      ],
      pageNumber: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
    });

    renderPage("clubId=club-1&teamId=team-1&sessionId=sess-1");

    const eventInput = await screen.findByLabelText(/Evento deportivo \(opcional\)/i);
    await waitFor(() => {
      expect((eventInput as HTMLInputElement).value).toMatch(/Liga.*vs CD Rival/i);
    });
  });
});
