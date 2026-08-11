import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { GameModel, Principle, Subprincipio, Zona, SubSubPrincipio } from "../../types/gameModel";
import { GameModelDraftProvider, useGameModelDraft } from "../GameModelDraftContext";

function buildSsp(id: number, numero: string): SubSubPrincipio {
  return {
    id,
    apiId: `ssp-${id}`,
    numero,
    rol: "Delantero",
    texto: "texto ssp",
    habilidades: [
      { id: id * 10, apiId: `hab-${id}`, nombre: "Activación", descripcion: "desc", entrenable: "entr", referenciaAKey: null },
    ],
    notas: [],
  };
}

function buildZona(id: number): Zona {
  return {
    id,
    apiId: `zona-${id}`,
    zoneKeys: ["finalizacion"],
    label: null,
    zonaTexto: null,
    texto: "texto zona",
    subSubPrincipios: [buildSsp(100 + id, "1.1.1")],
    notas: [{ id: id * 1000, apiId: `nota-${id}`, tipo: "riesgo-aceptado", texto: "riesgo" }],
  };
}

function buildSubprincipio(id: number, withZona: boolean): Subprincipio {
  return {
    id,
    apiId: `sp-${id}`,
    numero: "1.1",
    titulo: "Subprincipio de prueba",
    texto: "texto subprincipio",
    zonas: withZona ? [buildZona(id)] : [],
    subSubPrincipios: withZona ? [] : [buildSsp(200 + id, "1.1.1")],
    notas: [],
  };
}

function buildPrinciple(id: number, numero: number): Principle {
  return {
    id,
    apiId: `p-${id}`,
    gameMomentId: 1,
    gameMomentName: "Defensa Organizada",
    numero,
    titulo: `Principio ${numero}`,
    texto: "texto principio",
    subprincipios: [buildSubprincipio(id * 10, true), buildSubprincipio(id * 10 + 1, false)],
    notas: [],
  };
}

function buildDraft(): GameModel {
  return {
    id: "draft-1",
    teamId: "team-1",
    name: "Modelo de prueba",
    season: "2025/2026",
    principles: [buildPrinciple(1, 1), buildPrinciple(2, 2)],
    setPieceRules: [{ id: 1, apiId: "spr-1", subtype: "corners-defensivos", texto: "texto spr" }],
    openIssues: [{ id: 1, apiId: "oi-1", topic: "Tema", description: "desc", status: "open" }],
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <GameModelDraftProvider initialDraft={buildDraft()}>{children}</GameModelDraftProvider>;
}

describe("GameModelDraftContext reducer — Principio CRUD", () => {
  it("ADD_PRINCIPLE añade un principio vacío al final", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_PRINCIPLE", gameMomentId: 2 });
    });

    expect(result.current.draft.principles).toHaveLength(3);
    const added = result.current.draft.principles[2];
    expect(added.titulo).toBe("");
    expect(added.gameMomentId).toBe(2);
    expect(added.subprincipios).toEqual([]);
  });

  it("UPD_PRINCIPLE actualiza título y texto sin tocar sus subprincipios", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_PRINCIPLE",
        pi: 0,
        changes: { titulo: "Nuevo título", texto: "Nuevo texto" },
      });
    });

    const principle = result.current.draft.principles[0];
    expect(principle.titulo).toBe("Nuevo título");
    expect(principle.texto).toBe("Nuevo texto");
    expect(principle.subprincipios).toHaveLength(2);
  });

  it("DEL_PRINCIPLE elimina el principio y todo lo anidado bajo él", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_PRINCIPLE", pi: 0 });
    });

    expect(result.current.draft.principles).toHaveLength(1);
    expect(result.current.draft.principles[0].titulo).toBe("Principio 2");
  });
});

