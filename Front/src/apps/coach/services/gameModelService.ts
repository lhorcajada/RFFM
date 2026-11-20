import { client } from "../../../core/api/client";
import type {
  GameModel,
  GameMomentCatalogItem,
  Principle,
  Subprincipio,
  Zona,
  SubSubPrincipio,
  Habilidad,
  Nota,
  SetPieceRule,
  OpenIssue,
} from "../types/gameModel";
import type { AdnOptions, AdnSubSubPrincipioOption } from "../types/seasonPlan";
import type { AdnCoverage } from "../types/adnCoverage";

// ── API response types (nested structure from backend — camelCase over the wire) ──

interface ApiHabilidad {
  id: string;
  nombre: string;
  descripcion: string;
  entrenable: string;
  referenciaAKey?: string | null;
}

interface ApiNota {
  id: string;
  tipo: string;
  texto: string;
}

interface ApiSubSubPrincipio {
  id: string;
  key: string;
  numero: string;
  rol: string;
  texto: string;
  habilidades: ApiHabilidad[];
  notas: ApiNota[];
}

interface ApiZona {
  id: string;
  key: string;
  zoneKeysCsv: string;
  label?: string | null;
  zonaTexto?: string | null;
  texto: string;
  subSubPrincipios: ApiSubSubPrincipio[];
  notas: ApiNota[];
}

interface ApiSubprincipio {
  id: string;
  key: string;
  numero: string;
  titulo: string;
  texto: string;
  zonas: ApiZona[];
  subSubPrincipios: ApiSubSubPrincipio[];
  notas: ApiNota[];
}

interface ApiPrincipio {
  id: string;
  gameMomentId: number;
  gameMomentName: string;
  key: string;
  numero: number;
  titulo: string;
  texto: string;
  subprincipios: ApiSubprincipio[];
  notas: ApiNota[];
}

interface ApiSetPieceRule {
  id: string;
  subtype: string;
  texto: string;
}

interface ApiOpenIssue {
  id: string;
  topic: string;
  description: string;
  status: string;
}

export type AssistantMessage = { role: "user" | "assistant"; content: string; kind?: "question" | "proposal" };

export type AssistantChange = {
  id: string;
  operation: "add" | "change" | "remove";
  nodeType: "principio" | "subprincipio" | "zona" | "subSubPrincipio" | "habilidad" | "nota" | "setPieceRule";
  address?: string;
  parentAddress?: string;
  parentChangeId?: string;
  fields: Record<string, unknown>;
};

export type AssistantReply = {
  kind: "question" | "proposal";
  message: string;
  changes: AssistantChange[];
  discardedCount: number;
  version: string;
};

/** A change as the backend serializes it: an optional member it does not have arrives as JSON null. */
type WireAssistantChange = Omit<AssistantChange, "address" | "parentAddress" | "parentChangeId"> & {
  address?: string | null;
  parentAddress?: string | null;
  parentChangeId?: string | null;
};

type WireAssistantReply = Omit<AssistantReply, "changes"> & { changes: WireAssistantChange[] };

/** Leaves out the optional members sent as null, so a member the change does not have is absent everywhere in the front. */
function normalizeAssistantChange(change: WireAssistantChange): AssistantChange {
  const { address, parentAddress, parentChangeId, ...rest } = change;
  return {
    ...rest,
    ...(typeof address === "string" ? { address } : {}),
    ...(typeof parentAddress === "string" ? { parentAddress } : {}),
    ...(typeof parentChangeId === "string" ? { parentChangeId } : {}),
  };
}

interface ApiGameModel {
  id: string;
  teamId: string;
  name: string;
  season: string;
  version: string;
  principles: ApiPrincipio[];
  setPieceRules: ApiSetPieceRule[];
  openIssues: ApiOpenIssue[];
}

interface ApiGameMoment {
  id: number;
  name: string;
  order: number;
}

interface ApiGameZone {
  id: number;
  name: string;
  order: number;
}

// ── Temp key counter (negative = unsaved) ────────────────────────────
let _keyCounter = -1;
const nextKey = () => _keyCounter--;

// ── Mapper: nested API → nested GameModel ──────────────────────────────

function mapNota(n: ApiNota): Nota {
  return { id: nextKey(), apiId: n.id, tipo: n.tipo as Nota["tipo"], texto: n.texto };
}

