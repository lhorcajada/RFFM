import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/gameModelService", () => ({
  default: { getByTeamIdAndSeason: vi.fn() },
}));
vi.mock("../../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn() },
}));

import ModelRelationSection from "../ModelRelationSection";
import gameModelService from "../../../../../services/gameModelService";
import seasonService from "../../../../../services/seasonService";
import type { GameModel, Habilidad, SubSubPrincipio } from "../../../../../types/gameModel";
import type { ExerciseModelRelationRequest } from "../../../../../types/training";

let nextId = 1;

function habilidad(nombre: string): Habilidad {
  return { id: nextId++, nombre, descripcion: "", entrenable: "" };
}

function ssp(apiId: string, numero: string, rol: string, habilidades: string[] = [], texto = ""): SubSubPrincipio {
  return { id: nextId++, apiId, numero, rol, texto, habilidades: habilidades.map(habilidad), notas: [] };
}

const gameModel: GameModel = {
  id: "gm-1",
  teamId: "team-1",
  name: "Modelo",
  season: "2026-2027",
  setPieceRules: [],
  openIssues: [],
  principles: [
    {
      id: 2,
      apiId: "p-ataque",
      gameMomentId: 2,
      gameMomentName: "Ataque organizado",
      numero: 2,
      titulo: "Progresar",
      texto: "",
      notas: [],
      subprincipios: [
        {
          id: 20,
          apiId: "sub-2-1",
          numero: "2.1",
          titulo: "Salida de balón",
          texto: "",
          notas: [],
          subSubPrincipios: [],
          zonas: [
            {
              id: 200,
              apiId: "zona-1",
              zoneKeys: ["iniciacion"],
              texto: "",
              notas: [],
              subSubPrincipios: [ssp("ssp-2-1-1", "2.1.1", "Portero")],
            },
          ],
        },
      ],
    },
    {
      id: 1,
      apiId: "p-defensa",
      gameMomentId: 1,
      gameMomentName: "Defensa organizada",
      numero: 1,
      titulo: "Presionar",
      texto: "",
      notas: [],
      subprincipios: [
        {
          id: 11,
          apiId: "sub-1-10",
          numero: "1.10",
          titulo: "Repliegue",
          texto: "",
          notas: [],
          zonas: [],
          subSubPrincipios: [ssp("ssp-1-10-1", "1.10.1", "Lateral")],
        },
        {
          id: 10,
          apiId: "sub-1-2",
          numero: "1.2",
          titulo: "Presión alta",
          texto: "",
          notas: [],
          zonas: [],
          subSubPrincipios: [
            ssp("ssp-1-2-2", "1.2.2", "Central", ["Cobertura"]),
            ssp("ssp-1-2-1", "1.2.1", "Pivote", ["Pase", "Perfilamiento"], "Cerrar la línea de pase interior al central rival."),
          ],
        },
      ],
    },
  ],
};

function StatefulSection({ initial = [] }: { initial?: ExerciseModelRelationRequest[] }) {
  const [relations, setRelations] = useState<ExerciseModelRelationRequest[]>(initial);
  return (
    <>
      <ModelRelationSection modelRelations={relations} onChange={setRelations} teamId="team-1" />
      <output data-testid="relations">{JSON.stringify(relations)}</output>
    </>
  );
}

function renderSection(initial: ExerciseModelRelationRequest[] = []) {
  render(
    <MemoryRouter>
      <StatefulSection initial={initial} />
    </MemoryRouter>
  );
}

function currentRelations(): ExerciseModelRelationRequest[] {
  return JSON.parse(screen.getByTestId("relations").textContent ?? "[]");
}

async function expand(name: RegExp) {
  await userEvent.click(await screen.findByRole("button", { name }));
}

