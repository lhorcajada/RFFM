import { describe, expect, it } from "vitest";
import {
  ancestorAddresses,
  buildReadingTree,
  collectPinnedAddresses,
  computeExpandedAddresses,
  highlightSegments,
  indexChildren,
  normalizeSearchText,
  searchReadingTree,
  type ExpansionState,
  type PendingChanges,
} from "../gameModelReadingTree";
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

const PHASE = "moment-1";
const PRINCIPLE_1 = "defensa-organizada-1";
const SUB_1_1 = "defensa-organizada-1.1";
const ZONA = "defensa-organizada-1.1-finalizacion";
const SSP_1_1_1 = "defensa-organizada-1.1.1";
const SKILL_ACTIVACION = `${SSP_1_1_1}/hab:hab-1`;
const NOTA_RIESGO = `${ZONA}/nota:nota-1`;
const PRINCIPLE_2 = "defensa-organizada-2";
const SUB_2_1 = "defensa-organizada-2.1";
const SSP_2_1_1 = "defensa-organizada-2.1.1";
const SKILL_ANTICIPACION = `${SSP_2_1_1}/hab:hab-3`;

function emptyState(overrides: Partial<ExpansionState> = {}): ExpansionState {
  return {
    depth: 2,
    overrides: new Map(),
    searchExpand: new Set(),
    searchToggles: new Map(),
    pinned: new Set(),
    ...overrides,
  };
}

describe("buildReadingTree", () => {
  it("agrupa los principios por fase y ordena fases y principios", () => {
    const tree = buildReadingTree(twoPhaseModel);

    expect(tree.roots.map((r) => r.title)).toEqual(["Defensa Organizada", "Ataque Organizado", "Balón parado"]);
    expect(tree.roots[0].children.map((c) => c.address)).toEqual([PRINCIPLE_1, PRINCIPLE_2]);
  });

  it("cuelga zonas, sub-subprincipios y notas en el orden de lectura de cada nivel", () => {
    const tree = buildReadingTree(mockGameModel);

    const sub = tree.byAddress.get(SUB_1_1)!;
    const zona = tree.byAddress.get(ZONA)!;
    const ssp = tree.byAddress.get(SSP_1_1_1)!;

    expect(sub.children.map((c) => c.address)).toEqual([ZONA]);
    expect(zona.children.map((c) => c.address)).toEqual([SSP_1_1_1, NOTA_RIESGO]);
    expect(ssp.children.map((c) => c.kind)).toEqual(["habilidad", "habilidad"]);
  });

  it("asigna el nivel de profundidad de cada tipo de nodo", () => {
    const tree = buildReadingTree(mockGameModel);

    expect(tree.byAddress.get(PHASE)!.level).toBe(0);
    expect(tree.byAddress.get(PRINCIPLE_1)!.level).toBe(1);
    expect(tree.byAddress.get(SUB_1_1)!.level).toBe(2);
    expect(tree.byAddress.get(ZONA)!.level).toBe(3);
    expect(tree.byAddress.get(SSP_1_1_1)!.level).toBe(4);
    expect(tree.byAddress.get(SKILL_ACTIVACION)!.level).toBe(5);
  });

  it("solo añade la sección «Balón parado» si el modelo tiene reglas", () => {
    expect(buildReadingTree(mockGameModel).roots.map((r) => r.address)).toContain("set-pieces");
    expect(
      buildReadingTree({ ...mockGameModel, setPieceRules: [] }).roots.map((r) => r.address)
    ).not.toContain("set-pieces");
  });

  it("conserva la referencia «misma que» de las habilidades", () => {
    const model: GameModel = structuredClone(mockGameModel);
    model.principles[0].subprincipios[0].zonas[0].subSubPrincipios[0].habilidades[0].referenciaAKey = "hab-2";

    expect(buildReadingTree(model).byAddress.get(SKILL_ACTIVACION)!.reference).toBe("hab-2");
  });

  it("usa la ruta numérica cuando el modelo no trae claves", () => {
    const tree = buildReadingTree(twoPhaseModel);

    expect(tree.byAddress.has("moment-2/1")).toBe(true);
  });

  it("no modifica el modelo guardado", () => {
    const before = JSON.stringify(twoPhaseModel);

    buildReadingTree(twoPhaseModel, {
      [SUB_1_1]: { operation: "remove" },
      "new-sub": { operation: "add", parentAddress: PRINCIPLE_1, title: "Nuevo" },
    });

    expect(JSON.stringify(twoPhaseModel)).toBe(before);
  });
});

describe("indexChildren", () => {
  it("lista de la fase al subprincipio y deja fuera zonas, sub-subprincipios y notas", () => {
    const tree = buildReadingTree(mockGameModel);

    expect(indexChildren(tree.byAddress.get(PHASE)!).map((c) => c.address)).toEqual([PRINCIPLE_1, PRINCIPLE_2]);
    expect(indexChildren(tree.byAddress.get(PRINCIPLE_1)!).map((c) => c.address)).toEqual([SUB_1_1]);
    expect(indexChildren(tree.byAddress.get(SUB_1_1)!)).toEqual([]);
  });
});