function mapHabilidad(h: ApiHabilidad): Habilidad {
  return {
    id: nextKey(),
    apiId: h.id,
    nombre: h.nombre,
    descripcion: h.descripcion,
    entrenable: h.entrenable,
    referenciaAKey: h.referenciaAKey ?? null,
  };
}

function mapSubSubPrincipio(ssp: ApiSubSubPrincipio): SubSubPrincipio {
  return {
    id: nextKey(),
    apiId: ssp.id,
    key: ssp.key,
    numero: ssp.numero,
    rol: ssp.rol,
    texto: ssp.texto,
    habilidades: ssp.habilidades.map(mapHabilidad),
    notas: ssp.notas.map(mapNota),
  };
}

function mapZona(z: ApiZona): Zona {
  return {
    id: nextKey(),
    apiId: z.id,
    key: z.key,
    zoneKeys: z.zoneKeysCsv.split(",").map((s) => s.trim()).filter(Boolean),
    label: z.label ?? null,
    zonaTexto: z.zonaTexto ?? null,
    texto: z.texto,
    subSubPrincipios: z.subSubPrincipios.map(mapSubSubPrincipio),
    notas: z.notas.map(mapNota),
  };
}

function mapSubprincipio(sp: ApiSubprincipio): Subprincipio {
  return {
    id: nextKey(),
    apiId: sp.id,
    key: sp.key,
    numero: sp.numero,
    titulo: sp.titulo,
    texto: sp.texto,
    zonas: sp.zonas.map(mapZona),
    subSubPrincipios: sp.subSubPrincipios.map(mapSubSubPrincipio),
    notas: sp.notas.map(mapNota),
  };
}

function mapPrincipio(p: ApiPrincipio): Principle {
  return {
    id: nextKey(),
    apiId: p.id,
    key: p.key,
    gameMomentId: p.gameMomentId,
    gameMomentName: p.gameMomentName,
    numero: p.numero,
    titulo: p.titulo,
    texto: p.texto,
    subprincipios: p.subprincipios.map(mapSubprincipio),
    notas: p.notas.map(mapNota),
  };
}

function mapSetPieceRule(s: ApiSetPieceRule): SetPieceRule {
  return { id: nextKey(), apiId: s.id, subtype: s.subtype, texto: s.texto };
}

function mapOpenIssue(o: ApiOpenIssue): OpenIssue {
  return { id: nextKey(), apiId: o.id, topic: o.topic, description: o.description, status: o.status };
}

function mapApiToGameModel(api: ApiGameModel): GameModel {
  return {
    id: api.id,
    teamId: api.teamId,
    name: api.name,
    season: api.season,
    version: api.version,
    principles: api.principles.map(mapPrincipio),
    setPieceRules: api.setPieceRules.map(mapSetPieceRule),
    openIssues: api.openIssues.map(mapOpenIssue),
  };
}

/** Surfaces a ProblemDetails response as an Error carrying the backend `code` and `status` at the top
 * level, so callers branch on `error.code` (e.g. GameModelStale, AiNoActiveProvider). The original
 * `response` stays on the error, so callers that read `response.data.detail` keep working. Any other
 * error is returned unchanged. */
function toServiceError(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("response" in error)) return error;
  const { response } = error as { response?: { status?: number; data?: unknown } };
  const problem = response?.data;
  if (typeof problem !== "object" || problem === null) return error;

  const { code, detail, title } = problem as { code?: string; detail?: string; title?: string };
  const serviceError = new Error(detail ?? title ?? "No se pudo completar la operación.") as Error & {
    code?: string;
    status?: number;
    response?: unknown;
  };
  serviceError.code = code;
  serviceError.status = response?.status;
  serviceError.response = response;
  return serviceError;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

// ── ADN options (Subprincipio/SubSubPrincipio pickers) ─────────────────
// Flattens the team's current GameModel tree (Principle → Subprincipio →
// (Zona 0..N | direct) → SubSubPrincipio) into flat option lists, consumed by
// both the SeasonPlan Microciclo session pickers and the Exercise
// ModelRelationSection (see design.md's Amendment 2).

