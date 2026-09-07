import { render, screen, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import AdnDraggableTree from "../AdnDraggableTree";
import type { GameModel } from "../../../../types/gameModel";
import type { AdnCoverage } from "../../../../types/adnCoverage";

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
              {
                id: 1,
                apiId: "ssp-1",
                numero: "1.1.1",
                rol: "Central",
                texto: "",
                habilidades: [],
                notas: [],
              },
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

/** Same shape as buildGameModel() but with a Zona under the Subprincipio, holding two
 * SubSubPrincipios — used for the Zona tri-state tests. */
function buildGameModelWithZona(): GameModel {
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
                key: "finalizacion",
                zoneKeys: ["finalizacion"],
                label: "Finalización",
                zonaTexto: null,
                texto: "",
                subSubPrincipios: [
                  { id: 1, apiId: "ssp-1", numero: "1.1.1", rol: "Central", texto: "", habilidades: [], notas: [] },
                  { id: 2, apiId: "ssp-2", numero: "1.1.2", rol: "Lateral", texto: "", habilidades: [], notas: [] },
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

function renderTree(gameModel: GameModel, coverage: AdnCoverage | null) {
  return render(
    <DndContext>
      <AdnDraggableTree gameModel={gameModel} coverage={coverage} />
    </DndContext>
  );
}

describe("AdnDraggableTree — checks de cobertura tri-estado (Subprincipio/Principio)", () => {
  it("muestra el check de completado en Subprincipio y Principio cuando coverage los marca 'completed'", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [{ subSubPrincipioId: "ssp-1", isUsed: true, sessions: [{ sessionId: "sess-1", sessionName: "Sesión 1", date: null }] }],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "completed" }],
      principios: [{ principioId: "principle-1", status: "completed" }],
    };

    renderTree(buildGameModel(), coverage);

    expect(screen.getByTestId("covered-subprincipio-sub-1")).toBeInTheDocument();
    expect(screen.getByTestId("covered-principio-principle-1")).toBeInTheDocument();
  });

  it("muestra el icono de progreso (no el de completado) cuando coverage los marca 'in-progress'", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [{ subSubPrincipioId: "ssp-1", isUsed: true, sessions: [{ sessionId: "sess-1", sessionName: "Sesión 1", date: null }] }],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "in-progress" }],
      principios: [{ principioId: "principle-1", status: "in-progress" }],
    };

    renderTree(buildGameModel(), coverage);

    expect(screen.getByTestId("progress-subprincipio-sub-1")).toBeInTheDocument();
    expect(screen.queryByTestId("covered-subprincipio-sub-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("progress-principio-principle-1")).toBeInTheDocument();
    expect(screen.queryByTestId("covered-principio-principle-1")).not.toBeInTheDocument();
  });

  it("no muestra ningún icono cuando coverage los marca 'not-started'", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [{ subSubPrincipioId: "ssp-1", isUsed: false, sessions: [] }],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "not-started" }],
      principios: [{ principioId: "principle-1", status: "not-started" }],
    };

    renderTree(buildGameModel(), coverage);

    expect(screen.queryByTestId("covered-subprincipio-sub-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-subprincipio-sub-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("covered-principio-principle-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-principio-principle-1")).not.toBeInTheDocument();
  });

  it("no revienta y no muestra ningún check cuando coverage es null (aún no cargado)", () => {
    renderTree(buildGameModel(), null);

    expect(screen.queryByTestId("covered-subprincipio-sub-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("covered-principio-principle-1")).not.toBeInTheDocument();
  });
});

