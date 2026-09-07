import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import AdnDraggableTree from "../AdnDraggableTree";
import type { GameModel } from "../../../../types/gameModel";

function buildGameModel(): GameModel {
  return {
    id: "model-1",
    teamId: "team-1",
    name: "Modelo",
    season: "2026-2027",
    principles: [
      {
        id: 1,
        apiId: "principle-1",
        gameMomentId: 1,
        gameMomentName: "Fase defensiva",
        numero: 1,
        titulo: "Defensa organizada",
        texto: "",
        subprincipios: [
          {
            id: 1,
            apiId: "sub-1",
            numero: "1.1",
            titulo: "Presión alta",
            texto: "",
            zonas: [
              {
                id: 1,
                apiId: "zona-1",
                zoneKeys: ["iniciacion"],
                label: "Ataque del centro",
                zonaTexto: null,
                texto: "",
                subSubPrincipios: [
                  {
                    id: 1,
                    apiId: "ssp-1",
                    numero: "1.1.1",
                    rol: "Delantero",
                    texto: "Presión al central cortando línea de pase al portero para forzar el error.",
                    habilidades: [],
                    notas: [],
                  },
                ],
                notas: [],
              },
            ],
            subSubPrincipios: [],
            notas: [],
          },
        ],
        notas: [],
      },
    ],
    setPieceRules: [],
    openIssues: [],
  };
}

function renderTree() {
  return render(
    <DndContext>
      <AdnDraggableTree gameModel={buildGameModel()} coverage={null} />
    </DndContext>
  );
}

describe("AdnDraggableTree — título derivado y descripción del sub-subprincipio", () => {
  it("compone el título con numero, rol y un resumen de texto entre paréntesis", () => {
    renderTree();

    expect(
      screen.getByText("1.1.1 — Delantero (Presión al central cortando línea de pase al portero para…)")
    ).toBeInTheDocument();
  });

  it("muestra siempre visible la descripción completa (texto) del sub-subprincipio, sin depender de un tooltip", () => {
    renderTree();

    expect(
      screen.getByText("Presión al central cortando línea de pase al portero para forzar el error.")
    ).toBeInTheDocument();
  });
});

describe("AdnDraggableTree — plegado/desplegado por cabecera", () => {
  it("todos los niveles están expandidos por defecto (Fase, Principio, Subprincipio, Zona)", () => {
    renderTree();

    expect(screen.getByText(/Defensa organizada/)).toBeInTheDocument();
    expect(screen.getByText(/Presión alta/)).toBeInTheDocument();
    expect(screen.getByText(/Ataque del centro/)).toBeInTheDocument();
    expect(screen.getByText(/1\.1\.1 — Delantero/)).toBeInTheDocument();
  });

  it("colapsar la cabecera de Fase oculta sus Principios", async () => {
    renderTree();

    await userEvent.click(screen.getByRole("button", { name: /fase defensiva/i }));

    expect(screen.queryByText(/Defensa organizada/)).not.toBeInTheDocument();
  });

  it("colapsar la cabecera de Principio oculta sus Subprincipios", async () => {
    renderTree();

    await userEvent.click(screen.getByRole("button", { name: /defensa organizada/i }));

    expect(screen.queryByText(/Presión alta/)).not.toBeInTheDocument();
  });

  it("colapsar la cabecera de Subprincipio oculta sus Zonas/Sub-subprincipios", async () => {
    renderTree();

    await userEvent.click(screen.getByRole("button", { name: /colapsar 1\.1/i }));

    expect(screen.queryByText(/Ataque del centro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\.1\.1 — Delantero/)).not.toBeInTheDocument();
  });

  it("colapsar la cabecera de Zona oculta sus Sub-subprincipios y expandir la vuelve a mostrar", async () => {
    renderTree();

    const zonaToggle = screen.getByRole("button", { name: /ataque del centro/i });
    await userEvent.click(zonaToggle);
    expect(screen.queryByText(/1\.1\.1 — Delantero/)).not.toBeInTheDocument();

    await userEvent.click(zonaToggle);
    expect(screen.getByText(/1\.1\.1 — Delantero/)).toBeInTheDocument();
  });
});