function flattenGameModelToAdnOptions(model: GameModel | null): AdnOptions {
  if (!model) return { subprincipios: [], subSubPrincipios: [] };

  const subprincipios: AdnOptions["subprincipios"] = [];
  const subSubPrincipios: AdnSubSubPrincipioOption[] = [];

  for (const principle of model.principles) {
    for (const sp of principle.subprincipios) {
      const subprincipioId = sp.apiId;
      if (!subprincipioId) continue;

      subprincipios.push({
        id: subprincipioId,
        numero: sp.numero,
        titulo: sp.titulo,
        gameMomentName: principle.gameMomentName ?? "",
      });

      const nestedSubSubPrincipios = [...sp.subSubPrincipios, ...sp.zonas.flatMap((z) => z.subSubPrincipios)];
      for (const ssp of nestedSubSubPrincipios) {
        if (!ssp.apiId) continue;
        subSubPrincipios.push({ id: ssp.apiId, numero: ssp.numero, rol: ssp.rol, subprincipioId });
      }
    }
  }

  return { subprincipios, subSubPrincipios };
}

// ── Mapper: nested GameModel → nested API request ───────────────────────

function mapNotaRequest(n: Nota) {
  return { id: n.apiId ?? null, tipo: n.tipo, texto: n.texto };
}

function mapHabilidadRequest(h: Habilidad) {
  return {
    id: h.apiId ?? null,
    nombre: h.nombre,
    descripcion: h.descripcion,
    entrenable: h.entrenable,
    referenciaAKey: h.referenciaAKey ?? null,
  };
}

function mapSubSubPrincipioRequest(ssp: SubSubPrincipio) {
  return {
    id: ssp.apiId ?? null,
    numero: ssp.numero,
    rol: ssp.rol,
    texto: ssp.texto,
    habilidades: ssp.habilidades.map(mapHabilidadRequest),
    notas: ssp.notas.map(mapNotaRequest),
  };
}

function mapZonaRequest(z: Zona) {
  return {
    id: z.apiId ?? null,
    zoneKeysCsv: z.zoneKeys.join(","),
    label: z.label ?? null,
    zonaTexto: z.zonaTexto ?? null,
    texto: z.texto,
    subSubPrincipios: z.subSubPrincipios.map(mapSubSubPrincipioRequest),
    notas: z.notas.map(mapNotaRequest),
  };
}

function mapSubprincipioRequest(sp: Subprincipio) {
  return {
    id: sp.apiId ?? null,
    numero: sp.numero,
    titulo: sp.titulo,
    texto: sp.texto,
    zonas: sp.zonas.map(mapZonaRequest),
    subSubPrincipios: sp.subSubPrincipios.map(mapSubSubPrincipioRequest),
    notas: sp.notas.map(mapNotaRequest),
  };
}

function mapPrincipleRequest(p: Principle) {
  return {
    id: p.apiId ?? null,
    gameMomentId: p.gameMomentId,
    numero: p.numero,
    titulo: p.titulo,
    texto: p.texto,
    subprincipios: p.subprincipios.map(mapSubprincipioRequest),
    notas: p.notas.map(mapNotaRequest),
  };
}

function mapSetPieceRuleRequest(s: SetPieceRule) {
  return { id: s.apiId ?? null, subtype: s.subtype, texto: s.texto };
}

function mapOpenIssueRequest(o: OpenIssue) {
  return { id: o.apiId ?? null, topic: o.topic, description: o.description, status: o.status };
}

function mapModelToCreateRequest(model: GameModel) {
  return {
    teamId: model.teamId,
    name: model.name,
    season: model.season,
    principles: model.principles.map(mapPrincipleRequest),
    setPieceRules: model.setPieceRules.map(mapSetPieceRuleRequest),
    openIssues: model.openIssues.map(mapOpenIssueRequest),
  };
}

function mapModelToUpdateRequest(model: GameModel) {
  return {
    name: model.name,
    principles: model.principles.map(mapPrincipleRequest),
    setPieceRules: model.setPieceRules.map(mapSetPieceRuleRequest),
    openIssues: model.openIssues.map(mapOpenIssueRequest),
  };
}

// ── Cached catalog (loaded once per session) ─────────────────────────
let _momentsCache: GameMomentCatalogItem[] | null = null;
let _zonesCache: ApiGameZone[] | null = null;

