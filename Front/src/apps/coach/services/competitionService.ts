import client from "../../../core/api/client";
import type { AxiosResponse } from "axios";

export type Category = { id: number; name: string };
export type League = { id: number; name: string; group?: number | null };

type RawCategory = {
  id?: number;
  categoryId?: number;
  codigo?: number;
  codigo_categoria?: number;
  name?: string;
  nombre?: string;
  descripcion?: string;
};
type RawLeague = {
  id?: number;
  leagueId?: number;
  codigo?: number;
  codigo_liga?: number;
  name?: string;
  nombre?: string;
  descripcion?: string;
  group?: number;
  grupo?: number;
};

function isItemsContainer<T>(v: unknown): v is { items: T[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as any).items);
}

export async function getCategories(): Promise<Category[]> {
  const resp: AxiosResponse<RawCategory[] | { items: RawCategory[] }> =
    await client.get(`/api/catalog/categories`);
  const payload = resp.data;
  let data: RawCategory[] = [];
  if (Array.isArray(payload)) data = payload;
  else if (isItemsContainer<RawCategory>(payload)) data = payload.items;

  return (data || []).map((d) => ({
    id: Number(
      d.id ?? d.categoryId ?? d.codigo ?? d.codigo_categoria ?? d.codigo
    ),
    name: d.name ?? d.nombre ?? d.descripcion ?? String(d.id ?? d.categoryId),
  }));
}

export async function getLeagues(
  categoryId: number | string
): Promise<League[]> {
  if (categoryId === undefined || categoryId === null) return [];
  const resp: AxiosResponse<RawLeague[] | { items: RawLeague[] }> =
    await client.get(`/api/catalog/leagues/${categoryId}`);
  const payload = resp.data;
  let data: RawLeague[] = [];
  if (Array.isArray(payload)) data = payload;
  else if (isItemsContainer<RawLeague>(payload)) data = payload.items;

  return (data || []).map((d) => ({
    id: Number(d.id ?? d.leagueId ?? d.codigo ?? d.codigo_liga ?? d.codigo),
    name: d.name ?? d.nombre ?? d.descripcion ?? String(d.id ?? d.leagueId),
    group: d.group ?? d.grupo ?? null,
  }));
}

export default { getCategories, getLeagues };
