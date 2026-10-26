import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import GameModelView from "../GameModelView";
import { mockGameModel } from "../../../../services/gameModelMock";
import type { GameModel, Principle } from "../../../../types/gameModel";

const attackPrinciple: Principle = {
  id: 10,
  gameMomentId: 2,
  gameMomentName: "Ataque Organizado",
  numero: 1,
  titulo: "Salir jugando desde el portero",
  texto: "Buscamos superioridad en la primera línea.",
  notas: [],
  subprincipios: [],
};

const twoPhaseModel: GameModel = {
  ...mockGameModel,
  principles: [...mockGameModel.principles, attackPrinciple],
};

describe("GameModelView — navegación por fases", () => {
  it("lista una fase por botón con el número de principios y selecciona la primera", () => {
    render(<GameModelView gameModel={twoPhaseModel} />);

    expect(screen.getByRole("button", { name: /Defensa Organizada/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Defensa Organizada/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /Ataque Organizado/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("muestra solo los principios de la fase seleccionada", () => {
    render(<GameModelView gameModel={twoPhaseModel} />);

    expect(screen.getByRole("heading", { name: "No permitir progresar al rival" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Salir jugando desde el portero" })).not.toBeInTheDocument();
  });

  it("cambia de fase al pulsar su botón", async () => {
    const user = userEvent.setup();
    render(<GameModelView gameModel={twoPhaseModel} />);

    await user.click(screen.getByRole("button", { name: /Ataque Organizado/ }));

    expect(screen.getByRole("button", { name: /Ataque Organizado/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Salir jugando desde el portero" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No permitir progresar al rival" })).not.toBeInTheDocument();
  });

  it("incluye la entrada «Balón parado» y muestra cada regla con su subtipo", async () => {
    const user = userEvent.setup();
    render(<GameModelView gameModel={mockGameModel} />);

    await user.click(screen.getByRole("button", { name: /Balón parado/ }));

    expect(screen.getByText("Córners defensivos")).toBeInTheDocument();
    expect(screen.getByText(/Defendemos con marcaje mixto/)).toBeInTheDocument();
  });

  it("no muestra «Balón parado» si el modelo no tiene reglas", () => {
    render(<GameModelView gameModel={{ ...mockGameModel, setPieceRules: [] }} />);

    expect(screen.queryByRole("button", { name: /Balón parado/ })).not.toBeInTheDocument();
  });
});

describe("GameModelView — tarjetas jerárquicas", () => {
  it("muestra principio y subprincipio con su número y título", () => {
    render(<GameModelView gameModel={mockGameModel} />);

    expect(screen.getByRole("heading", { name: "No permitir progresar al rival" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /1\.1.*Evitar que el rival supere nuestra primera línea de presión/,
      })
    ).toBeInTheDocument();
  });

  it("muestra la zona y el sub-subprincipio con su rol dentro del subprincipio", () => {
    render(<GameModelView gameModel={mockGameModel} />);

    expect(screen.getByText("Zona de Finalización")).toBeInTheDocument();
    expect(screen.getByText(/1\.1\.1/)).toBeInTheDocument();
    expect(screen.getByText("Delantero")).toBeInTheDocument();
  });

  it("muestra cada habilidad como chip", () => {
    render(<GameModelView gameModel={mockGameModel} />);

    expect(screen.getByText("Activación")).toBeInTheDocument();
    expect(screen.getByText("Perfilamiento")).toBeInTheDocument();
  });

  it("indica «misma que» cuando la habilidad referencia a otra", () => {
    const model: GameModel = structuredClone(mockGameModel);
    const habilidad = model.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].habilidades[0];
    habilidad.referenciaAKey = "hab-2";
    render(<GameModelView gameModel={model} />);

    expect(screen.getByText(/misma que hab-2/)).toBeInTheDocument();
  });

  it("muestra las notas con la etiqueta de su tipo", () => {
    render(<GameModelView gameModel={mockGameModel} />);

    expect(screen.getByText("Riesgo aceptado:")).toBeInTheDocument();
    expect(screen.getByText(/El lateral opuesto rival queda completamente libre/)).toBeInTheDocument();
  });

  it("no usa tablas", () => {
    render(<GameModelView gameModel={mockGameModel} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("GameModelView — pendientes y vacío", () => {
  it("muestra los pendientes abiertos aunque se cambie de fase", async () => {
    const user = userEvent.setup();
    render(<GameModelView gameModel={twoPhaseModel} />);

    await user.click(screen.getByRole("button", { name: /Ataque Organizado/ }));

    const panel = screen.getByRole("complementary", { name: /Pendientes abiertos/ });
    expect(within(panel).getByText(/Revisión de coherencia/)).toBeInTheDocument();
    expect(within(panel).getByText(/pendiente/)).toBeInTheDocument();
  });

  it("muestra un mensaje cuando el modelo no tiene contenido", () => {
    const empty: GameModel = {
      ...mockGameModel,
      principles: [],
      setPieceRules: [],
      openIssues: [],
    };
    render(<GameModelView gameModel={empty} />);

    expect(screen.getByText("Este modelo de juego todavía no tiene contenido.")).toBeInTheDocument();
  });
});
