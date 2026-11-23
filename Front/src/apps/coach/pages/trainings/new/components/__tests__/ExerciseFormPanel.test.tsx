import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ExerciseFormPanel from "../ExerciseFormPanel";
import { emptyExercise } from "../../constants";
import type { ExerciseFormState } from "../../hooks/useExerciseForm";

function buildFormState(overrides: Partial<ExerciseFormState> = {}): ExerciseFormState {
  return {
    form: { ...emptyExercise },
    setField: vi.fn(),
    setNiveles: vi.fn(),
    setNivelDibujo: vi.fn(),
    drawingLevelCleared: false,
    sheetFit: { fits: true, overflowPx: 0, overflowingBlocks: [] },
    saving: false,
    error: null,
    pendingFile: null,
    previewUrl: null,
    fileInputRef: { current: null },
    loadExercise: vi.fn(),
    loadExerciseAsCopy: vi.fn(),
    savedExerciseId: null,
    handleFileChange: vi.fn(),
    handleRemoveMedia: vi.fn(),
    handleCancel: vi.fn(),
    handleSave: vi.fn(),
    ...overrides,
  } as ExerciseFormState;
}

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ExerciseFormPanel — campos del template reducido", () => {
  it("renderiza Tipo, Objetivo, Duración, Espacio, Turno y Qué se hace", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByRole("group", { name: /^tipo/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Objetivo")).toBeInTheDocument();
    expect(screen.getByLabelText(/duración/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Espacio")).toBeInTheDocument();
    expect(screen.getByLabelText(/turno/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Qué se hace")).toBeInTheDocument();
  });

  it("ya no ofrece Jugadores y objetivos, Secuencia, Qué se ve sin decir nada ni Organización (porteros)", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    for (const name of ["Jugadores y objetivos", "Secuencia", "Qué se ve sin decir nada", "Organización"]) {
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/porteros/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Añadir equipo" })).not.toBeInTheDocument();
  });

  it("ya no pide Logística, Descripción ni Objetivo por rol, que pasan a los campos estructurados", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByLabelText("Logística")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Descripción")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/objetivo por rol/i)).not.toBeInTheDocument();
  });

  it("no ofrece ninguna sección del modelo de juego: ese foco se elige en la sesión", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByText(/modelo de juego/i)).not.toBeInTheDocument();
  });

  it("renderiza el editor de Niveles con la marca del nivel que muestra el dibujo, y no el campo Dibujo de texto", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByRole("heading", { name: "Niveles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "El dibujo muestra el nivel 1" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^dibujo$/i })).not.toBeInTheDocument();
  });

  it("agrupa los campos en secciones apiladas, sin tablas", () => {
    const { container } = renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    const names = [
      "Clasificación",
      "Espacio y turno",
      "Objetivo",
      "Qué se hace",
      "Reglas",
      "Puntos",
      "Rotaciones",
      "Montaje",
      "Niveles",
      "Imagen / vídeo",
    ];
    const headings = names.map((name) => screen.getByRole("heading", { name }));
    headings.slice(1).forEach((heading, index) => {
      expect(headings[index].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(container.querySelector("table")).toBeNull();
  });

  it("no renderiza ninguna sección de Condiciones", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByText(/condiciones/i)).not.toBeInTheDocument();
  });

  it("muestra el error encima del formulario, antes de la primera sección", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ error: "Falta el objetivo" })} />);

    const alert = screen.getByRole("alert");
    const firstSection = screen.getByRole("heading", { name: "Clasificación" });

    expect(alert).toHaveTextContent("Falta el objetivo");
    expect(alert.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no muestra ningún aviso de error cuando no hay error", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("llama a setField con el tipo elegido al pulsar un botón de Tipo", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} />);

    await userEvent.click(screen.getByRole("button", { name: "Global" }));

    expect(setField).toHaveBeenCalledWith("tipo", "Global");
  });

  it("marca como pulsado el tipo actual", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.getByRole("button", { name: "Situacional" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Global" })).toHaveAttribute("aria-pressed", "false");
  });

  it("llama a setField con el subtipo elegido al cambiar el selector de Subtipo", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} />);

    await userEvent.click(screen.getByRole("combobox", { name: /subtipo/i }));
    await userEvent.click(screen.getByRole("option", { name: "Juego de posición" }));

    expect(setField).toHaveBeenCalledWith("subtipo", "JuegoDePosicion");
  });

  it("permite dejar el ejercicio sin subtipo", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(
      <ExerciseFormPanel
        panelVisible
        form={buildFormState({ setField, form: { ...emptyExercise, subtipo: "Rondos" } })}
      />
    );

    await userEvent.click(screen.getByRole("combobox", { name: /subtipo/i }));
    await userEvent.click(screen.getByRole("option", { name: "Sin subtipo" }));

    expect(setField).toHaveBeenCalledWith("subtipo", null);
  });
});

