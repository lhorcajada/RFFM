import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseLocation = vi.fn();
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
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

vi.mock("../../../../services/sportEventService", () => ({
  getSportEvents: vi.fn().mockResolvedValue({ items: [], pageNumber: 1, pageSize: 100, totalItems: 0, totalPages: 1 }),
  default: {
    getSportEvents: vi.fn().mockResolvedValue({ items: [], pageNumber: 1, pageSize: 100, totalItems: 0, totalPages: 1 }),
  },
}));

import NewSessionPage from "../NewSessionPage";

function renderPage(search = "clubId=club-1&teamId=team-1", state: unknown = null) {
  mockUseLocation.mockReturnValue({ pathname: "/coach/trainings/new-session", search: `?${search}`, state });
  return render(
    <MemoryRouter initialEntries={[`/coach/trainings/new-session?${search}`]}>
      <NewSessionPage />
    </MemoryRouter>
  );
}

describe("NewSessionPage — crear ejercicio nuevo inline desde un bloque", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("al pulsar 'Crear ejercicio nuevo' navega a la pantalla de nuevo ejercicio sin lanzar error", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Añadir bloque/i }));

    const createInlineButton = await screen.findByRole("button", { name: /Crear ejercicio nuevo/i });
    await user.click(createInlineButton);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("/coach/trainings/new-exercise"),
        expect.objectContaining({ state: expect.objectContaining({ sessionDraftKey: expect.any(String) }) })
      );
    });
  });

  it("conserva el destino de vuelta de la sesión para que al volver del ejercicio no se pierda el teamId", async () => {
    const boardUrl = "/coach/trainings/content-board?clubId=club-1&teamId=team-1";
    renderPage("clubId=club-1&teamId=team-1", { returnTo: boardUrl });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Añadir bloque/i }));
    await user.click(await screen.findByRole("button", { name: /Crear ejercicio nuevo/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringContaining("/coach/trainings/new-exercise"),
        expect.objectContaining({
          state: expect.objectContaining({ returnState: { returnTo: boardUrl } }),
        })
      );
    });
  });

  it("al volver del editor con un ejercicio recién creado lo deja asignado al bloque que lo pidió", async () => {
    const trainingService = (await import("../../../../services/trainingService")).default;
    vi.mocked(trainingService.getExercises).mockResolvedValue([
      { id: "ex-new", name: "Rondo 4v2", tipo: "Situacional" },
    ] as never);
    sessionStorage.setItem(
      "rffm.session-draft.draft-1",
      JSON.stringify({
        draft: {
          name: "Sesión martes",
          blocks: [
            { order: 1, nombre: "Calentamiento", rotacionEntreEjercicios: null, exercises: [] },
            { order: 2, nombre: "Parte principal", rotacionEntreEjercicios: null, exercises: [] },
          ],
        },
        pendingBlockIndex: 1,
      })
    );

    renderPage("clubId=club-1&teamId=team-1&sessionDraftKey=draft-1", { createdExerciseId: "ex-new" });

    const exerciseCard = await screen.findByRole("article", { name: "Rondo 4v2" });
    const blockNames = screen.getAllByLabelText("Nombre del bloque") as HTMLInputElement[];
    expect(blockNames.map((input) => input.value)).toEqual(["Calentamiento", "Parte principal"]);
    expect(exerciseCard.compareDocumentPosition(blockNames[1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("muestra el botón 'Volver' en lugar de 'Cancelar'", () => {
    renderPage();

    expect(screen.getByRole("button", { name: /^Volver$/i })).toBeInTheDocument();
  });
});
