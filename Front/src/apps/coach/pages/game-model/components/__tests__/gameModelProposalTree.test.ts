import { describe, expect, it, vi } from "vitest";
import {
  applyChange,
  canAccept,
  discardOrphans,
  rejectWithDependents,
  type TrackedChange,
} from "../gameModelProposalTree";
import gameModelService, { type AssistantChange } from "../../../../services/gameModelService";
import { mockGameModel } from "../../../../services/gameModelMock";
import type { GameModel } from "../../../../types/gameModel";

const mockPost = vi.fn();
vi.mock("../../../../../../core/api/client", () => ({
  client: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

/** Changes exactly as the backend serializes them: missing optional fields arrive as null. */
async function changesFromService(changes: unknown[]): Promise<AssistantChange[]> {
  mockPost.mockResolvedValueOnce({
    data: { kind: "proposal", message: "Propuesta", changes, discardedCount: 0, version: "v1" },
  });
  const reply = await gameModelService.assistant("model-1", [{ role: "user", content: "Propón" }]);
  return reply.changes;
}

const PRINCIPLE_1 = "defensa-organizada-1";
const SUB_1_1 = "defensa-organizada-1.1";
const ZONA = "defensa-organizada-1.1-finalizacion";
const SSP_1_1_1 = "defensa-organizada-1.1.1";
const SKILL_ACTIVACION = `${SSP_1_1_1}/hab:hab-1`;
const NOTA_RIESGO = `${ZONA}/nota:nota-1`;
const SET_PIECE = "set-pieces/spr-1";

function subprincipio(model: GameModel) {
  return model.principles[0].subprincipios[0];
}

function zona(model: GameModel) {
  return subprincipio(model).zonas[0];
}

function ssp(model: GameModel) {
  return zona(model).subSubPrincipios[0];
}

function tracked(change: AssistantChange, status: TrackedChange["status"] = "pending"): TrackedChange {
  return { ...change, status };
}

function changeSubprincipioTexto(id: string, texto: string): AssistantChange {
  return { id, operation: "change", nodeType: "subprincipio", address: SUB_1_1, fields: { texto } };
}

function addSubprincipio(id: string, parentAddress: string, numero: string, titulo: string): AssistantChange {
  return { id, operation: "add", nodeType: "subprincipio", parentAddress, fields: { numero, titulo, texto: "Texto" } };
}

function addZonaUnderChange(id: string, parentChangeId: string): AssistantChange {
  return { id, operation: "add", nodeType: "zona", parentChangeId, fields: { zoneKeysCsv: "iniciacion", texto: "Texto" } };
}

function addSubSubPrincipioUnderChange(id: string, parentChangeId: string): AssistantChange {
  return {
    id,
    operation: "add",
    nodeType: "subSubPrincipio",
    parentChangeId,
    fields: { numero: "1.2.1", rol: "Rol", texto: "Texto" },
  };
}

describe("applyChange", () => {
  it("al aceptar uno de dos cambios aplica solo ese y deja el otro sin aplicar", () => {
    const acceptedChange = changeSubprincipioTexto("c1", "Nuevo texto");

    const next = applyChange(mockGameModel, acceptedChange);

    expect(subprincipio(next).texto).toBe("Nuevo texto");
    expect(next.principles[0].texto).toBe(mockGameModel.principles[0].texto);
  });

  it("devuelve un árbol nuevo y nunca muta el árbol de entrada", () => {
    const before = structuredClone(mockGameModel);

    const next = applyChange(mockGameModel, changeSubprincipioTexto("c1", "Nuevo texto"));

    expect(next).not.toBe(mockGameModel);
    expect(mockGameModel).toEqual(before);
  });

  it("aplica tres cambios aceptados en secuencia y deja un solo árbol con los tres", () => {
    const removeSkill: AssistantChange = { id: "c3", operation: "remove", nodeType: "habilidad", address: SKILL_ACTIVACION, fields: {} };

    const step1 = applyChange(mockGameModel, changeSubprincipioTexto("c1", "Nuevo texto"));
    const step2 = applyChange(step1, addSubprincipio("c2", PRINCIPLE_1, "1.2", "Nuevo subprincipio"));
    const final = applyChange(step2, removeSkill);

    expect(subprincipio(final).texto).toBe("Nuevo texto");
    expect(final.principles[0].subprincipios.map((s) => s.titulo)).toContain("Nuevo subprincipio");
    expect(ssp(final).habilidades.map((h) => h.apiId)).not.toContain("hab-1");
  });

  it("añade un principio con su fase, número y título", () => {
    const addPrinciple: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "principio",
      fields: { gameMomentId: 1, numero: 3, titulo: "Nuevo principio", texto: "Texto" },
    };

    const next = applyChange(mockGameModel, addPrinciple);

    expect(next.principles.map((p) => p.titulo)).toContain("Nuevo principio");
  });

  it("añade una zona bajo su subprincipio", () => {
    const addZona: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "zona",
      parentAddress: SUB_1_1,
      fields: { zoneKeysCsv: "iniciacion", texto: "Texto" },
    };

    const next = applyChange(mockGameModel, addZona);

    expect(subprincipio(next).zonas.map((z) => z.zoneKeys)).toContainEqual(["iniciacion"]);
  });

  it("añade un sub-subprincipio bajo su subprincipio", () => {
    const addSsp: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "subSubPrincipio",
      parentAddress: SUB_1_1,
      fields: { numero: "1.1.2", rol: "Rol nuevo", texto: "Texto" },
    };

    const next = applyChange(mockGameModel, addSsp);

    expect(subprincipio(next).subSubPrincipios.map((s) => s.rol)).toContain("Rol nuevo");
  });

  it("añade una habilidad bajo su sub-subprincipio", () => {
    const addHabilidad: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "habilidad",
      parentAddress: SSP_1_1_1,
      fields: { nombre: "Marcaje", descripcion: "Descripción", entrenable: "Sí" },
    };

    const next = applyChange(mockGameModel, addHabilidad);

    expect(ssp(next).habilidades.map((h) => h.nombre)).toContain("Marcaje");
  });

  it("añade una nota bajo su principio", () => {
    const addNota: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "nota",
      parentAddress: PRINCIPLE_1,
      fields: { tipo: "nota", texto: "Nota nueva" },
    };

    const next = applyChange(mockGameModel, addNota);

    expect(next.principles[0].notas.map((n) => n.texto)).toContain("Nota nueva");
  });

  it("añade una regla de balón parado", () => {
    const addRule: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "setPieceRule",
      fields: { subtype: "penaltis", texto: "Penalti" },
    };

    const next = applyChange(mockGameModel, addRule);

    expect(next.setPieceRules.map((r) => r.subtype)).toContain("penaltis");
  });

  it("cambia el texto de un principio", () => {
    const change: AssistantChange = {
      id: "c1",
      operation: "change",
      nodeType: "principio",
      address: PRINCIPLE_1,
      fields: { texto: "Principio revisado" },
    };

    expect(applyChange(mockGameModel, change).principles[0].texto).toBe("Principio revisado");
  });

  it("cambia el texto de una zona", () => {
    const change: AssistantChange = { id: "c1", operation: "change", nodeType: "zona", address: ZONA, fields: { texto: "Zona revisada" } };

    expect(zona(applyChange(mockGameModel, change)).texto).toBe("Zona revisada");
  });

  it("cambia el rol de un sub-subprincipio", () => {
    const change: AssistantChange = {
      id: "c1",
      operation: "change",
      nodeType: "subSubPrincipio",
      address: SSP_1_1_1,
      fields: { rol: "Rol revisado" },
    };

    expect(ssp(applyChange(mockGameModel, change)).rol).toBe("Rol revisado");
  });

  it("cambia la descripción de una habilidad", () => {
    const change: AssistantChange = {
      id: "c1",
      operation: "change",
      nodeType: "habilidad",
      address: SKILL_ACTIVACION,
      fields: { descripcion: "Descripción revisada" },
    };

    expect(ssp(applyChange(mockGameModel, change)).habilidades[0].descripcion).toBe("Descripción revisada");
  });

  it("cambia el texto de una nota", () => {
    const change: AssistantChange = { id: "c1", operation: "change", nodeType: "nota", address: NOTA_RIESGO, fields: { texto: "Nota revisada" } };

    expect(zona(applyChange(mockGameModel, change)).notas[0].texto).toBe("Nota revisada");
  });

  it("cambia el texto de una regla de balón parado", () => {
    const change: AssistantChange = {
      id: "c1",
      operation: "change",
      nodeType: "setPieceRule",
      address: SET_PIECE,
      fields: { texto: "Penalti revisado" },
    };

    expect(applyChange(mockGameModel, change).setPieceRules[0].texto).toBe("Penalti revisado");
  });

  it("elimina una nota del árbol", () => {
    const remove: AssistantChange = { id: "c1", operation: "remove", nodeType: "nota", address: NOTA_RIESGO, fields: {} };

    expect(zona(applyChange(mockGameModel, remove)).notas).toHaveLength(0);
  });

  it("elimina una regla de balón parado del árbol", () => {
    const remove: AssistantChange = { id: "c1", operation: "remove", nodeType: "setPieceRule", address: SET_PIECE, fields: {} };

    expect(applyChange(mockGameModel, remove).setPieceRules).toHaveLength(0);
  });
});

