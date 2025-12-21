import client from "../../../core/api/client";
import type { Player } from "../types/player";

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
export default { fetchPlayerPhoto, getPlayerById, uploadPlayerPhoto };