describe("GameModelDraftContext reducer — Subprincipio CRUD", () => {
  it("ADD_SUBPRINCIPIO añade un subprincipio vacío al principio indicado", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_SUBPRINCIPIO", pi: 0 });
    });

    const subprincipios = result.current.draft.principles[0].subprincipios;
    expect(subprincipios).toHaveLength(3);
    expect(subprincipios[2].titulo).toBe("");
    expect(subprincipios[2].zonas).toEqual([]);
    expect(subprincipios[2].subSubPrincipios).toEqual([]);
  });

  it("UPD_SUBPRINCIPIO actualiza campos sin afectar otros subprincipios", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_SUBPRINCIPIO",
        pi: 0,
        spi: 1,
        changes: { titulo: "Renombrado" },
      });
    });

    expect(result.current.draft.principles[0].subprincipios[1].titulo).toBe("Renombrado");
    expect(result.current.draft.principles[0].subprincipios[0].titulo).toBe("Subprincipio de prueba");
  });

  it("DEL_SUBPRINCIPIO elimina el subprincipio y sus zonas/sub-subprincipios", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_SUBPRINCIPIO", pi: 0, spi: 0 });
    });

    expect(result.current.draft.principles[0].subprincipios).toHaveLength(1);
  });
});

describe("GameModelDraftContext reducer — Zona CRUD", () => {
  it("ADD_ZONA añade una zona vacía al subprincipio", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_ZONA", pi: 0, spi: 1 });
    });

    const zonas = result.current.draft.principles[0].subprincipios[1].zonas;
    expect(zonas).toHaveLength(1);
    expect(zonas[0].zoneKeys).toEqual([]);
    expect(zonas[0].subSubPrincipios).toEqual([]);
  });

  it("UPD_ZONA actualiza los zoneKeys y el texto", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_ZONA",
        pi: 0,
        spi: 0,
        zi: 0,
        changes: { zoneKeys: ["creacion-propia", "iniciacion"] },
      });
    });

    expect(result.current.draft.principles[0].subprincipios[0].zonas[0].zoneKeys).toEqual([
      "creacion-propia",
      "iniciacion",
    ]);
  });

  it("DEL_ZONA elimina la zona y sus sub-subprincipios anidados", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_ZONA", pi: 0, spi: 0, zi: 0 });
    });

    expect(result.current.draft.principles[0].subprincipios[0].zonas).toHaveLength(0);
  });
});

describe("GameModelDraftContext reducer — SubSubPrincipio CRUD (hangs off Zona or directly)", () => {
  it("ADD_SSP añade un sub-subprincipio dentro de una Zona cuando se indica zi", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_SSP", pi: 0, spi: 0, zi: 0 });
    });

    const zona = result.current.draft.principles[0].subprincipios[0].zonas[0];
    expect(zona.subSubPrincipios).toHaveLength(2);
    expect(zona.subSubPrincipios[1].rol).toBe("");
  });

  it("ADD_SSP añade un sub-subprincipio directo al subprincipio cuando no se indica zi", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_SSP", pi: 0, spi: 1 });
    });

    const sp = result.current.draft.principles[0].subprincipios[1];
    expect(sp.subSubPrincipios).toHaveLength(2);
  });

  it("UPD_SSP actualiza rol y texto en el nivel correcto (bajo Zona)", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_SSP",
        pi: 0,
        spi: 0,
        zi: 0,
        sspi: 0,
        changes: { rol: "Extremo" },
      });
    });

    expect(result.current.draft.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].rol).toBe("Extremo");
  });

  it("DEL_SSP elimina el sub-subprincipio directo (sin zi) y sus habilidades", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_SSP", pi: 0, spi: 1, sspi: 0 });
    });

    expect(result.current.draft.principles[0].subprincipios[1].subSubPrincipios).toHaveLength(0);
  });
});

describe("GameModelDraftContext reducer — Habilidad CRUD", () => {
  it("ADD_HABILIDAD añade una habilidad vacía al sub-subprincipio", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_HABILIDAD", pi: 0, spi: 0, zi: 0, sspi: 0 });
    });

    const habilidades = result.current.draft.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].habilidades;
    expect(habilidades).toHaveLength(2);
    expect(habilidades[1].nombre).toBe("");
  });

  it("UPD_HABILIDAD actualiza nombre/descripcion/entrenable", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_HABILIDAD",
        pi: 0,
        spi: 1,
        sspi: 0,
        hi: 0,
        changes: { nombre: "Pase" },
      });
    });

    expect(
      result.current.draft.principles[0].subprincipios[1].subSubPrincipios[0].habilidades[0].nombre
    ).toBe("Pase");
  });

  it("DEL_HABILIDAD elimina la habilidad indicada", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_HABILIDAD", pi: 0, spi: 0, zi: 0, sspi: 0, hi: 0 });
    });

    expect(
      result.current.draft.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].habilidades
    ).toHaveLength(0);
  });
});