describe("ExerciseFormPanel — campos estructurados de la ficha", () => {
  it("guarda el espacio y el turno al escribirlos", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} />);

    await userEvent.type(screen.getByLabelText("Espacio"), "2");
    await userEvent.type(screen.getByLabelText(/turno/i), "3");

    expect(setField).toHaveBeenCalledWith("espacio", "2");
    expect(setField).toHaveBeenCalledWith("turnoMinutos", 3);
  });

  it("guarda Qué se hace en la descripción al escribirlo", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} />);

    await userEvent.type(screen.getByLabelText("Qué se hace"), "S");

    expect(setField).toHaveBeenCalledWith("descripcion", "S");
  });

  it("muestra la descripción de un ejercicio existente como Qué se hace", () => {
    renderPanel(
      <ExerciseFormPanel panelVisible form={buildFormState({ form: { ...emptyExercise, descripcion: "Se juega 4v2" } })} />,
    );

    expect(screen.getByLabelText("Qué se hace")).toHaveValue("Se juega 4v2");
  });

  it("añade una línea a las reglas, a los puntos, a las rotaciones y al montaje", async () => {
    const setField = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setField })} />);

    const addButtons = screen.getAllByRole("button", { name: "+ Añadir línea" });
    for (const button of addButtons) await userEvent.click(button);

    expect(addButtons).toHaveLength(4);
    expect(setField).toHaveBeenCalledWith("reglas", [""]);
    expect(setField).toHaveBeenCalledWith("puntos", [""]);
    expect(setField).toHaveBeenCalledWith("rotaciones", [""]);
    expect(setField).toHaveBeenCalledWith("montaje", [""]);
  });

  it("marca el nivel que muestra el dibujo", async () => {
    const setNivelDibujo = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ setNivelDibujo })} />);

    await userEvent.click(screen.getByRole("button", { name: "El dibujo muestra el nivel 2" }));

    expect(setNivelDibujo).toHaveBeenCalledWith(2);
  });

  it("avisa de que el contenido no cabe en una hoja, nombrando lo que se sale", () => {
    renderPanel(
      <ExerciseFormPanel
        panelVisible
        form={buildFormState({ sheetFit: { fits: false, overflowPx: 96, overflowingBlocks: ["Reglas"] } })}
      />,
    );

    expect(screen.getByText(/No cabe en una hoja A4: se sale «Reglas»/)).toBeInTheDocument();
  });

  it("no avisa del ajuste cuando el contenido cabe", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState()} />);

    expect(screen.queryByText(/No cabe en una hoja/)).not.toBeInTheDocument();
  });

  it("avisa de que se ha quitado el nivel del dibujo cuando se borró su fila", () => {
    renderPanel(<ExerciseFormPanel panelVisible form={buildFormState({ drawingLevelCleared: true })} />);

    expect(screen.getByText(/Has borrado el nivel que mostraba el dibujo/)).toBeInTheDocument();
  });
});
