import client from "../../../core/api/client";
import type { TraitPhase } from "../pages/squad/rating/ratingTraits";
import type { CategoryKey } from "../types/playerRating";
import type { CapacityConfigRow, RatingConfig, SheetKind, TraitConfigRow } from "../types/ratingConfig";

const configUrl = (teamId: string) => `/api/catalog/team/${teamId}/rating-config`;

export async function getRatingConfig(teamId: string): Promise<RatingConfig> {
  const resp = await client.get(configUrl(teamId));
  return resp.data as RatingConfig;
}

// ── Rasgos ──────────────────────────────────────────────────────────────────

export type CreateTraitPayload = {
  label: string;
  phase: TraitPhase;
  anchor1: string;
  anchor3: string;
  anchor5: string;
};

export type UpdateTraitPayload = Partial<CreateTraitPayload>;

export async function createTrait(teamId: string, payload: CreateTraitPayload): Promise<TraitConfigRow> {
  const resp = await client.post(`${configUrl(teamId)}/traits`, payload);
  return resp.data as TraitConfigRow;
}

export async function updateTrait(teamId: string, key: string, payload: UpdateTraitPayload): Promise<TraitConfigRow> {
  const resp = await client.put(`${configUrl(teamId)}/traits/${encodeURIComponent(key)}`, payload);
  return resp.data as TraitConfigRow;
}

export async function setTraitVisibility(teamId: string, key: string, hidden: boolean): Promise<TraitConfigRow> {
  const resp = await client.put(`${configUrl(teamId)}/traits/${encodeURIComponent(key)}/visibility`, { hidden });
  return resp.data as TraitConfigRow;
}

// ── Capacidades ─────────────────────────────────────────────────────────────

export type CreateCapacityPayload = {
  sheet: SheetKind;
  categoryKey: CategoryKey;
  label: string;
  levelTexts: string[];
};

/** Sobre una capacidad por defecto hay que enviar su hoja y su categoría: el servidor no conoce los textos por defecto. */
export type UpdateCapacityPayload = {
  label?: string;
  levelTexts?: string[];
  sheet?: SheetKind;
  categoryKey?: CategoryKey;
};

export async function createCapacity(teamId: string, payload: CreateCapacityPayload): Promise<CapacityConfigRow> {
  const resp = await client.post(`${configUrl(teamId)}/capacities`, payload);
  return resp.data as CapacityConfigRow;
}

export async function updateCapacity(teamId: string, key: string, payload: UpdateCapacityPayload): Promise<CapacityConfigRow> {
  const resp = await client.put(`${configUrl(teamId)}/capacities/${encodeURIComponent(key)}`, payload);
  return resp.data as CapacityConfigRow;
}

export async function setCapacityVisibility(
  teamId: string,
  key: string,
  hidden: boolean,
  location?: { sheet: SheetKind; categoryKey: CategoryKey },
): Promise<CapacityConfigRow> {
  const resp = await client.put(`${configUrl(teamId)}/capacities/${encodeURIComponent(key)}/visibility`, {
    hidden,
    ...location,
  });
  return resp.data as CapacityConfigRow;
}