describe("AdnDraggableTree — checks de cobertura tri-estado (Zona)", () => {
  it("muestra el check de completado en la Zona cuando todos sus Sub-subprincipios están usados", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [
        { subSubPrincipioId: "ssp-1", isUsed: true, sessions: [] },
        { subSubPrincipioId: "ssp-2", isUsed: true, sessions: [] },
      ],
      zonas: [{ zonaId: "zona-1", status: "completed" }],
      subprincipios: [{ subprincipioId: "sub-1", status: "completed" }],
      principios: [{ principioId: "principle-1", status: "completed" }],
    };

    renderTree(buildGameModelWithZona(), coverage);

    expect(screen.getByTestId("covered-zona-zona-1")).toBeInTheDocument();
  });

  it("muestra el icono de progreso en la Zona cuando solo alguno de sus Sub-subprincipios está usado", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [
        { subSubPrincipioId: "ssp-1", isUsed: true, sessions: [] },
        { subSubPrincipioId: "ssp-2", isUsed: false, sessions: [] },
      ],
      zonas: [{ zonaId: "zona-1", status: "in-progress" }],
      subprincipios: [{ subprincipioId: "sub-1", status: "in-progress" }],
      principios: [{ principioId: "principle-1", status: "in-progress" }],
    };

    renderTree(buildGameModelWithZona(), coverage);

    expect(screen.getByTestId("progress-zona-zona-1")).toBeInTheDocument();
    expect(screen.queryByTestId("covered-zona-zona-1")).not.toBeInTheDocument();
  });

  it("no muestra ningún icono en la Zona cuando ninguno de sus Sub-subprincipios está usado", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [
        { subSubPrincipioId: "ssp-1", isUsed: false, sessions: [] },
        { subSubPrincipioId: "ssp-2", isUsed: false, sessions: [] },
      ],
      zonas: [{ zonaId: "zona-1", status: "not-started" }],
      subprincipios: [{ subprincipioId: "sub-1", status: "not-started" }],
      principios: [{ principioId: "principle-1", status: "not-started" }],
    };

    renderTree(buildGameModelWithZona(), coverage);

    expect(screen.queryByTestId("covered-zona-zona-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-zona-zona-1")).not.toBeInTheDocument();
  });
});

describe("AdnDraggableTree — check de completado en Sub-subprincipio (hoja)", () => {
  it("muestra el check de completado junto al Sub-subprincipio cuando está usado en alguna sesión", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [{ subSubPrincipioId: "ssp-1", isUsed: true, sessions: [{ sessionId: "sess-1", sessionName: "Sesión 1", date: null }] }],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "completed" }],
      principios: [{ principioId: "principle-1", status: "completed" }],
    };

    renderTree(buildGameModel(), coverage);

    expect(screen.getByTestId("covered-ssp-ssp-1")).toBeInTheDocument();
  });

  it("no muestra el check del Sub-subprincipio cuando no está usado en ninguna sesión", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [{ subSubPrincipioId: "ssp-1", isUsed: false, sessions: [] }],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "not-started" }],
      principios: [{ principioId: "principle-1", status: "not-started" }],
    };

    renderTree(buildGameModel(), coverage);

    expect(screen.queryByTestId("covered-ssp-ssp-1")).not.toBeInTheDocument();
  });
});

describe("AdnDraggableTree — UsageBadge", () => {
  it("muestra la insignia con el recuento de sesiones y el tooltip 'Sin programar' para una sesión sin fecha", async () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [
        { subSubPrincipioId: "ssp-1", isUsed: true, sessions: [{ sessionId: "sess-1", sessionName: "Sesión 1", date: null }] },
      ],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "completed" }],
      principios: [{ principioId: "principle-1", status: "completed" }],
    };

    renderTree(buildGameModel(), coverage);

    const badgeRoot = screen.getByTestId("usage-badge-ssp-1");
    expect(within(badgeRoot).getByText("1")).toBeInTheDocument();
  });

  it("no muestra insignia cuando el SubSubPrincipio no tiene usos", () => {
    const coverage: AdnCoverage = {
      subSubPrincipios: [{ subSubPrincipioId: "ssp-1", isUsed: false, sessions: [] }],
      zonas: [],
      subprincipios: [{ subprincipioId: "sub-1", status: "not-started" }],
      principios: [{ principioId: "principle-1", status: "not-started" }],
    };

    renderTree(buildGameModel(), coverage);

    const badgeRoot = screen.getByTestId("usage-badge-ssp-1");
    expect(within(badgeRoot).queryByText("1")).not.toBeInTheDocument();
  });
});
