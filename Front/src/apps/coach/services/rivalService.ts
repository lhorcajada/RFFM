import client from "../../../core/api/client";

export type Rival = {
  id: string;
  name: string;
  urlPhoto?: string | null;
  category?: string | null;
};

export async function getRivals(): Promise<Rival[]> {
  const res = await client.get("/api/rivals");
  return res.data ?? [];
}

export async function createRival(payload: { Name: string; UrlPhoto?: string | null; Category?: string | null }) {
  const res = await client.post("/api/rivals", payload);
  return res.data;
}

export async function updateRival(id: string, payload: { Name: string; UrlPhoto?: string | null; Category?: string | null }) {
  const res = await client.put(`/api/rivals/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteRival(id: string) {
  const res = await client.delete(`/api/rivals/${encodeURIComponent(id)}`);
  return res;
}

export async function uploadRivalPhoto(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await client.post(`/api/rivals/photo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { url?: string; Url?: string; UrlPhoto?: string } | any;
}

export default { getRivals, createRival, updateRival, deleteRival, uploadRivalPhoto };
