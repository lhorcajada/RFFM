import { render, screen, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import AdnDraggableTree from "../AdnDraggableTree";
import type { GameModel, Habilidad, SubSubPrincipio } from "../../../../types/gameModel";

function habilidad(id: number, nombre: string): Habilidad {
  return { id, apiId: `hab-${id}`, nombre, descripcion: "", entrenable: "", referenciaAKey: null };
}

function ssp(apiId: string, numero: string, habilidades: Habilidad[]): SubSubPrincipio {
  return { id: 1, apiId, numero, rol: "Delantero", texto: `Texto ${numero}`, habilidades, notas: [] };
}

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
            zonas: [],
            subSubPrincipios: [
              ssp("ssp-1", "1.1.1", [habilidad(1, "Perfilamiento"), habilidad(2, "Anticipación")]),
              ssp("ssp-2", "1.1.2", []),
            ],
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

describe("AdnDraggableTree — habilidades imprescindibles", () => {
  it("muestra las habilidades de cada sub-subprincipio como chips", () => {
    renderTree();

    const leaf = screen.getByTestId("adn-ssp-ssp-1");
    expect(within(leaf).getByText("Perfilamiento")).toBeInTheDocument();
    expect(within(leaf).getByText("Anticipación")).toBeInTheDocument();
  });

  it("no muestra chips en un sub-subprincipio sin habilidades", () => {
    renderTree();

    const leaf = screen.getByTestId("adn-ssp-ssp-2");
    expect(within(leaf).queryByText("Perfilamiento")).not.toBeInTheDocument();
    expect(within(leaf).queryByText("Anticipación")).not.toBeInTheDocument();
  });
});

describe("AdnDraggableTree — subprincipio con zonas y generales", () => {
  it("muestra las zonas y un grupo 'Sin zona' con los generales", () => {
    const model = buildGameModel();
    const sp = model.principles[0].subprincipios[0];
    const mixed: GameModel = {
      ...model,
      principles: [
        {
          ...model.principles[0],
          subprincipios: [
            {
              ...sp,
              zonas: [
                {
                  id: 1,
                  apiId: "zona-1",
                  zoneKeys: ["iniciacion"],
                  label: "Zona de iniciación",
                  texto: "",
                  notas: [],
                  subSubPrincipios: [ssp("ssp-zona", "1.1.3", [])],
                },
              ],
            },
          ],
        },
      ],
    };

    render(
      <DndContext>
        <AdnDraggableTree gameModel={mixed} coverage={null} />
      </DndContext>
    );

    expect(screen.getByTestId("adn-ssp-ssp-zona")).toBeInTheDocument();
    const sinZona = screen.getByTestId("adn-sin-zona-sub-1");
    expect(within(sinZona).getByText("Sin zona")).toBeInTheDocument();
    expect(within(sinZona).getByTestId("adn-ssp-ssp-1")).toBeInTheDocument();
    expect(within(sinZona).getByTestId("adn-ssp-ssp-2")).toBeInTheDocument();
  });
});