async function getMoments(): Promise<GameMomentCatalogItem[]> {
  if (!_momentsCache || _momentsCache.length === 0) {
    const res = await client.get<ApiGameMoment[]>("/api/game-models/moments");
    _momentsCache = res.data;
  }
  return _momentsCache;
}

async function getZones(): Promise<ApiGameZone[]> {
  if (!_zonesCache || _zonesCache.length === 0) {
    const res = await client.get<ApiGameZone[]>("/api/game-models/zones");
    _zonesCache = res.data;
  }
  return _zonesCache;
}

// ── Service ───────────────────────────────────────────────────────────
const gameModelService = {
  async getMoments(): Promise<GameMomentCatalogItem[]> {
    return getMoments();
  },

  /** GameZone catalog (Iniciación/Creación Propia/Creación Rival/Finalización) — shared with SeasonPlan's Mesociclo.GameZoneId. */
  async getZones(): Promise<ApiGameZone[]> {
    return getZones();
  },

  async getSeasonsByTeamId(teamId: string): Promise<string[]> {
    const res = await client.get<string[]>("/api/game-models/seasons", {
      params: { teamId },
    });
    return res.data;
  },

  async getByTeamIdAndSeason(teamId: string, season: string): Promise<GameModel | null> {
    const res = await client.get<ApiGameModel>("/api/game-models", {
      params: { teamId, season },
    });
    return mapApiToGameModel(res.data);
  },

  async getEmptyDraft(teamId: string, season: string): Promise<GameModel> {
    return {
      id: "",
      teamId,
      season,
      name: `Modelo de Juego ${season}`,
      principles: [],
      setPieceRules: [],
      openIssues: [],
    };
  },

  async create(draft: GameModel): Promise<GameModel> {
    const res = await client.post<{ id: string }>("/api/game-models", mapModelToCreateRequest(draft));
    return { ...draft, id: res.data.id };
  },

  /** Saves the tree. With `expectedVersion`, the backend rejects a save made on a stale marker with
   * a GameModelStale error; without it the body carries no marker and the save is unconditional. */
  async update(draft: GameModel, options?: { expectedVersion?: string }): Promise<GameModel> {
    const body = {
      ...mapModelToUpdateRequest(draft),
      ...(options?.expectedVersion !== undefined ? { expectedVersion: options.expectedVersion } : {}),
    };
    try {
      await client.put(`/api/game-models/${draft.id}`, body);
    } catch (error) {
      throw toServiceError(error);
    }
    return draft;
  },

  /** One turn of the game-model assistant: the whole conversation goes out, nothing is stored. */
  async assistant(gameModelId: string, messages: AssistantMessage[]): Promise<AssistantReply> {
    try {
      const res = await client.post<WireAssistantReply>(`/api/game-models/${gameModelId}/assistant`, { messages });
      return { ...res.data, changes: res.data.changes.map(normalizeAssistantChange) };
    } catch (error) {
      throw toServiceError(error);
    }
  },

  async delete(id: string): Promise<void> {
    await client.delete(`/api/game-models/${id}`);
  },

  /** Flattened Subprincipio/SubSubPrincipio option lists for ADN pickers (SeasonPlan session
   * pickers, Exercise ModelRelationSection), sourced from the team's current GameModel for
   * that season (`season` matches GameModel's free-text Season label). Returns empty arrays
   * (not an error) when the team has no GameModel yet for that season. */
  async getAdnOptions(teamId: string, season: string): Promise<AdnOptions> {
    try {
      const model = await this.getByTeamIdAndSeason(teamId, season);
      return flattenGameModelToAdnOptions(model);
    } catch (error) {
      if (isNotFound(error)) return { subprincipios: [], subSubPrincipios: [] };
      throw error;
    }
  },

  /** Per-node coverage (Subprincipio/Principio "covered") and per-Sub-subprincipio usage
   * (which sessions target it) for the content-board's left panel — design.md Decision 5 of
   * `season-plan-content-board`. Response shape is already camelCase-flat, no nested mapping
   * needed (unlike GameModel's nested tree). */
  async getAdnCoverage(teamId: string, season: string): Promise<AdnCoverage> {
    const res = await client.get<AdnCoverage>("/api/game-models/adn-coverage", {
      params: { teamId, season },
    });
    return res.data;
  },
};

export default gameModelService;