describe("normalizeSearchText", () => {
  it("ignora mayúsculas y acentos", () => {
    expect(normalizeSearchText("Línea de PRESIÓN")).toBe("linea de presion");
  });
});

describe("searchReadingTree", () => {
  const tree = buildReadingTree(mockGameModel);

  it("encuentra por título sin distinguir mayúsculas ni acentos", () => {
    expect(searchReadingTree(tree, "PRESION").matches).toContain(SUB_1_1);
    expect(searchReadingTree(tree, "presión").matches).toContain(SUB_1_1);
  });

  it("encuentra textos, habilidades y notas de cualquier nivel", () => {
    expect(searchReadingTree(tree, "activacion").matches).toContain(SKILL_ACTIVACION);
    expect(searchReadingTree(tree, "lateral opuesto").matches).toEqual([NOTA_RIESGO]);
    expect(searchReadingTree(tree, "delantero").matches).toContain(SSP_1_1_1);
  });

  it("una consulta numérica encuentra el nodo con ese número, no sus descendientes", () => {
    const result = searchReadingTree(tree, "1.1");

    expect(result.matches).toContain(SUB_1_1);
    expect(result.matches).not.toContain(SSP_1_1_1);
  });

  it("devuelve los resultados en el orden del documento", () => {
    const result = searchReadingTree(tree, "rival");
    const order = tree.nodes.map((n) => n.address);

    expect(result.matches.length).toBeGreaterThan(1);
    expect(result.matches).toEqual([...result.matches].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });

  it("expande solo las ramas que contienen resultados", () => {
    const result = searchReadingTree(tree, "anticipacion");

    expect(result.matches).toEqual([SKILL_ANTICIPACION]);
    expect([...result.expand].sort()).toEqual([PHASE, PRINCIPLE_2, SUB_2_1, SSP_2_1_1].sort());
  });

  it("expande el propio nodo cuando la coincidencia está en su texto", () => {
    const result = searchReadingTree(tree, "carril central");

    expect(result.matches).toEqual([SSP_1_1_1]);
    expect(result.expand.has(SSP_1_1_1)).toBe(true);
  });

  it("no encuentra nada ni expande nada con una consulta sin resultados", () => {
    const result = searchReadingTree(tree, "zzzzzz");

    expect(result.matches).toEqual([]);
    expect(result.expand.size).toBe(0);
  });

  it("una consulta vacía no produce resultados", () => {
    expect(searchReadingTree(tree, "   ").matches).toEqual([]);
  });

  it("exige todas las palabras de la consulta en el mismo nodo", () => {
    expect(searchReadingTree(tree, "delantero carril").matches).toEqual([SSP_1_1_1]);
    expect(searchReadingTree(tree, "delantero inexistente").matches).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("marca las coincidencias ignorando acentos y conserva el texto original", () => {
    expect(highlightSegments("Línea de presión alta", ["presion"])).toEqual([
      { text: "Línea de ", match: false },
      { text: "presión", match: true },
      { text: " alta", match: false },
    ]);
  });

  it("marca todas las palabras de la consulta", () => {
    const segments = highlightSegments("Presiona al central", ["presiona", "central"]);

    expect(segments.filter((s) => s.match).map((s) => s.text)).toEqual(["Presiona", "central"]);
  });

  it("sin palabras devuelve el texto sin marcar", () => {
    expect(highlightSegments("Texto", [])).toEqual([{ text: "Texto", match: false }]);
  });
});

describe("ancestorAddresses", () => {
  it("devuelve los ancestros desde la fase hasta el padre", () => {
    const tree = buildReadingTree(mockGameModel);

    expect(ancestorAddresses(tree, SKILL_ACTIVACION)).toEqual([PHASE, PRINCIPLE_1, SUB_1_1, ZONA, SSP_1_1_1]);
    expect(ancestorAddresses(tree, PHASE)).toEqual([]);
    expect(ancestorAddresses(tree, "no-existe")).toEqual([]);
  });
});

describe("computeExpandedAddresses", () => {
  const tree = buildReadingTree(mockGameModel);

  it("con el nivel de subprincipios expande fases y principios pero no los subprincipios", () => {
    const expanded = computeExpandedAddresses(tree, emptyState({ depth: 2 }));

    expect(expanded.has(PHASE)).toBe(true);
    expect(expanded.has(PRINCIPLE_1)).toBe(true);
    expect(expanded.has(SUB_1_1)).toBe(false);
  });

  it("con el nivel de principios deja los principios contraídos", () => {
    const expanded = computeExpandedAddresses(tree, emptyState({ depth: 1 }));

    expect(expanded.has(PHASE)).toBe(true);
    expect(expanded.has(PRINCIPLE_1)).toBe(false);
  });

  it("con el nivel de habilidades y notas expande todos los niveles con contenido", () => {
    const expanded = computeExpandedAddresses(tree, emptyState({ depth: 5 }));

    for (const address of [PHASE, PRINCIPLE_1, SUB_1_1, ZONA, SSP_1_1_1]) {
      expect(expanded.has(address)).toBe(true);
    }
  });

  it("las acciones manuales prevalecen sobre el nivel", () => {
    const expanded = computeExpandedAddresses(
      tree,
      emptyState({
        depth: 2,
        overrides: new Map([
          [PRINCIPLE_1, false],
          [SUB_1_1, true],
        ]),
      })
    );

    expect(expanded.has(PRINCIPLE_1)).toBe(false);
    expect(expanded.has(SUB_1_1)).toBe(true);
  });

  it("la búsqueda añade ramas expandidas sin contraer las ya expandidas", () => {
    const expanded = computeExpandedAddresses(tree, emptyState({ depth: 2, searchExpand: new Set([SUB_1_1]) }));

    expect(expanded.has(SUB_1_1)).toBe(true);
    expect(expanded.has(PRINCIPLE_2)).toBe(true);
  });

  it("los cambios manuales durante la búsqueda prevalecen sobre la búsqueda", () => {
    const expanded = computeExpandedAddresses(
      tree,
      emptyState({ searchExpand: new Set([SUB_1_1]), searchToggles: new Map([[SUB_1_1, false]]) })
    );

    expect(expanded.has(SUB_1_1)).toBe(false);
  });

  it("los nodos fijados quedan expandidos sea cual sea el nivel o la acción manual", () => {
    const expanded = computeExpandedAddresses(
      tree,
      emptyState({ depth: 1, overrides: new Map([[SUB_1_1, false]]), pinned: new Set([SUB_1_1]) })
    );

    expect(expanded.has(SUB_1_1)).toBe(true);
  });

  it("las hojas nunca figuran como expandidas", () => {
    const expanded = computeExpandedAddresses(tree, emptyState({ depth: 5 }));

    expect(expanded.has(SKILL_ACTIVACION)).toBe(false);
    expect(expanded.has(NOTA_RIESGO)).toBe(false);
  });
});

describe("cambios pendientes", () => {
  it("marca como pendiente el nodo cambiado o eliminado sin alterar su contenido", () => {
    const changes: PendingChanges = {
      [SUB_1_1]: { operation: "change", text: "Nuevo texto" },
      [SKILL_ACTIVACION]: { operation: "remove" },
    };
    const tree = buildReadingTree(mockGameModel, changes);

    expect(tree.byAddress.get(SUB_1_1)!.pending?.operation).toBe("change");
    expect(tree.byAddress.get(SUB_1_1)!.text).toBe(mockGameModel.principles[0].subprincipios[0].texto);
    expect(tree.byAddress.get(SKILL_ACTIVACION)!.pending?.operation).toBe("remove");
  });

  it("una alta crea un nodo marcador en el padre, ordenado por número", () => {
    const tree = buildReadingTree(mockGameModel, {
      "defensa-organizada-1.2": { operation: "add", parentAddress: PRINCIPLE_1, number: "1.2", title: "Nuevo subprincipio" },
      "defensa-organizada-1.0": { operation: "add", parentAddress: PRINCIPLE_1, number: "1.0", title: "Anterior" },
    });

    expect(tree.byAddress.get(PRINCIPLE_1)!.children.map((c) => c.address)).toEqual([
      "defensa-organizada-1.0",
      SUB_1_1,
      "defensa-organizada-1.2",
    ]);
    expect(tree.byAddress.get("defensa-organizada-1.2")!.kind).toBe("placeholder");
    expect(tree.byAddress.get("defensa-organizada-1.2")!.level).toBe(2);
  });

  it("una alta sin número se coloca antes de las notas del padre", () => {
    const tree = buildReadingTree(mockGameModel, {
      "nueva-habilidad": { operation: "add", parentAddress: ZONA, title: "Nueva" },
    });

    expect(tree.byAddress.get(ZONA)!.children.map((c) => c.address)).toEqual([SSP_1_1_1, "nueva-habilidad", NOTA_RIESGO]);
  });

  it("ignora los cambios que apuntan a nodos que no existen", () => {
    const tree = buildReadingTree(mockGameModel, {
      "no-existe": { operation: "remove" },
      "otra-alta": { operation: "add", parentAddress: "padre-inexistente", title: "x" },
    });

    expect(tree.byAddress.has("no-existe")).toBe(false);
    expect(tree.byAddress.has("otra-alta")).toBe(false);
    expect(collectPinnedAddresses(tree).size).toBe(0);
  });

  it("fija el nodo con cambio y todos sus ancestros", () => {
    const tree = buildReadingTree(mockGameModel, { [SKILL_ACTIVACION]: { operation: "change" } });

    expect([...collectPinnedAddresses(tree)].sort()).toEqual(
      [PHASE, PRINCIPLE_1, SUB_1_1, ZONA, SSP_1_1_1, SKILL_ACTIVACION].sort()
    );
  });

  it("los marcadores de alta aparecen en los nodos en orden de documento", () => {
    const tree = buildReadingTree(mockGameModel, {
      "nuevo-principio": { operation: "add", parentAddress: PHASE, number: "3", title: "Tercero" },
    });

    expect(tree.nodes.map((n) => n.address)).toContain("nuevo-principio");
    expect(tree.roots[0].children.at(-1)!.address).toBe("nuevo-principio");
  });
});