describe("GameModelDraftContext reducer — Nota CRUD (anchored per level)", () => {
  it("ADD_NOTA añade una nota al nivel Principio", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_NOTA", level: "principle", pi: 0 });
    });

    expect(result.current.draft.principles[0].notas).toHaveLength(1);
    expect(result.current.draft.principles[0].notas[0].tipo).toBe("nota");
  });

  it("ADD_NOTA añade una nota al nivel Zona", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_NOTA", level: "zona", pi: 0, spi: 0, zi: 0 });
    });

    expect(result.current.draft.principles[0].subprincipios[0].zonas[0].notas).toHaveLength(2);
  });

  it("UPD_NOTA actualiza tipo y texto de una nota anclada a SubSubPrincipio", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_NOTA", level: "ssp", pi: 0, spi: 0, zi: 0, sspi: 0 });
    });
    act(() => {
      result.current.dispatch({
        type: "UPD_NOTA",
        level: "ssp",
        pi: 0,
        spi: 0,
        zi: 0,
        sspi: 0,
        ni: 0,
        changes: { tipo: "excepcion", texto: "Excepción puntual" },
      });
    });

    const nota = result.current.draft.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].notas[0];
    expect(nota.tipo).toBe("excepcion");
    expect(nota.texto).toBe("Excepción puntual");
  });

  it("DEL_NOTA elimina la nota del nivel Zona", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_NOTA", level: "zona", pi: 0, spi: 0, zi: 0, ni: 0 });
    });

    expect(result.current.draft.principles[0].subprincipios[0].zonas[0].notas).toHaveLength(0);
  });
});

describe("GameModelDraftContext reducer — SetPieceRule / OpenIssue (flat)", () => {
  it("ADD_SET_PIECE_RULE añade una regla vacía", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_SET_PIECE_RULE" });
    });

    expect(result.current.draft.setPieceRules).toHaveLength(2);
  });

  it("UPD_SET_PIECE_RULE actualiza subtype y texto", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_SET_PIECE_RULE",
        i: 0,
        changes: { subtype: "penaltis", texto: "Nuevo texto" },
      });
    });

    expect(result.current.draft.setPieceRules[0].subtype).toBe("penaltis");
    expect(result.current.draft.setPieceRules[0].texto).toBe("Nuevo texto");
  });

  it("DEL_SET_PIECE_RULE elimina la regla indicada", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_SET_PIECE_RULE", i: 0 });
    });

    expect(result.current.draft.setPieceRules).toHaveLength(0);
  });

  it("ADD_OPEN_ISSUE añade un pendiente vacío con status open", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_OPEN_ISSUE" });
    });

    expect(result.current.draft.openIssues).toHaveLength(2);
    expect(result.current.draft.openIssues[1].status).toBe("open");
  });

  it("UPD_OPEN_ISSUE actualiza topic/description/status", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_OPEN_ISSUE",
        i: 0,
        changes: { status: "resolved" },
      });
    });

    expect(result.current.draft.openIssues[0].status).toBe("resolved");
  });

  it("DEL_OPEN_ISSUE elimina el pendiente indicado", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_OPEN_ISSUE", i: 0 });
    });

    expect(result.current.draft.openIssues).toHaveLength(0);
  });
});

describe("GameModelDraftContext reducer — cabecera", () => {
  it("SET_NAME actualiza el nombre del modelo", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "SET_NAME", value: "Modelo renombrado" });
    });

    expect(result.current.draft.name).toBe("Modelo renombrado");
  });

  it("SET_SEASON actualiza temporada y regenera el nombre por defecto", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "SET_SEASON", value: "2026/2027" });
    });

    expect(result.current.draft.season).toBe("2026/2027");
    expect(result.current.draft.name).toBe("Modelo de Juego 2026/2027");
  });
});
