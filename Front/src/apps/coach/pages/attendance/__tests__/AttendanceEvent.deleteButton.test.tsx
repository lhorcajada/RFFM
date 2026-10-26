import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children: React.ReactNode }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    team: { id: "team-1", name: "Equipo 1", club: { id: "club-1" } },
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    loading: false,
  })),
}));

const getSportEventByIdMock = vi.fn();
const deleteSportEventMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
  deleteSportEvent: (...args: unknown[]) => deleteSportEventMock(...args),
}));

vi.mock("../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../services/teamService", () => ({
  default: {
    getTeamById: vi.fn(),
    fetchTeamPhoto: vi.fn(),
  },
}));

vi.mock("../../../services/clubService", () => ({
  default: {
    getClubEmblem: vi.fn(),
  },
}));

vi.mock("../AttendanceTabs", () => ({
  default: () => null,
}));

const hasRoleMock = vi.fn(() => true);
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

import AttendanceEvent from "../AttendanceEvent";

const snackbarListener = vi.fn();
const onSnackbar = (e: Event) => snackbarListener((e as CustomEvent).detail);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/attendance/event-1"]}>
      <Routes>
        <Route path="/coach/attendance/:id" element={<AttendanceEvent />} />
        <Route path="/coach/attendance" element={<div>Listado de eventos</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function openConfirm() {
  await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
  return within(await screen.findByRole("dialog"));
}

describe("AttendanceEvent - botón Eliminar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasRoleMock.mockReturnValue(true);
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Entreno semanal",
      teamId: "team-1",
      eventType: "Entrenamiento",
    });
    window.addEventListener("rffm.show_snackbar", onSnackbar);
  });

  afterEach(() => {
    window.removeEventListener("rffm.show_snackbar", onSnackbar);
  });

  it("no muestra el botón cuando el usuario no tiene rol de edición", async () => {
    hasRoleMock.mockReturnValue(false);
    renderPage();

    await screen.findByText("Entreno semanal");
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  it("pide confirmación y no elimina si se cancela", async () => {
    renderPage();

    const dialog = await openConfirm();
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));

    expect(deleteSportEventMock).not.toHaveBeenCalled();
    expect(screen.getByText("Entreno semanal")).toBeInTheDocument();
  });

  it("elimina el evento al confirmar, avisa y vuelve al listado del equipo", async () => {
    deleteSportEventMock.mockResolvedValue(undefined);
    renderPage();

    const dialog = await openConfirm();
    await userEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText("Listado de eventos")).toBeInTheDocument();
    expect(deleteSportEventMock).toHaveBeenCalledWith("event-1");
    expect(snackbarListener).toHaveBeenCalledWith({ message: "Evento eliminado", severity: "success" });
  });

  it("avisa y vuelve al listado cuando el evento ya no existe (404)", async () => {
    deleteSportEventMock.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    const dialog = await openConfirm();
    await userEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText("Listado de eventos")).toBeInTheDocument();
    expect(snackbarListener).toHaveBeenCalledWith({ message: "El evento ya no existe", severity: "info" });
  });

  it("avisa del error y se queda en la página cuando falla la eliminación", async () => {
    deleteSportEventMock.mockRejectedValue({ response: { status: 500, data: { detail: "Fallo del servidor" } } });
    renderPage();

    const dialog = await openConfirm();
    await userEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(snackbarListener).toHaveBeenCalledWith({ message: "Fallo del servidor", severity: "error" })
    );
    expect(screen.getByText("Entreno semanal")).toBeInTheDocument();
    expect(screen.queryByText("Listado de eventos")).not.toBeInTheDocument();
  });
});