describe("canAccept", () => {
  it("no permite aceptar un alta cuyo padre sigue pendiente y sí cuando el padre está aceptado", () => {
    const parent = tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio"));
    const dependent = tracked(addZonaUnderChange("c2", "c1"));

    expect(canAccept(dependent, [parent, dependent])).toBe(false);
    expect(canAccept(dependent, [{ ...parent, status: "accepted" }, dependent])).toBe(true);
  });
});

describe("rejectWithDependents", () => {
  it("al rechazar un padre con dos dependientes marca los tres como rechazados", () => {
    const parent = tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio"));
    const zonaDependent = tracked(addZonaUnderChange("c2", "c1"));
    const sspDependent = tracked(addSubSubPrincipioUnderChange("c3", "c1"));

    const result = rejectWithDependents([parent, zonaDependent, sspDependent], "c1");

    expect(result.map((c) => c.status)).toEqual(["rejected", "rejected", "rejected"]);
  });

  it("al rechazar un cambio sin dependientes deja el árbol del modelo intacto y marca el cambio como rechazado", () => {
    const before = structuredClone(mockGameModel);
    const change = tracked(changeSubprincipioTexto("c1", "Nuevo texto"));

    const result = rejectWithDependents([change], "c1");

    expect(result).toEqual([{ ...change, status: "rejected" }]);
    expect(mockGameModel).toEqual(before);
  });
});

