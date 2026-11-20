import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import gameModelService, { type AssistantMessage } from "../gameModelService";
import type { GameModel } from "../../types/gameModel";

describe("gameModelService.getAdnOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplana el GameModel del equipo en listas de Subprincipio y SubSubPrincipio", async () => {
    mockGet.mockResolvedValue({
      data: {
        id: "model-1",
        teamId: "team-1",
        name: "Modelo",
        season: "2026-2027",
        principles: [
          {
            id: "principle-1",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
            key: "p1",
            numero: 1,
            titulo: "Defensa organizada",
            texto: "",
            notas: [],
            subprincipios: [
              {
                id: "sub-1",
                key: "sp1",
                numero: "1.1",
                titulo: "Presión alta",
                texto: "",
                notas: [],
                zonas: [
                  {
                    id: "zona-1",
                    key: "z1",
                    zoneKeysCsv: "iniciacion",
                    texto: "",
                    notas: [],
                    subSubPrincipios: [
                      {
                        id: "ssp-1",
                        key: "ssp1",
                        numero: "1.1.1",
                        rol: "Central",
                        texto: "",
                        habilidades: [],
                        notas: [],
                      },
                    ],
                  },
                ],
                subSubPrincipios: [],
              },
            ],
          },
        ],
        setPieceRules: [],
        openIssues: [],
      },
    });

    const result = await gameModelService.getAdnOptions("team-1", "2026-2027");

    expect(mockGet).toHaveBeenCalledWith("/api/game-models", {
      params: { teamId: "team-1", season: "2026-2027" },
    });
    expect(result.subprincipios).toEqual([
      { id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" },
    ]);
    expect(result.subSubPrincipios).toEqual([
      { id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" },
    ]);
  });

  it("devuelve listas vacías (no un error) cuando el equipo no tiene GameModel todavía", async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } });

    const result = await gameModelService.getAdnOptions("team-1", "2026-2027");

    expect(result).toEqual({ subprincipios: [], subSubPrincipios: [] });
  });

  it("propaga errores que no son 404", async () => {
    const error = { response: { status: 403 } };
    mockGet.mockRejectedValue(error);

    await expect(gameModelService.getAdnOptions("team-1", "2026-2027")).rejects.toBe(error);
  });
});

describe("gameModelService.getAdnCoverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a GET /api/game-models/adn-coverage con teamId y season, y devuelve el shape mapeado", async () => {
    mockGet.mockResolvedValue({
      data: {
        subSubPrincipios: [
          {
            subSubPrincipioId: "ssp-1",
            isUsed: true,
            sessions: [{ sessionId: "sess-1", sessionName: "Sesión 1", date: "2026-09-09T00:00:00" }],
          },
        ],
        zonas: [{ zonaId: "zona-1", status: "in-progress" }],
        subprincipios: [{ subprincipioId: "sub-1", status: "completed" }],
        principios: [{ principioId: "principle-1", status: "not-started" }],
      },
    });

    const result = await gameModelService.getAdnCoverage("team-1", "2026-2027");

    expect(mockGet).toHaveBeenCalledWith("/api/game-models/adn-coverage", {
      params: { teamId: "team-1", season: "2026-2027" },
    });
    expect(result).toEqual({
      subSubPrincipios: [
        {
          subSubPrincipioId: "ssp-1",
          isUsed: true,
          sessions: [{ sessionId: "sess-1", sessionName: "Sesión 1", date: "2026-09-09T00:00:00" }],
        },
      ],
      zonas: [{ zonaId: "zona-1", status: "in-progress" }],
      subprincipios: [{ subprincipioId: "sub-1", status: "completed" }],
      principios: [{ principioId: "principle-1", status: "not-started" }],
    });
  });
});

describe("gameModelService.getByTeamIdAndSeason — marcador de versión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expone la versión del modelo leída del servidor", async () => {
    mockGet.mockResolvedValue({
      data: {
        id: "model-1",
        teamId: "team-1",
        name: "Modelo",
        season: "2026-2027",
        version: "v1",
        principles: [],
        setPieceRules: [],
        openIssues: [],
      },
    });

    const model = await gameModelService.getByTeamIdAndSeason("team-1", "2026-2027");

    expect(model).toMatchObject({ version: "v1" });
  });
});

