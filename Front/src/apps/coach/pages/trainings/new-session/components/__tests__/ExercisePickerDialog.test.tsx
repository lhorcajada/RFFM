import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
}));

import ExercisePickerDialog from "../ExercisePickerDialog";
import type { Exercise } from "../../../../../types/training";

function buildExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "ex-x",
    name: "Ejercicio",
    tipo: "Analitico",
    objetivo: "",
    modelRelations: [],
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
    isAssociatedToGameModel: false,
    ...overrides,
  };
}

const exercises: Exercise[] = [
  buildExercise({ id: "ex-1", name: "Rondo 4v2", tipo: "Situacional", subtipo: "Rondos", durationMinutes: 12 }),
  buildExercise({ id: "ex-2", name: "Posesión 5v5", tipo: "Global", subtipo: "Posesion" }),
  buildExercise({ id: "ex-3", name: "Circuito físico", tipo: "Analitico", objetivo: "Mejorar la resistencia" }),
];

function setup(overrides: Partial<React.ComponentProps<typeof ExercisePickerDialog>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<ExercisePickerDialog exercises={exercises} onClose={onClose} onConfirm={onConfirm} {...overrides} />);
  return { onClose, onConfirm, user: userEvent.setup() };
}

const exerciseNames = () => screen.getAllByRole("checkbox").map((card) => card.getAttribute("aria-label"));

describe("ExercisePickerDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra todos los ejercicios del club como tarjetas", () => {
    setup();

    expect(exerciseNames()).toEqual(["Rondo 4v2", "Posesión 5v5", "Circuito físico"]);
  });

  it("muestra el tipo, el subtipo y la duración en la tarjeta de cada ejercicio", () => {
    setup();

    const card = screen.getByRole("checkbox", { name: "Rondo 4v2" });
    expect(within(card).getByText("Situacional")).toBeInTheDocument();
    expect(within(card).getByText("Rondos")).toBeInTheDocument();
    expect(within(card).getByText("12 min")).toBeInTheDocument();
  });

  it("busca por nombre ignorando tildes y mayúsculas", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Buscar ejercicio"), "POSESION");

    expect(exerciseNames()).toEqual(["Posesión 5v5"]);
  });

  it("busca también en el objetivo del ejercicio", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Buscar ejercicio"), "resistencia");

    expect(exerciseNames()).toEqual(["Circuito físico"]);
  });

  it("filtra por tipo de ejercicio", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Global" }));

    expect(exerciseNames()).toEqual(["Posesión 5v5"]);
  });

  it("filtra por subtipo, ofreciendo solo los subtipos que tienen ejercicios", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox", { name: "Subtipo" }));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Todos", "Posesión", "Rondos"]);

    await user.click(within(screen.getByRole("listbox")).getByText("Rondos"));

    expect(exerciseNames()).toEqual(["Rondo 4v2"]);
  });

  it("avisa cuando ningún ejercicio coincide con la búsqueda", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Buscar ejercicio"), "zzz");

    expect(screen.getByText("Ningún ejercicio coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("no deja añadir mientras no haya ningún ejercicio seleccionado", () => {
    setup();

    expect(screen.getByRole("button", { name: "Añadir" })).toBeDisabled();
  });

  it("añade de una vez todos los ejercicios seleccionados, en el orden en que se eligieron", async () => {
    const { user, onConfirm } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Circuito físico" }));
    await user.click(screen.getByRole("checkbox", { name: "Rondo 4v2" }));
    await user.click(screen.getByRole("button", { name: "Añadir (2)" }));

    expect(onConfirm).toHaveBeenCalledWith(["ex-3", "ex-1"]);
  });

  it("conserva la selección aunque el filtro deje de mostrar el ejercicio elegido", async () => {
    const { user, onConfirm } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Rondo 4v2" }));
    await user.type(screen.getByLabelText("Buscar ejercicio"), "circuito");
    await user.click(screen.getByRole("checkbox", { name: "Circuito físico" }));
    await user.click(screen.getByRole("button", { name: "Añadir (2)" }));

    expect(onConfirm).toHaveBeenCalledWith(["ex-1", "ex-3"]);
  });

  it("deselecciona un ejercicio al volver a pulsarlo", async () => {
    const { user } = setup();

    const card = screen.getByRole("checkbox", { name: "Rondo 4v2" });
    await user.click(card);
    expect(card).toBeChecked();
    await user.click(card);

    expect(card).not.toBeChecked();
  });

  it("señala los ejercicios que ya están en el bloque", () => {
    setup({ alreadyAddedIds: ["ex-2"] });

    expect(within(screen.getByRole("checkbox", { name: "Posesión 5v5" })).getByText("Ya en el bloque")).toBeInTheDocument();
    expect(within(screen.getByRole("checkbox", { name: "Rondo 4v2" })).queryByText("Ya en el bloque")).not.toBeInTheDocument();
  });

  it("al cancelar cierra el diálogo sin añadir nada", async () => {
    const { user, onClose, onConfirm } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Rondo 4v2" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