describe("discardOrphans", () => {
  it("tras aceptar la eliminación de un subprincipio descarta el cambio pendiente a una de sus zonas", () => {
    const removal: AssistantChange = { id: "c1", operation: "remove", nodeType: "subprincipio", address: SUB_1_1, fields: {} };
    const zonaChange = tracked({
      id: "c2",
      operation: "change",
      nodeType: "zona",
      address: ZONA,
      fields: { texto: "Zona revisada" },
    });
    const afterRemoval = applyChange(mockGameModel, removal);

    const result = discardOrphans(afterRemoval, [zonaChange]);

    expect(result.changes).toEqual([]);
    expect(result.discarded).toBe(1);
  });

  it("descarta un cambio pendiente que depende de un cambio descartado, contando ambos", () => {
    const missingTarget: TrackedChange = { ...tracked(changeSubprincipioTexto("c1", "Nuevo texto")), address: "no-existe" };
    const dependent = tracked(addZonaUnderChange("c2", "c1"));

    const result = discardOrphans(mockGameModel, [missingTarget, dependent]);

    expect(result.changes).toEqual([]);
    expect(result.discarded).toBe(2);
  });
});

describe("rejectWithDependents transitivo", () => {
  it("rechazar el cambio raíz rechaza también al dependiente y al dependiente del dependiente", () => {
    const c1 = tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio"));
    const c2 = tracked(addZonaUnderChange("c2", "c1"));
    const c3 = tracked(addSubSubPrincipioUnderChange("c3", "c2"));

    const result = rejectWithDependents([c1, c2, c3], "c1");

    expect(result.map((c) => c.status)).toEqual(["rejected", "rejected", "rejected"]);
  });

  it("rechazar solo el dependiente deja pendiente al padre y rechaza al dependiente y a sus dependientes", () => {
    const c1 = tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio"));
    const c2 = tracked(addZonaUnderChange("c2", "c1"));
    const c3 = tracked(addSubSubPrincipioUnderChange("c3", "c2"));

    const result = rejectWithDependents([c1, c2, c3], "c2");

    expect(result.map((c) => c.status)).toEqual(["pending", "rejected", "rejected"]);
  });
});