describe("gameModelService.update — expectedVersion", () => {
  const draft: GameModel = {
    id: "model-1",
    teamId: "team-1",
    season: "2026-2027",
    name: "Modelo",
    principles: [],
    setPieceRules: [],
    openIssues: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía expectedVersion en el cuerpo del PUT cuando se indica", async () => {
    mockPut.mockResolvedValue({ data: {} });

    await gameModelService.update(draft, { expectedVersion: "v1" });

    const [, body] = mockPut.mock.calls[0];
    expect(body).toMatchObject({ expectedVersion: "v1" });
  });

  it("no envía expectedVersion en el cuerpo del PUT cuando no se indica", async () => {
    mockPut.mockResolvedValue({ data: {} });

    await gameModelService.update(draft);

    const [, body] = mockPut.mock.calls[0];
    expect(body).not.toHaveProperty("expectedVersion");
  });

  it("rechaza con error.code GameModelStale ante un 409 de ProblemDetails", async () => {
    mockPut.mockRejectedValue({
      response: { status: 409, data: { code: "GameModelStale", detail: "El modelo ha cambiado." } },
    });

    await expect(gameModelService.update(draft, { expectedVersion: "v1" })).rejects.toMatchObject({
      code: "GameModelStale",
    });
  });
});

describe("gameModelService.assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía los mensajes a POST /api/game-models/{id}/assistant y devuelve la respuesta parseada", async () => {
    const reply = { kind: "question", message: "¿Qué zona quieres revisar?", changes: [], discardedCount: 0, version: "v1" };
    mockPost.mockResolvedValue({ data: reply });
    const messages: AssistantMessage[] = [{ role: "user", content: "Revisa la presión" }];

    const result = await gameModelService.assistant("id", messages);

    expect(mockPost).toHaveBeenCalledWith("/api/game-models/id/assistant", { messages });
    expect(result).toEqual(reply);
  });
});

describe("gameModelService.update — error del backend conservado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conserva response.data.detail y code cuando el PUT falla con ProblemDetails 4xx", async () => {
    const detail = "No tienes acceso a este modelo de juego.";
    mockPut.mockRejectedValue({ response: { status: 400, data: { detail, code: "GameModelAccessDenied" } } });
    const draft: GameModel = {
      id: "model-1",
      teamId: "team-1",
      season: "2026-2027",
      name: "Modelo",
      principles: [],
      setPieceRules: [],
      openIssues: [],
    };

    const error = await gameModelService.update(draft).catch((e: unknown) => e);

    expect(error).toMatchObject({
      response: { data: { detail } },
      code: "GameModelAccessDenied",
    });
  });
});

describe("gameModelService.assistant — campos opcionales null (C1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("C1 — una respuesta del asistente con null en address, parentAddress y parentChangeId devuelve esos campos ausentes", async () => {
    mockPost.mockResolvedValue({
      data: {
        kind: "proposal",
        message: "Propuesta",
        changes: [
          {
            id: "c1",
            operation: "add",
            nodeType: "subprincipio",
            address: null,
            parentAddress: "defensa-organizada-1",
            parentChangeId: null,
            fields: { numero: "1.2", titulo: "Nuevo" },
          },
        ],
        discardedCount: 0,
        version: "v1",
      },
    });

    const reply = await gameModelService.assistant("id", [{ role: "user", content: "Hola" }]);
    const [change] = reply.changes;

    expect(change).toEqual({
      id: "c1",
      operation: "add",
      nodeType: "subprincipio",
      parentAddress: "defensa-organizada-1",
      fields: { numero: "1.2", titulo: "Nuevo" },
    });
    expect("parentChangeId" in change).toBe(false);
    expect("address" in change).toBe(false);
  });
});
