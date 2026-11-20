import { describe, expect, it, vi } from "vitest";
import { assistantPendingChanges, proposedAddAddress } from "../gameModelAssistantPending";
import { applyChange, type TrackedChange } from "../gameModelProposalTree";
import gameModelService, { type AssistantChange } from "../../../../services/gameModelService";
import { mockGameModel } from "../../../../services/gameModelMock";

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
const SKILL_ACTIVACION = "defensa-organizada-1.1.1/hab:hab-1";

function tracked(change: AssistantChange, status: TrackedChange["status"] = "pending"): TrackedChange {
  return { ...change, status };
}

function addSubprincipio(id: string, parentAddress: string, numero: string, titulo: string): AssistantChange {
  return { id, operation: "add", nodeType: "subprincipio", parentAddress, fields: { numero, titulo, texto: "Texto" } };
}

describe("assistantPendingChanges", () => {
  it("solo muestra las propuestas pendientes y omite las aceptadas y las rechazadas", () => {
    const pending = assistantPendingChanges([
      tracked({ id: "c1", operation: "change", nodeType: "subprincipio", address: SUB_1_1, fields: { texto: "Nuevo" } }),
      tracked(
        { id: "c2", operation: "change", nodeType: "principio", address: PRINCIPLE_1, fields: { texto: "Otro" } },
        "accepted"
      ),
      tracked(
        { id: "c3", operation: "remove", nodeType: "habilidad", address: SKILL_ACTIVACION, fields: {} },
        "rejected"
      ),
    ]);

    expect(Object.keys(pending)).toEqual([SUB_1_1]);
  });

  it("un cambio se identifica por la dirección que toca, con su operación, su texto y su changeId", () => {
    const pending = assistantPendingChanges([
      tracked({ id: "c1", operation: "change", nodeType: "subprincipio", address: SUB_1_1, fields: { texto: "Nuevo texto" } }),
    ]);

    expect(pending[SUB_1_1]).toEqual({
      operation: "change",
      text: "Nuevo texto",
      changeId: "c1",
      canAccept: true,
    });
  });

  it("una eliminación se identifica por la dirección que elimina, con su operación y su changeId", () => {
    const pending = assistantPendingChanges([
      tracked({ id: "c2", operation: "remove", nodeType: "habilidad", address: SKILL_ACTIVACION, fields: {} }),
    ]);

    expect(pending[SKILL_ACTIVACION]).toEqual({ operation: "remove", changeId: "c2", canAccept: true });
  });

  it("un cambio toma su título de los campos del cambio", () => {
    const pending = assistantPendingChanges([
      tracked({ id: "c1", operation: "change", nodeType: "subprincipio", address: SUB_1_1, fields: { titulo: "Nuevo título" } }),
    ]);

    expect(pending[SUB_1_1].title).toBe("Nuevo título");
  });

  it("canAccept se toma del módulo de árbol: un alta cuyo padre sigue pendiente no se puede aceptar, y sí cuando el padre está aceptado", () => {
    const parent = addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio");
    const dependent: AssistantChange = {
      id: "c2",
      operation: "add",
      nodeType: "zona",
      parentChangeId: "c1",
      fields: { zoneKeysCsv: "iniciacion", texto: "Texto" },
    };

    const withParentPending = assistantPendingChanges([tracked(parent), tracked(dependent)]);
    expect(withParentPending[proposedAddAddress("c2")].canAccept).toBe(false);
    expect(withParentPending[proposedAddAddress("c1")].canAccept).toBe(true);

    const withParentAccepted = assistantPendingChanges([tracked(parent, "accepted"), tracked(dependent)]);
    expect(withParentAccepted[proposedAddAddress("c2")].canAccept).toBe(true);
  });

  it("un alta se coloca con la clave pending:{changeId} bajo su parentAddress, con su número, título y texto", () => {
    const pending = assistantPendingChanges([tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio"))]);

    expect(proposedAddAddress("c1")).toBe("pending:c1");
    expect(pending["pending:c1"]).toEqual({
      operation: "add",
      parentAddress: PRINCIPLE_1,
      number: "1.2",
      title: "Nuevo subprincipio",
      text: "Texto",
      changeId: "c1",
      canAccept: true,
    });
  });

  it("un alta dependiente toma el parentAddress de su cambio padre", () => {
    const pending = assistantPendingChanges([
      tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Nuevo subprincipio")),
      tracked({ id: "c2", operation: "add", nodeType: "zona", parentChangeId: "c1", fields: { zoneKeysCsv: "iniciacion" } }),
    ]);

    expect(pending["pending:c2"].parentAddress).toBe(PRINCIPLE_1);
  });

  it("dos altas bajo el mismo padre aparecen las dos, con claves distintas", () => {
    const pending = assistantPendingChanges([
      tracked(addSubprincipio("c1", PRINCIPLE_1, "1.2", "Primera")),
      tracked(addSubprincipio("c2", PRINCIPLE_1, "1.3", "Segunda")),
    ]);

    expect(Object.keys(pending).sort()).toEqual(["pending:c1", "pending:c2"]);
    expect(pending["pending:c1"].parentAddress).toBe(PRINCIPLE_1);
    expect(pending["pending:c2"].parentAddress).toBe(PRINCIPLE_1);
  });

  it("comportamiento actual: un alta de principio, que no tiene padre, no genera ninguna entrada (brecha conocida frente a la tarjeta de alta)", () => {
    const pending = assistantPendingChanges([
      tracked({
        id: "c1",
        operation: "add",
        nodeType: "principio",
        fields: { gameMomentId: 1, numero: 3, titulo: "Nuevo principio", texto: "Texto" },
      }),
    ]);

    expect(Object.keys(pending)).toEqual([]);
  });

  it("comportamiento actual: un alta de regla de balón parado, que no tiene padre, no genera ninguna entrada (brecha conocida frente a la tarjeta de alta)", () => {
    const pending = assistantPendingChanges([
      tracked({ id: "c1", operation: "add", nodeType: "setPieceRule", fields: { subtype: "penaltis", texto: "Penalti" } }),
    ]);

    expect(Object.keys(pending)).toEqual([]);
  });

  it("C1 — un alta dependiente que llega del servicio con null se muestra bajo el parentAddress de su cambio padre", async () => {
    const [parent, dependent] = await changesFromService([
      { id: "c1", operation: "add", nodeType: "subprincipio", address: null, parentAddress: PRINCIPLE_1, parentChangeId: null, fields: { numero: "1.2", titulo: "Nuevo" } },
      { id: "c2", operation: "add", nodeType: "zona", address: null, parentAddress: null, parentChangeId: "c1", fields: { zoneKeysCsv: "iniciacion" } },
    ]);

    const pending = assistantPendingChanges([tracked(parent), tracked(dependent)]);

    expect(pending["pending:c2"].parentAddress).toBe(PRINCIPLE_1);
  });

  it("L7 — la clave del marcador de un alta coincide en el árbol de propuestas y en las tarjetas", () => {
    const add: AssistantChange = {
      id: "c1",
      operation: "add",
      nodeType: "subprincipio",
      parentAddress: PRINCIPLE_1,
      fields: { numero: "1.2", titulo: "Nuevo subprincipio", texto: "Texto" },
    };

    const tree = applyChange(mockGameModel, add);
    const created = tree.principles[0].subprincipios.find((s) => s.key === proposedAddAddress("c1"));
    const pending = assistantPendingChanges([tracked(add)]);

    expect(created).toBeDefined();
    expect(Object.keys(pending)).toEqual([proposedAddAddress("c1")]);
  });
});