describe("rejectWithDependents con dependientes ya aceptados", () => {
  it("no cambia el estado de un dependiente ya aceptado al rechazar su padre", () => {
    const parent = tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio"));
    const acceptedDependent = tracked(addZonaUnderChange("c2", "c1"), "accepted");

    const result = rejectWithDependents([parent, acceptedDependent], "c1");

    expect(result[1].status).toBe("accepted");
  });
});

describe("removeItem de habilidad", () => {
  it("al aceptar la eliminación de una habilidad la quita de su sub-subprincipio", () => {
    const removeHabilidad: AssistantChange = {
      id: "c1",
      operation: "remove",
      nodeType: "habilidad",
      address: SKILL_ACTIVACION,
      fields: {},
    };

    const next = applyChange(mockGameModel, removeHabilidad);

    expect(ssp(next).habilidades.map((h) => h.apiId)).toEqual(["hab-2"]);
    expect(ssp(mockGameModel).habilidades).toHaveLength(2);
  });
});

describe("canAccept con cambios que no están pendientes", () => {
  it("no permite aceptar un cambio que ya está aceptado o rechazado", () => {
    const change = changeSubprincipioTexto("c1", "Nuevo texto");

    expect(canAccept({ ...change, status: "accepted" }, [])).toBe(false);
    expect(canAccept({ ...change, status: "rejected" }, [])).toBe(false);
  });
});

function nullAdd(id: string, parentAddress: string | null, parentChangeId: string | null) {
  return {
    id,
    operation: "add",
    nodeType: "subprincipio",
    address: null,
    parentAddress,
    parentChangeId,
    fields: { numero: "1.2", titulo: "Nuevo", texto: "Texto" },
  };
}

function nullZonaUnder(id: string, parentChangeId: string) {
  return {
    id,
    operation: "add",
    nodeType: "zona",
    address: null,
    parentAddress: null,
    parentChangeId,
    fields: { zoneKeysCsv: "iniciacion", texto: "Texto" },
  };
}

describe("cambios que llegan del servicio con null (C1)", () => {
  it("C1 — un cambio independiente con null en sus campos opcionales se puede aceptar", async () => {
    const [independent] = await changesFromService([nullAdd("c1", PRINCIPLE_1, null)]);

    expect(canAccept(tracked(independent), [tracked(independent)])).toBe(true);
  });

  it("C1 — un cambio dependiente que llega del servicio solo se puede aceptar cuando su padre está aceptado", async () => {
    const [parent, dependent] = await changesFromService([nullAdd("c1", PRINCIPLE_1, null), nullZonaUnder("c2", "c1")]);

    expect(canAccept(tracked(dependent), [tracked(parent), tracked(dependent)])).toBe(false);
    expect(canAccept(tracked(dependent), [tracked(parent, "accepted"), tracked(dependent)])).toBe(true);
  });

  it("C1 — descartar huérfanos no elimina un alta pendiente cuyo padre existe en el modelo", async () => {
    const [independent] = await changesFromService([nullAdd("c1", PRINCIPLE_1, null)]);

    const result = discardOrphans(mockGameModel, [tracked(independent)]);

    expect(result.changes).toHaveLength(1);
    expect(result.discarded).toBe(0);
  });
});
