import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAssistant = vi.fn();
vi.mock("../../../../services/gameModelService", () => ({
  default: {
    assistant: (...args: unknown[]) => mockAssistant(...args),
  },
}));

import { useGameModelAssistant } from "../useGameModelAssistant";
import type { AssistantChange, AssistantReply } from "../../../../services/gameModelService";
import { applyChange } from "../../components/gameModelProposalTree";
import { mockGameModel } from "../../../../services/gameModelMock";
import type { GameModel } from "../../../../types/gameModel";

const PRINCIPLE_1 = "defensa-organizada-1";
const SUB_1_1 = "defensa-organizada-1.1";
const ZONA = "defensa-organizada-1.1-finalizacion";

const questionReply: AssistantReply = {
  kind: "question",
  message: "¿Qué zona quieres revisar?",
  changes: [],
  discardedCount: 0,
  version: "v1",
};

function proposalReply(changes: AssistantChange[], discardedCount = 0, version = "v2"): AssistantReply {
  return { kind: "proposal", message: "Propuesta", changes, discardedCount, version };
}

const addSubprincipio: AssistantChange = {
  id: "c1",
  operation: "add",
  nodeType: "subprincipio",
  parentAddress: PRINCIPLE_1,
  fields: { numero: "1.2", titulo: "Nuevo subprincipio", texto: "Texto" },
};

const addZonaUnderC1: AssistantChange = {
  id: "c2",
  operation: "add",
  nodeType: "zona",
  parentChangeId: "c1",
  fields: { zoneKeysCsv: "iniciacion", texto: "Texto" },
};

const removeSubprincipio: AssistantChange = {
  id: "c1",
  operation: "remove",
  nodeType: "subprincipio",
  address: SUB_1_1,
  fields: {},
};

const changeZonaTexto: AssistantChange = {
  id: "c2",
  operation: "change",
  nodeType: "zona",
  address: ZONA,
  fields: { texto: "Zona revisada" },
};

function renderAssistant(model: GameModel = mockGameModel, onModelChange = vi.fn()) {
  const hook = renderHook(() =>
    useGameModelAssistant({ gameModelId: "model-1", model, onModelChange })
  );
  return { ...hook, onModelChange };
}

let snackbarListener: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  snackbarListener = vi.fn();
  window.addEventListener("rffm.show_snackbar", snackbarListener as EventListener);
});

afterEach(() => {
  window.removeEventListener("rffm.show_snackbar", snackbarListener as EventListener);
});

describe("useGameModelAssistant — conversación", () => {
  it("un segundo mensaje llama al servicio con los mensajes anteriores y el nuevo", async () => {
    mockAssistant.mockResolvedValue(questionReply);
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("Primer mensaje");
    });
    await act(async () => {
      await result.current.send("Segundo mensaje");
    });

    expect(mockAssistant).toHaveBeenLastCalledWith("model-1", [
      { role: "user", content: "Primer mensaje" },
      { role: "assistant", content: "¿Qué zona quieres revisar?", kind: "question" },
      { role: "user", content: "Segundo mensaje" },
    ]);
  });

  it("un error del servicio deja el error y conserva los mensajes, y reintentar envía los mismos mensajes", async () => {
    mockAssistant.mockRejectedValueOnce(new Error("Fallo de red"));
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("Hola");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.messages).toEqual([{ role: "user", content: "Hola" }]);

    mockAssistant.mockResolvedValueOnce(questionReply);
    await act(async () => {
      await result.current.retry();
    });

    expect(mockAssistant).toHaveBeenLastCalledWith("model-1", [{ role: "user", content: "Hola" }]);
    expect(result.current.messages).toHaveLength(2);
  });

  it("una respuesta de pregunta añade el mensaje del asistente y deja los cambios vacíos", async () => {
    mockAssistant.mockResolvedValue(questionReply);
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("Quiero cambiar algo");
    });

    expect(result.current.messages.at(-1)).toEqual({
      role: "assistant",
      content: "¿Qué zona quieres revisar?",
      kind: "question",
    });
    expect(result.current.changes).toEqual([]);
  });
});

describe("useGameModelAssistant — propuestas", () => {
  it("una propuesta guarda sus cambios como pendientes y conserva su versión", async () => {
    mockAssistant.mockResolvedValue(proposalReply([addSubprincipio], 0, "v2"));
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("Propón cambios");
    });

    expect(result.current.changes.map((c) => [c.id, c.status])).toEqual([["c1", "pending"]]);
    expect(result.current.proposalVersion).toBe("v2");
  });

  it("una propuesta con dos cambios descartados dispara un único aviso que menciona los dos descartados", async () => {
    mockAssistant.mockResolvedValue(proposalReply([addSubprincipio], 2));
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("Propón cambios");
    });

    expect(snackbarListener).toHaveBeenCalledTimes(1);
    const detail = (snackbarListener.mock.calls[0][0] as CustomEvent<{ message: string }>).detail;
    expect(detail.message).toMatch(/2/);
  });
});

