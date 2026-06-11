import client from "../../../core/api/client";
import type { Player } from "../types/player";

export type ClubPlayersResponse = {
  playerModel: Player;
};

export type CreatePlayerPayload = {
  name: string;
  lastName?: string | null;
  alias: string;
  clubId: string;
  birthDate?: string | null;
  dni?: string | null;
  photoFile?: File | null;
};

export async function fetchPlayerPhoto(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await client.get(`/api/catalog/player/photo`, {
      params: { url },
      responseType: "blob",
    } as any);
    const blob = resp.data as Blob;
    return URL.createObjectURL(blob);
  } catch (e) {
    return null;
  }
}
export async function getPlayerById(id: string): Promise<Player | null> {
  if (!id) return null;
  try {
    const resp = await client.get(`/api/catalog/player/${id}`);
    return resp.data as Player;
  } catch (e) {
    return null;
  }
}

export async function getPlayersByClub(clubId: string): Promise<Player[]> {
  if (!clubId) return [];
  try {
    const resp = await client.get<ClubPlayersResponse[]>(
      `/api/catalog/players/${encodeURIComponent(clubId)}`
    );
    return (resp.data ?? []).map((item) => item.playerModel);
  } catch (e) {
    return [];
  }
}

export async function createPlayer(payload: CreatePlayerPayload): Promise<void> {
  if (!payload.clubId) throw new Error("clubId is required");
  if (!payload.name?.trim()) throw new Error("name is required");
  if (!payload.alias?.trim()) throw new Error("alias is required");

  const form = new FormData();
  form.append("Name", payload.name.trim());
  form.append("Alias", payload.alias.trim());
  form.append("ClubId", payload.clubId);

  if (payload.lastName?.trim()) form.append("LastName", payload.lastName.trim());
  if (payload.birthDate) form.append("BirthDate", payload.birthDate);
  if (payload.dni?.trim()) form.append("Dni", payload.dni.trim());
  if (payload.photoFile) form.append("PhotoFile", payload.photoFile, payload.photoFile.name);

  await client.post("/api/catalog/player", form, {
    headers: { "Content-Type": "multipart/form-data" },
  } as any);
}

export async function uploadPlayerPhoto(file: File): Promise<string | null> {
  if (!file) return null;
  try {
    const form = new FormData();
    form.append("file", file, file.name);
    const resp = await client.post(`/api/catalog/player/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    } as any);
    return resp?.data?.url ?? null;
  } catch (e) {
    return null;
  }
}
export default { fetchPlayerPhoto, getPlayerById, getPlayersByClub, createPlayer, uploadPlayerPhoto };
