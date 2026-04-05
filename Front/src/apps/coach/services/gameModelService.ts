import { client } from "../../../core/api/client";
import type {
  GameModel,
  GameMoment,
  Zone,
  Scenario,
  SubPrinciple,
  SubSubPrinciple,
  TacticalPrinciple,
} from "../types/gameModel";

// ── API response types (flat structure from backend) ─────────────────

interface ApiTacticalPrinciple {
  id: number;
  name: string;
}

interface ApiEssentialSkill {
  id: string;
  name: string;
  description: string;
}

interface ApiSubSubPrinciple {
  id: string;
  order: number;
  name: string;
  action: string;
  essentialSkills: ApiEssentialSkill[];
}

interface ApiSubPrinciple {
  id: string;
  order: number;
  label: string;
  name: string;
  context: string;
  tacticalPrinciples: ApiTacticalPrinciple[];
  subSubPrinciples: ApiSubSubPrinciple[];
}

interface ApiScenario {
  id: string;
  gameMomentId: number;
  gameMomentName: string;
  gameZoneId: number;
  gameZoneName: string;
  order: number;
  name: string;
  context: string;
  tacticalPrinciples: ApiTacticalPrinciple[];
  subPrinciples: ApiSubPrinciple[];
}

interface ApiGameModel {
  id: string;
  teamId: string;
  name: string;
  season: string;
  scenarios: ApiScenario[];
}

interface ApiCatalogItem {
  id: number;
  name: string;
  order: number;
}

// ── Temp key counter (negative = unsaved) ────────────────────────────
let _keyCounter = -1;
const nextKey = () => _keyCounter--;

// ── Mapper: flat API → nested GameModel ──────────────────────────────
function mapApiToGameModel(
  api: ApiGameModel,
  allMoments: ApiCatalogItem[],
  allZones: ApiCatalogItem[]
): GameModel {
  // Index scenarios by moment → zone
  const scenariosByMomentZone = new Map<string, Scenario[]>();
  for (const s of api.scenarios) {
    const key = `${s.gameMomentId}:${s.gameZoneId}`;
    if (!scenariosByMomentZone.has(key)) scenariosByMomentZone.set(key, []);
    scenariosByMomentZone.get(key)!.push({
      id: nextKey(),
      order: s.order,
      name: s.name,
      context: s.context,
      tacticalPrinciples: s.tacticalPrinciples,
      subPrinciples: s.subPrinciples.map((sp) => ({
        id: nextKey(),
        order: sp.order,
        label: sp.label,
        name: sp.name,
        context: sp.context,
        tacticalPrinciples: sp.tacticalPrinciples,
        subSubPrinciples: sp.subSubPrinciples.map((ssp) => ({
          id: nextKey(),
          order: ssp.order,
          name: ssp.name,
          action: ssp.action,
          essentialSkills: ssp.essentialSkills.map((sk) => ({
            id: nextKey(),
            name: sk.name,
            description: sk.description,
          })),
        })),
      })),
    });
  }

  const gameMoments: GameMoment[] = allMoments.map((m) => ({
    id: m.id,
    name: m.name,
    zones: allZones.map((z) => ({
      id: z.id,
      name: z.name,
      scenarios: (scenariosByMomentZone.get(`${m.id}:${z.id}`) ?? []).sort(
        (a, b) => a.order - b.order
      ),
    })),
  }));

  return { id: api.id, teamId: api.teamId, name: api.name, season: api.season, gameMoments };
}

// ── Mapper: nested GameModel → flat API request ───────────────────────
function mapModelToRequest(model: GameModel) {
  const scenarios: object[] = [];
  for (const moment of model.gameMoments) {
    for (const zone of moment.zones) {
      for (const s of zone.scenarios) {
        scenarios.push({
          gameMomentId: moment.id,
          gameZoneId: zone.id,
          order: s.order,
          name: s.name,
          context: s.context,
          tacticalPrincipleIds: s.tacticalPrinciples.map((tp) => tp.id),
          subPrinciples: s.subPrinciples.map((sp) => ({
            label: sp.label,
            order: sp.order,
            name: sp.name,
            context: sp.context,
            tacticalPrincipleIds: sp.tacticalPrinciples.map((tp) => tp.id),
            subSubPrinciples: sp.subSubPrinciples.map((ssp) => ({
              order: ssp.order,
              name: ssp.name,
              action: ssp.action,
              essentialSkills: ssp.essentialSkills.map((sk) => ({
                name: sk.name,
                description: sk.description,
              })),
            })),
          })),
        });
      }
    }
  }
  return { teamId: model.teamId, name: model.name, season: model.season, scenarios };
}

// ── Empty draft builder ───────────────────────────────────────────────
function buildEmptyDraft(
  teamId: string,
  season: string,
  moments: ApiCatalogItem[],
  zones: ApiCatalogItem[]
): GameModel {
  return {
    id: "",
    teamId,
    name: `Modelo de Juego ${season}`,
    season,
    gameMoments: moments.map((m) => ({
      id: m.id,
      name: m.name,
      zones: zones.map((z) => ({ id: z.id, name: z.name, scenarios: [] })),
    })),
  };
}

// ── Cached catalog (loaded once per session) ─────────────────────────
let _momentsCache: ApiCatalogItem[] | null = null;
let _zonesCache: ApiCatalogItem[] | null = null;

async function getCatalog(): Promise<[ApiCatalogItem[], ApiCatalogItem[]]> {
  if (!_momentsCache || !_zonesCache || _momentsCache.length === 0 || _zonesCache.length === 0) {
    const [mRes, zRes] = await Promise.all([
      client.get<ApiCatalogItem[]>("/api/game-models/moments"),
      client.get<ApiCatalogItem[]>("/api/game-models/zones"),
    ]);
    _momentsCache = mRes.data;
    _zonesCache = zRes.data;
  }
  return [_momentsCache, _zonesCache];
}

// ── Service ───────────────────────────────────────────────────────────
const gameModelService = {
  async getSeasonsByTeamId(teamId: string): Promise<string[]> {
    const res = await client.get<string[]>("/api/game-models/seasons", {
      params: { teamId },
    });
    return res.data;
  },

  async getByTeamIdAndSeason(teamId: string, season: string): Promise<GameModel | null> {
    const [moments, zones] = await getCatalog();
    const res = await client.get<ApiGameModel>("/api/game-models", {
      params: { teamId, season },
    });
    return mapApiToGameModel(res.data, moments, zones);
  },

  async getAvailableTacticalPrinciples(): Promise<TacticalPrinciple[]> {
    const res = await client.get<ApiTacticalPrinciple[]>("/api/technical-goals");
    return res.data;
  },

  async getEmptyDraft(teamId: string, season: string): Promise<GameModel> {
    const [moments, zones] = await getCatalog();
    return buildEmptyDraft(teamId, season, moments, zones);
  },

  async create(draft: GameModel): Promise<GameModel> {
    const res = await client.post<{ id: string }>("/api/game-models", mapModelToRequest(draft));
    return { ...draft, id: res.data.id };
  },

  async update(draft: GameModel): Promise<GameModel> {
    const { teamId: _, season: __, ...body } = mapModelToRequest(draft) as {
      teamId: string;
      season: string;
      name: string;
      scenarios: object[];
    };
    await client.put(`/api/game-models/${draft.id}`, { name: body.name, scenarios: body.scenarios });
    return draft;
  },
};

export default gameModelService;