describe("useGameModelAssistant — aceptar y rechazar", () => {
  it("aceptar un alta aplica el árbol de applyChange y marca el cambio como aceptado; su dependiente espera a su padre", async () => {
    mockAssistant.mockResolvedValue(proposalReply([addSubprincipio, addZonaUnderC1]));
    const { result, onModelChange } = renderAssistant();
    await act(async () => {
      await result.current.send("Propón cambios");
    });
    expect(result.current.changes).toHaveLength(2);

    act(() => {
      result.current.accept("c2");
    });
    expect(onModelChange).not.toHaveBeenCalled();
    expect(result.current.changes.find((c) => c.id === "c2")?.status).toBe("pending");

    act(() => {
      result.current.accept("c1");
    });
    expect(onModelChange).toHaveBeenCalledTimes(1);
    expect(onModelChange.mock.calls[0][0]).toEqual(applyChange(mockGameModel, addSubprincipio));
    expect(result.current.changes.find((c) => c.id === "c1")?.status).toBe("accepted");

    act(() => {
      result.current.accept("c2");
    });
    expect(onModelChange).toHaveBeenCalledTimes(2);
    expect(result.current.changes.find((c) => c.id === "c2")?.status).toBe("accepted");
  });

  it("tras aceptar una eliminación que deja huérfano un cambio pendiente, avisa y descarta el huérfano", async () => {
    mockAssistant.mockResolvedValue(proposalReply([removeSubprincipio, changeZonaTexto]));
    const { result } = renderAssistant();
    await act(async () => {
      await result.current.send("Elimina el subprincipio");
    });

    act(() => {
      result.current.accept("c1");
    });

    expect(snackbarListener).toHaveBeenCalledTimes(1);
    expect(result.current.changes.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("useGameModelAssistant — cerrar", () => {
  it("cerrar vacía los mensajes y los cambios", async () => {
    mockAssistant.mockResolvedValue(proposalReply([addSubprincipio]));
    const { result } = renderAssistant();
    await act(async () => {
      await result.current.send("Propón cambios");
    });
    expect(result.current.messages).not.toHaveLength(0);

    act(() => {
      result.current.close();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.changes).toEqual([]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useGameModelAssistant — rechazar con dependientes", () => {
  it("rechazar un cambio marca como rechazados sus dependientes, no toca el árbol y deja intactos los demás", async () => {
    const unrelated: AssistantChange = { ...changeZonaTexto, id: "c3" };
    mockAssistant.mockResolvedValue(proposalReply([addSubprincipio, addZonaUnderC1, unrelated]));
    const { result, onModelChange } = renderAssistant();
    await act(async () => {
      await result.current.send("Propón cambios");
    });

    act(() => {
      result.current.reject("c1");
    });

    expect(Object.fromEntries(result.current.changes.map((c) => [c.id, c.status]))).toEqual({
      c1: "rejected",
      c2: "rejected",
      c3: "pending",
    });
    expect(onModelChange).not.toHaveBeenCalled();
  });
});

describe("useGameModelAssistant — peticiones en curso", () => {
  it("un segundo envío mientras hay una petición en curso no vuelve a llamar al servicio", async () => {
    const pending = deferred<AssistantReply>();
    mockAssistant.mockReturnValueOnce(pending.promise);
    const { result } = renderAssistant();
    let first!: Promise<void>;

    act(() => {
      first = result.current.send("Primero");
    });
    await act(async () => {
      await result.current.send("Segundo");
    });

    expect(mockAssistant).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual([{ role: "user", content: "Primero" }]);

    await act(async () => {
      pending.resolve(questionReply);
      await first;
    });
    expect(result.current.messages).toHaveLength(2);
  });

  it("cerrar durante una petición en curso ignora la respuesta tardía", async () => {
    const pending = deferred<AssistantReply>();
    mockAssistant.mockReturnValueOnce(pending.promise);
    const { result } = renderAssistant();
    let sendPromise!: Promise<void>;

    act(() => {
      sendPromise = result.current.send("Propón cambios");
    });
    act(() => {
      result.current.close();
    });
    await act(async () => {
      pending.resolve(proposalReply([addSubprincipio]));
      await sendPromise;
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.changes).toEqual([]);
    expect(result.current.sending).toBe(false);
  });
});

describe("useGameModelAssistant — reintento y errores", () => {
  it("reintentar tras un error reenvía la conversación sin añadir el mensaje del usuario por segunda vez", async () => {
    mockAssistant.mockRejectedValueOnce(new Error("Fallo de red")).mockResolvedValueOnce(questionReply);
    const { result } = renderAssistant();
    await act(async () => {
      await result.current.send("Hola");
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(mockAssistant).toHaveBeenLastCalledWith("model-1", [{ role: "user", content: "Hola" }]);
    expect(result.current.messages.filter((m) => m.role === "user")).toEqual([{ role: "user", content: "Hola" }]);
  });

  it("un error sin mensaje ni detalle muestra un texto de error en español", async () => {
    mockAssistant.mockRejectedValueOnce({});
    const { result } = renderAssistant();

    await act(async () => {
      await result.current.send("Hola");
    });

    expect(result.current.error).toBe("No se pudo consultar al asistente. Inténtalo de nuevo.");
  });
});
