import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TeamNote } from "../../../../services/teamNoteService";

const getTeamNotesMock = vi.fn();
const createTeamNoteMock = vi.fn();
const updateTeamNoteMock = vi.fn();
const deleteTeamNoteMock = vi.fn();
const hasRoleMock = vi.fn();

vi.mock("../../../../services/teamNoteService", () => ({
  getTeamNotes: (...args: unknown[]) => getTeamNotesMock(...args),
  createTeamNote: (...args: unknown[]) => createTeamNoteMock(...args),
  updateTeamNote: (...args: unknown[]) => updateTeamNoteMock(...args),
  deleteTeamNote: (...args: unknown[]) => deleteTeamNoteMock(...args),
}));

vi.mock("../../../../services/authService", () => ({
  coachAuthService: { hasRole: (...args: unknown[]) => hasRoleMock(...args) },
}));

import TeamNotesEditor from "../TeamNotesEditor";

const notes: TeamNote[] = [
  { id: "n1", teamId: "team-1", text: "Traed las dos equipaciones", order: 0 },
  { id: "n2", teamId: "team-1", text: "Espinilleras obligatorias", order: 1 },
];

describe("TeamNotesEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamNotesMock.mockResolvedValue(notes);
  });

  it("carga y muestra las notas del equipo", async () => {
    hasRoleMock.mockReturnValue(false);
    render(<TeamNotesEditor teamId="team-1" />);

    expect(await screen.findByText("Traed las dos equipaciones")).toBeInTheDocument();
    expect(screen.getByText("Espinilleras obligatorias")).toBeInTheDocument();
    expect(getTeamNotesMock).toHaveBeenCalledWith("team-1");
  });

  it("no muestra controles de añadir/editar/eliminar para roles distintos de Coach", async () => {
    hasRoleMock.mockReturnValue(false);
    render(<TeamNotesEditor teamId="team-1" />);

    await screen.findByText("Traed las dos equipaciones");

    expect(screen.queryByRole("button", { name: /añadir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it("permite a un Coach añadir una nueva nota", async () => {
    hasRoleMock.mockReturnValue(true);
    const created: TeamNote = { id: "n3", teamId: "team-1", text: "Nueva nota", order: 2 };
    createTeamNoteMock.mockResolvedValue(created);
    render(<TeamNotesEditor teamId="team-1" />);

    await screen.findByText("Traed las dos equipaciones");

    fireEvent.change(screen.getByPlaceholderText(/nueva nota/i), {
      target: { value: "Nueva nota" },
    });
    fireEvent.click(screen.getByRole("button", { name: /añadir/i }));

    await waitFor(() => expect(createTeamNoteMock).toHaveBeenCalledWith("team-1", "Nueva nota"));
    expect(await screen.findByText("Nueva nota")).toBeInTheDocument();
  });

  it("permite a un Coach editar una nota existente", async () => {
    hasRoleMock.mockReturnValue(true);
    const updated: TeamNote = { id: "n1", teamId: "team-1", text: "Texto editado", order: 0 };
    updateTeamNoteMock.mockResolvedValue(updated);
    render(<TeamNotesEditor teamId="team-1" />);

    await screen.findByText("Traed las dos equipaciones");

    fireEvent.click(screen.getAllByRole("button", { name: /editar/i })[0]);
    const input = screen.getByDisplayValue("Traed las dos equipaciones");
    fireEvent.change(input, { target: { value: "Texto editado" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(updateTeamNoteMock).toHaveBeenCalledWith("team-1", "n1", "Texto editado"),
    );
    expect(await screen.findByText("Texto editado")).toBeInTheDocument();
  });

  it("permite a un Coach eliminar una nota tras confirmar", async () => {
    hasRoleMock.mockReturnValue(true);
    deleteTeamNoteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TeamNotesEditor teamId="team-1" />);

    await screen.findByText("Traed las dos equipaciones");

    fireEvent.click(screen.getAllByRole("button", { name: /eliminar/i })[0]);

    await waitFor(() => expect(deleteTeamNoteMock).toHaveBeenCalledWith("team-1", "n1"));
    await waitFor(() =>
      expect(screen.queryByText("Traed las dos equipaciones")).not.toBeInTheDocument(),
    );
  });

  it("no elimina la nota si el Coach cancela la confirmación", async () => {
    hasRoleMock.mockReturnValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TeamNotesEditor teamId="team-1" />);

    await screen.findByText("Traed las dos equipaciones");

    fireEvent.click(screen.getAllByRole("button", { name: /eliminar/i })[0]);

    expect(deleteTeamNoteMock).not.toHaveBeenCalled();
    expect(screen.getByText("Traed las dos equipaciones")).toBeInTheDocument();
  });
});