describe("ModelRelationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (seasonService.getActiveSeason as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "season-1", name: "2026-2027" });
    (gameModelService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue(gameModel);
  });

  it("carga el modelo de juego del equipo para la temporada activa", async () => {
    renderSection();

    await waitFor(() => {
      expect(gameModelService.getByTeamIdAndSeason).toHaveBeenCalledWith("team-1", "2026-2027");
    });
  });

  it("muestra las fases ordenadas por momento de juego", async () => {
    renderSection();

    const fases = await screen.findAllByRole("button", { name: /defensa organizada|ataque organizado/i });

    expect(fases.map((f) => f.textContent)).toEqual(["Defensa organizada", "Ataque organizado"]);
  });

  it("muestra los subprincipios de un principio ordenados por su número (1.2 antes que 1.10)", async () => {
    renderSection();

    await expand(/1\. presionar/i);

    const subprincipios = screen.getAllByRole("button", { name: /^1\.\d+ · /i });
    expect(subprincipios.map((s) => s.textContent)).toEqual(["1.2 · Presión alta", "1.10 · Repliegue"]);
  });

  it("muestra los sub-subprincipios de un subprincipio ordenados por su número", async () => {
    renderSection();

    await expand(/1\. presionar/i);
    await expand(/1\.2 · presión alta/i);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.map((c) => c.getAttribute("aria-label"))).toEqual(["1.2.1 · Pivote", "1.2.2 · Central"]);
  });

  it("muestra la descripción de cada sub-subprincipio para poder elegir con criterio", async () => {
    renderSection();

    await expand(/1\. presionar/i);
    await expand(/1\.2 · presión alta/i);

    expect(screen.getByText("Cerrar la línea de pase interior al central rival.")).toBeInTheDocument();
  });

  it("muestra los sub-subprincipios de una zona bajo su encabezado de zona", async () => {
    renderSection();

    await expand(/2\. progresar/i);
    await expand(/2\.1 · salida de balón/i);

    expect(screen.getByText("Zona de Iniciación")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "2.1.1 · Portero" })).toBeInTheDocument();
  });

  it("al marcar un sub-subprincipio lo vincula al ejercicio como FOCO", async () => {
    renderSection();

    await expand(/1\. presionar/i);
    await expand(/1\.2 · presión alta/i);
    await userEvent.click(screen.getByRole("checkbox", { name: "1.2.1 · Pivote" }));

    expect(currentRelations()).toEqual([
      {
        subprincipioId: "sub-1-2",
        isFoco: true,
        habilidadesImprescindibles: [],
        items: [{ subSubPrincipioId: "ssp-1-2-1", isFoco: true, habilidades: [] }],
      },
    ]);
  });

  it("solo ofrece las habilidades que el modelo define para el sub-subprincipio marcado", async () => {
    renderSection();

    await expand(/1\. presionar/i);
    await expand(/1\.2 · presión alta/i);
    await userEvent.click(screen.getByRole("checkbox", { name: "1.2.1 · Pivote" }));

    const habilidades = screen.getByRole("group", { name: /habilidades de 1\.2\.1/i });
    expect(within(habilidades).getAllByRole("button").map((b) => b.textContent)).toEqual(["Pase", "Perfilamiento"]);
  });

  it("al elegir una habilidad la añade al sub-subprincipio y a la relación", async () => {
    renderSection();

    await expand(/1\. presionar/i);
    await expand(/1\.2 · presión alta/i);
    await userEvent.click(screen.getByRole("checkbox", { name: "1.2.1 · Pivote" }));
    await userEvent.click(within(screen.getByRole("group", { name: /habilidades de 1\.2\.1/i })).getByRole("button", { name: "Pase" }));

    const [relation] = currentRelations();
    expect(relation.items[0].habilidades).toEqual(["Pase"]);
    expect(relation.habilidadesImprescindibles).toEqual(["Pase"]);
  });

  it("permite marcar un sub-subprincipio como INTEGRADO", async () => {
    renderSection();

    await expand(/1\. presionar/i);
    await expand(/1\.2 · presión alta/i);
    await userEvent.click(screen.getByRole("checkbox", { name: "1.2.1 · Pivote" }));
    await userEvent.click(screen.getByRole("button", { name: /integrado/i }));

    expect(currentRelations()[0].items[0].isFoco).toBe(false);
  });

  it("muestra los principios plegados aunque tengan sub-subprincipios vinculados", async () => {
    renderSection([
      {
        subprincipioId: "sub-1-2",
        isFoco: true,
        habilidadesImprescindibles: ["Cobertura"],
        items: [{ subSubPrincipioId: "ssp-1-2-2", isFoco: true, habilidades: ["Cobertura"] }],
      },
    ]);

    const principio = await screen.findByRole("button", { name: /1\. presionar/i });
    expect(principio).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /1\.2 · presión alta/i })).not.toBeInTheDocument();
  });

  it("al desplegar un principio abre directamente los subprincipios que ya tienen sub-subprincipios vinculados", async () => {
    renderSection([
      {
        subprincipioId: "sub-1-2",
        isFoco: true,
        habilidadesImprescindibles: ["Cobertura"],
        items: [{ subSubPrincipioId: "ssp-1-2-2", isFoco: true, habilidades: ["Cobertura"] }],
      },
    ]);

    await expand(/1\. presionar/i);

    expect(screen.getByRole("checkbox", { name: "1.2.2 · Central" })).toBeChecked();
  });

  it("lista los vínculos antiguos sin sub-subprincipios y permite eliminarlos", async () => {
    renderSection([{ subprincipioId: "sub-1-10", isFoco: true, habilidadesImprescindibles: ["Pase"], items: [] }]);

    await userEvent.click(await screen.findByRole("button", { name: /eliminar vínculo 1\.10/i }));

    expect(currentRelations()).toEqual([]);
  });

  it("muestra el aviso de crear el Modelo ADN cuando el equipo no tiene modelo de juego", async () => {
    (gameModelService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 404 } });

    renderSection();

    expect(await screen.findByRole("link", { name: /modelo adn/i })).toBeInTheDocument();
  });
});
