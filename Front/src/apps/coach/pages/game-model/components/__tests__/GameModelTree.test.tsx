import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import GameModelTree from "../GameModelTree";
import { mockGameModel } from "../../../../services/gameModelMock";
import type { GameModel, Principle } from "../../../../types/gameModel";

describe("GameModelTree — read view reproduces the legible document's structure", () => {
  it("renders Fases in document order with numbered Principios and Subprincipios", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(screen.getByRole("heading", { level: 2, name: "Defensa Organizada" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "1. No permitir progresar al rival." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "Subprincipio 1.1 — Evitar que el rival supere nuestra primera línea de presión.",
      })
    ).toBeInTheDocument();
  });

  it("renders Zona blocks nested under their Subprincipio", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(screen.getByRole("heading", { level: 5, name: "Zona de Finalización" })).toBeInTheDocument();
  });

  it("renders SubSubPrincipio with its Rol and Habilidades as a bullet list", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(screen.getByText(/Sub-subprincipio 1\.1\.1 — Delantero:/)).toBeInTheDocument();
    expect(screen.getByText("Activación", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Entrenable: Presión iniciada/)).toBeInTheDocument();
  });

  it("renders a SubSubPrincipio hanging directly off a Subprincipio with no Zona", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "Subprincipio 2.1 — Robar el balón cuando el rival no controla bien.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sub-subprincipio 2\.1\.1 — Jugador más cercano al balón:/)).toBeInTheDocument();
  });

  it("renders Notas styled by tipo near their anchor", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(screen.getByText(/Riesgo aceptado:/)).toBeInTheDocument();
    expect(screen.getByText(/El lateral opuesto rival queda completamente libre/)).toBeInTheDocument();
  });

  it("renders a flat Balón parado section listing SetPieceRules by subtype", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(screen.getByRole("heading", { level: 2, name: "Balón parado" })).toBeInTheDocument();
    expect(screen.getByText(/Córners defensivos\./)).toBeInTheDocument();
    expect(screen.getByText(/Defendemos con marcaje mixto/)).toBeInTheDocument();
  });

  it("renders OpenIssues as pending decisions", () => {
    render(<GameModelTree gameModel={mockGameModel} />);

    expect(screen.getByRole("heading", { level: 2, name: "Pendientes abiertos" })).toBeInTheDocument();
    expect(screen.getByText(/pendiente/)).toBeInTheDocument();
  });

  it("renders an empty-state message when the model has no content", () => {
    const empty: GameModel = {
      id: "",
      teamId: "team-1",
      name: "Modelo vacío",
      season: "2025/2026",
      principles: [],
      setPieceRules: [],
      openIssues: [],
    };
    render(<GameModelTree gameModel={empty} />);

    expect(screen.getByText(/todavía no tiene contenido/)).toBeInTheDocument();
  });

  it("print variant renders the same structure (hidden-until-print root)", () => {
    const { container } = render(<GameModelTree gameModel={mockGameModel} print />);

    expect(screen.getByRole("heading", { level: 2, name: "Defensa Organizada" })).toBeInTheDocument();
    expect(container.firstElementChild?.className).toMatch(/printRoot/);
  });

  it("renders Subprincipios in numeric order regardless of input array order", () => {
    const outOfOrderPrinciple: Principle = {
      id: 99,
      key: "fase-99",
      gameMomentId: 1,
      gameMomentName: "Defensa Organizada",
      numero: 99,
      titulo: "Principio de orden",
      texto: "",
      notas: [],
      subprincipios: [
        { id: 3, key: "sp-1.10", numero: "1.10", titulo: "Décimo", texto: "", notas: [], zonas: [], subSubPrincipios: [] },
        { id: 1, key: "sp-1.1", numero: "1.1", titulo: "Primero", texto: "", notas: [], zonas: [], subSubPrincipios: [] },
        { id: 2, key: "sp-1.2", numero: "1.2", titulo: "Segundo", texto: "", notas: [], zonas: [], subSubPrincipios: [] },
      ],
    };
    const model: GameModel = {
      id: "order-test",
      teamId: "team-1",
      name: "Orden",
      season: "2025/2026",
      principles: [outOfOrderPrinciple],
      setPieceRules: [],
      openIssues: [],
    };

    render(<GameModelTree gameModel={model} />);

    const headings = screen
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      expect.stringContaining("Subprincipio 1.1"),
      expect.stringContaining("Subprincipio 1.2"),
      expect.stringContaining("Subprincipio 1.10"),
    ]);
  });

  it("renders SubSubPrincipios in numeric order regardless of input array order", () => {
    const principle: Principle = {
      id: 98,
      key: "fase-98",
      gameMomentId: 1,
      gameMomentName: "Defensa Organizada",
      numero: 98,
      titulo: "Principio de orden SSP",
      texto: "",
      notas: [],
      subprincipios: [
        {
          id: 1,
          key: "sp-2.1",
          numero: "2.1",
          titulo: "Directo",
          texto: "",
          notas: [],
          zonas: [],
          subSubPrincipios: [
            { id: 3, key: "ssp-2.1.10", numero: "2.1.10", rol: "Décimo", texto: "", habilidades: [], notas: [] },
            { id: 1, key: "ssp-2.1.1", numero: "2.1.1", rol: "Primero", texto: "", habilidades: [], notas: [] },
            { id: 2, key: "ssp-2.1.2", numero: "2.1.2", rol: "Segundo", texto: "", habilidades: [], notas: [] },
          ],
        },
      ],
    };
    const model: GameModel = {
      id: "order-test-ssp",
      teamId: "team-1",
      name: "Orden SSP",
      season: "2025/2026",
      principles: [principle],
      setPieceRules: [],
      openIssues: [],
    };

    render(<GameModelTree gameModel={model} />);

    const sspTexts = screen.getAllByText(/^Sub-subprincipio/).map((el) => el.textContent);
    expect(sspTexts[0]).toContain("2.1.1");
    expect(sspTexts[1]).toContain("2.1.2");
    expect(sspTexts[2]).toContain("2.1.10");
  });

  it("Fases are collapsible: clicking the header hides its content, clicking again shows it", async () => {
    const user = userEvent.setup();
    render(<GameModelTree gameModel={mockGameModel} />);

    const fase = screen.getByRole("heading", { level: 2, name: "Defensa Organizada" }).closest("section")!;
    expect(within(fase).getByText(/No permitir progresar al rival/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Defensa Organizada/ }));
    expect(within(fase).queryByText(/No permitir progresar al rival/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Defensa Organizada/ }));
    expect(within(fase).getByText(/No permitir progresar al rival/)).toBeInTheDocument();
  });

  it("print variant renders Fases always expanded, without a collapse toggle", () => {
    render(<GameModelTree gameModel={mockGameModel} print />);

    expect(screen.queryByRole("button", { name: /Defensa Organizada/ })).not.toBeInTheDocument();
  });
});
