import { client } from "../../../core/api/client";
import gameModelService from "./gameModelService";
import type { AdnOptions, Macrociclo, Mesociclo, Microciclo, SeasonPlan } from "../types/seasonPlan";

// ── API response types (nested structure from backend — camelCase over the wire) ──

interface ApiSessionSummary {
  id: string;
  name: string;
  objetivoGeneral?: string | null;
  date: string;
  exerciseCount: number;
}

interface ApiMicrociclo {
  id: string;
  order: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  sessions: ApiSessionSummary[];
}

interface ApiMesociclo {
  id: string;
  order: number;
  name: string;
  startDate: string;
  endDate: string;
  gameZoneId: number;
  microciclos: ApiMicrociclo[];
}

interface ApiMacrociclo {
  id: string;
  order: number;
  name: string;
  startDate: string;
  endDate: string;
  mesociclos: ApiMesociclo[];
}

interface ApiSeasonPlan {
  id: string;
  teamId: string;
  seasonId: string;
  macrociclos: ApiMacrociclo[];
}

// ── Temp key counter (negative = unsaved) ────────────────────────────
let _keyCounter = -1;
const nextKey = () => _keyCounter--;

// ── Mapper: nested API → nested SeasonPlan ──────────────────────────

function mapSessionSummary(s: ApiSessionSummary) {
  return {
    id: s.id,
    name: s.name,
    objetivoGeneral: s.objetivoGeneral ?? null,
    date: s.date,
    exerciseCount: s.exerciseCount,
  };
}

function mapMicrociclo(m: ApiMicrociclo): Microciclo {
  return {
    id: nextKey(),
    apiId: m.id,
    order: m.order,
    weekLabel: m.weekLabel,
    startDate: m.startDate,
    endDate: m.endDate,
    sessions: (m.sessions ?? []).map(mapSessionSummary),
  };
}

function mapMesociclo(m: ApiMesociclo): Mesociclo {
  return {
    id: nextKey(),
    apiId: m.id,
    order: m.order,
    name: m.name,
    startDate: m.startDate,
    endDate: m.endDate,
    gameZoneId: m.gameZoneId,
    microciclos: m.microciclos.map(mapMicrociclo),
  };
}

function mapMacrociclo(m: ApiMacrociclo): Macrociclo {
  return {
    id: nextKey(),
    apiId: m.id,
    order: m.order,
    name: m.name,
    startDate: m.startDate,
    endDate: m.endDate,
    mesociclos: m.mesociclos.map(mapMesociclo),
  };
}

function mapApiToSeasonPlan(api: ApiSeasonPlan): SeasonPlan {
  return {
    id: api.id,
    teamId: api.teamId,
    seasonId: api.seasonId,
    macrociclos: api.macrociclos.map(mapMacrociclo),
  };
}

// ── Mapper: nested SeasonPlan → nested API request ───────────────────

function mapMicrocicloCreateRequest(m: Microciclo) {
  return {
    order: m.order,
    weekLabel: m.weekLabel,
    startDate: m.startDate,
    endDate: m.endDate,
  };
}

function mapMesocicloCreateRequest(m: Mesociclo) {
  return {
    order: m.order,
    name: m.name,
    startDate: m.startDate,
    endDate: m.endDate,
    gameZoneId: m.gameZoneId,
    microciclos: m.microciclos.map(mapMicrocicloCreateRequest),
  };
}

function mapMacrocicloCreateRequest(m: Macrociclo) {
  return {
    order: m.order,
    name: m.name,
    startDate: m.startDate,
    endDate: m.endDate,
    mesociclos: m.mesociclos.map(mapMesocicloCreateRequest),
  };
}

function mapMicrocicloUpdateRequest(m: Microciclo) {
  return {
    id: m.apiId ?? null,
    weekLabel: m.weekLabel,
    startDate: m.startDate,
    endDate: m.endDate,
  };
}

function mapMesocicloUpdateRequest(m: Mesociclo) {
  return {
    id: m.apiId ?? null,
    name: m.name,
    startDate: m.startDate,
    endDate: m.endDate,
    gameZoneId: m.gameZoneId,
    microciclos: m.microciclos.map(mapMicrocicloUpdateRequest),
  };
}

function mapMacrocicloUpdateRequest(m: Macrociclo) {
  return {
    id: m.apiId ?? null,
    name: m.name,
    startDate: m.startDate,
    endDate: m.endDate,
    mesociclos: m.mesociclos.map(mapMesocicloUpdateRequest),
  };
}

function mapPlanToCreateRequest(plan: SeasonPlan) {
  return {
    teamId: plan.teamId,
    seasonId: plan.seasonId,
    macrociclos: plan.macrociclos.map(mapMacrocicloCreateRequest),
  };
}

function mapPlanToUpdateRequest(plan: SeasonPlan) {
  return {
    macrociclos: plan.macrociclos.map(mapMacrocicloUpdateRequest),
  };
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

// ── Service ───────────────────────────────────────────────────────────
const seasonPlanService = {
  async getByTeamIdAndSeason(teamId: string, seasonId: string): Promise<SeasonPlan | null> {
    try {
      const res = await client.get<ApiSeasonPlan>("/api/season-plans", {
        params: { teamId, seasonId },
      });
      return mapApiToSeasonPlan(res.data);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  async getEmptyDraft(teamId: string, seasonId: string): Promise<SeasonPlan> {
    return { id: "", teamId, seasonId, macrociclos: [] };
  },

  async create(draft: SeasonPlan): Promise<SeasonPlan> {
    const res = await client.post<{ id: string }>("/api/season-plans", mapPlanToCreateRequest(draft));
    return { ...draft, id: res.data.id };
  },

  async update(draft: SeasonPlan): Promise<SeasonPlan> {
    await client.put(`/api/season-plans/${draft.id}`, mapPlanToUpdateRequest(draft));
    return draft;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/api/season-plans/${id}`);
  },

  /** Flattened Subprincipio/SubSubPrincipio option lists for the session pickers, sourced
   * from the team's current GameModel for that season (`season` here matches GameModel's
   * free-text Season label — see `gameModelService.getByTeamIdAndSeason` — not SeasonPlan's
   * `seasonId` FK; callers must resolve/pass the right one, same as `GameModelCreate.tsx`
   * does via `season.name ?? season.id`). Returns empty arrays (not an error) when the team
   * has no GameModel yet for that season. Delegates to `gameModelService.getAdnOptions`
   * (the canonical implementation, shared with the Exercise ModelRelationSection). */
  async getAdnOptions(teamId: string, season: string): Promise<AdnOptions> {
    return gameModelService.getAdnOptions(teamId, season);
  },
};

export default seasonPlanService;
