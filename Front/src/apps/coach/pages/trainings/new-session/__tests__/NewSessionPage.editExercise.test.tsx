import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    getExercises: vi.fn(),
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
import trainingService from "../../../../services/trainingService";

const DRAFT_PREFIX = "rffm.session-draft.";

function storeDraft(key: string, name: string) {
  sessionStorage.setItem(
    DRAFT_PREFIX + key,
    JSON.stringify({
      draft: {
        name,
        blocks: [
          { order: 1, nombre: "Bloque 1", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
        ],
      },
      pendingBlockIndex: null,
    })
  );
}

function renderPage(search: string) {
  mockUseLocation.mockReturnValue({ pathname: "/coach/trainings/new-session", search: `?${search}`, state: null });
  return render(
    <MemoryRouter initialEntries={[`/coach/trainings/new-session?${search}`]}>
      <NewSessionPage />
    </MemoryRouter>
  );
}

describe("NewSessionPage — editar un ejercicio de la sesión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (trainingService.getExercises as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ex-1", name: "Rondo con porterías", tipo: "Situacional", objetivo: "", descripcion: "", logistica: "" },
    ]);
  });

  it("al pulsar 'Editar ejercicio' navega al editor de ese ejercicio guardando el borrador de la sesión", async () => {
    storeDraft("old-key", "Sesión martes");
    renderPage("clubId=club-1&teamId=team-1&sessionDraftKey=old-key");
    const user = userEvent.setup();

    const card = await screen.findByRole("article", { name: "Rondo con porterías" });
    await user.click(within(card).getByRole("button", { name: /editar ejercicio/i }));

    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/coach\/trainings\/new-exercise\?.*exerciseId=ex-1/),
      expect.anything()
    );
    const [, options] = navigateMock.mock.calls[0];
    const returnParams = new URLSearchParams(options.state.returnTo.split("?")[1]);
    expect(returnParams.getAll("sessionDraftKey")).toHaveLength(1);
    const stored = JSON.parse(sessionStorage.getItem(DRAFT_PREFIX + returnParams.get("sessionDraftKey")) ?? "null");
    expect(stored.draft.name).toBe("Sesión martes");
  });

  it("al volver a una sesión guardada conserva los cambios del borrador en vez de los del servidor", async () => {
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "session-1",
      name: "Nombre del servidor",
      description: "",
      date: null,
      startTime: null,
      blocks: [],
      targets: [],
    });
    storeDraft("key-1", "Nombre sin guardar");

    renderPage("clubId=club-1&teamId=team-1&sessionId=session-1&sessionDraftKey=key-1");

    expect(await screen.findByText("Editar sesión")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Nombre sin guardar");
  });
});
