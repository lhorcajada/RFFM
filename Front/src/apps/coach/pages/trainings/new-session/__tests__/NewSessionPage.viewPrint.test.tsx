import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    getExerciseById: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    getExercises: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
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

const sessionDetail = {
  id: "session-1",
  name: "Sesión martes",
  description: "",
  date: null,
  startTime: null,
  blocks: [],
  targets: [],
};

function renderPage(search: string) {
  mockUseLocation.mockReturnValue({ pathname: "/coach/trainings/new-session", search: `?${search}`, state: null });
  return render(
    <MemoryRouter initialEntries={[`/coach/trainings/new-session?${search}`]}>
      <NewSessionPage />
    </MemoryRouter>
  );
}

function mockWindowOpen() {
  const print = vi.fn();
  const fakeWindow = {
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), readyState: "complete", images: [] },
    focus: vi.fn(),
    print,
    requestAnimationFrame: (cb: () => void) => cb(),
  };
  const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
  return { openSpy, print, fakeWindow };
}

describe("NewSessionPage — visualizar e imprimir la sesión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(sessionDetail);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deshabilita Visualizar e Imprimir PDF mientras la sesión no se ha guardado", () => {
    renderPage("clubId=club-1&teamId=team-1");

    expect(screen.getByRole("button", { name: "Visualizar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Imprimir PDF" })).toBeDisabled();
  });

  it("abre una ventana con la sesión al pulsar Visualizar, sin llamar a print()", async () => {
    const { print, fakeWindow } = mockWindowOpen();
    renderPage("clubId=club-1&teamId=team-1&sessionId=session-1");
    const user = userEvent.setup();

    const viewButton = screen.getByRole("button", { name: "Visualizar" });
    await waitFor(() => expect(viewButton).toBeEnabled());
    await user.click(viewButton);

    await waitFor(() => {
      expect(fakeWindow.document.write).toHaveBeenCalledWith(expect.stringContaining("Sesión martes"));
    });
    expect(print).not.toHaveBeenCalled();
  });

  it("abre una ventana y llama a print() al pulsar Imprimir PDF", async () => {
    const { print } = mockWindowOpen();
    renderPage("clubId=club-1&teamId=team-1&sessionId=session-1");
    const user = userEvent.setup();

    const printButton = screen.getByRole("button", { name: "Imprimir PDF" });
    await waitFor(() => expect(printButton).toBeEnabled());
    await user.click(printButton);

    await waitFor(() => expect(print).toHaveBeenCalled());
  });
});
