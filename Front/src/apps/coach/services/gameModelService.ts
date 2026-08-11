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

interface ApiGameModel {
  id: string;
  teamId: string;
  name: string;
  season: string;
  principles: ApiPrincipio[];
  setPieceRules: ApiSetPieceRule[];
  openIssues: ApiOpenIssue[];
}

interface ApiGameMoment {
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
    principles: api.principles.map(mapPrincipio),
    setPieceRules: api.setPieceRules.map(mapSetPieceRule),
    openIssues: api.openIssues.map(mapOpenIssue),
  };
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

async function getMoments(): Promise<GameMomentCatalogItem[]> {
  if (!_momentsCache || _momentsCache.length === 0) {
    const res = await client.get<ApiGameMoment[]>("/api/game-models/moments");
    _momentsCache = res.data;
  }
  return _momentsCache;
}

// ── Service ───────────────────────────────────────────────────────────
const gameModelService = {
  async getMoments(): Promise<GameMomentCatalogItem[]> {
    return getMoments();
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

  async update(draft: GameModel): Promise<GameModel> {
    await client.put(`/api/game-models/${draft.id}`, mapModelToUpdateRequest(draft));
    return draft;
  },

  async delete(id: string): Promise<void> {
    await client.delete(`/api/game-models/${id}`);
  },
};

export default gameModelService;
