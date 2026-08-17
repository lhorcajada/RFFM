import { client } from "../../../core/api/client";
import gameModelService from "./gameModelService";
import type { AdnOptions, AdnSubSubPrincipioOption, Macrociclo, Mesociclo, Microciclo, SeasonPlan } from "../types/seasonPlan";
import type { GameModel } from "../types/gameModel";

// ── API response types (nested structure from backend — camelCase over the wire) ──

interface ApiAdnSubprincipioSummary {
  id: string;
  numero: string;
  titulo: string;
  gameMomentName: string;
}

interface ApiAdnSubSubPrincipioSummary {
  id: string;
  numero: string;
  rol: string;
}

interface ApiMicrociclo {
  id: string;
  order: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  objetivoSesionA: string;
  objetivoSesionB: string;
  exerciseCount: number;
  sesionASubprincipios: ApiAdnSubprincipioSummary[];
  sesionASubSubPrincipios: ApiAdnSubSubPrincipioSummary[];
  sesionAHabilidades: string[];
  sesionBSubprincipios: ApiAdnSubprincipioSummary[];
  sesionBSubSubPrincipios: ApiAdnSubSubPrincipioSummary[];
  sesionBHabilidades: string[];
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

function mapMicrociclo(m: ApiMicrociclo): Microciclo {
  return {
    id: nextKey(),
    apiId: m.id,
    order: m.order,
    weekLabel: m.weekLabel,
    startDate: m.startDate,
    endDate: m.endDate,
    objetivoSesionA: m.objetivoSesionA,
    objetivoSesionB: m.objetivoSesionB,
    exerciseCount: m.exerciseCount,
    sesionASubprincipioIds: (m.sesionASubprincipios ?? []).map((s) => s.id),
    sesionASubSubPrincipioIds: (m.sesionASubSubPrincipios ?? []).map((s) => s.id),
    sesionAHabilidades: m.sesionAHabilidades ?? [],
    sesionASubprincipios: m.sesionASubprincipios ?? [],
    sesionASubSubPrincipios: m.sesionASubSubPrincipios ?? [],
    sesionBSubprincipioIds: (m.sesionBSubprincipios ?? []).map((s) => s.id),
    sesionBSubSubPrincipioIds: (m.sesionBSubSubPrincipios ?? []).map((s) => s.id),
    sesionBHabilidades: m.sesionBHabilidades ?? [],
    sesionBSubprincipios: m.sesionBSubprincipios ?? [],
    sesionBSubSubPrincipios: m.sesionBSubSubPrincipios ?? [],
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
    objetivoSesionA: m.objetivoSesionA,
    objetivoSesionB: m.objetivoSesionB,
    sesionASubprincipioIds: m.sesionASubprincipioIds,
    sesionASubSubPrincipioIds: m.sesionASubSubPrincipioIds,
    sesionAHabilidades: m.sesionAHabilidades,
    sesionBSubprincipioIds: m.sesionBSubprincipioIds,
    sesionBSubSubPrincipioIds: m.sesionBSubSubPrincipioIds,
    sesionBHabilidades: m.sesionBHabilidades,
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
    objetivoSesionA: m.objetivoSesionA,
    objetivoSesionB: m.objetivoSesionB,
    sesionASubprincipioIds: m.sesionASubprincipioIds,
    sesionASubSubPrincipioIds: m.sesionASubSubPrincipioIds,
    sesionAHabilidades: m.sesionAHabilidades,
    sesionBSubprincipioIds: m.sesionBSubprincipioIds,
    sesionBSubSubPrincipioIds: m.sesionBSubSubPrincipioIds,
    sesionBHabilidades: m.sesionBHabilidades,
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

// ── ADN options (Subprincipio/SubSubPrincipio pickers) ─────────────────
// Flattens the team's current GameModel tree (Principle → Subprincipio →
// (Zona 0..N | direct) → SubSubPrincipio) into flat option lists for the
// Microciclo session pickers. Reuses gameModelService's fetch rather than a
// dedicated backend endpoint (see design.md's Amendment section).

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
   * has no GameModel yet for that season. */
  async getAdnOptions(teamId: string, season: string): Promise<AdnOptions> {
    try {
      const model = await gameModelService.getByTeamIdAndSeason(teamId, season);
      return flattenGameModelToAdnOptions(model);
    } catch (error) {
      if (isNotFound(error)) return { subprincipios: [], subSubPrincipios: [] };
      throw error;
    }
  },
};

export default seasonPlanService;
