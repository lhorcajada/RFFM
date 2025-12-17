import client from "../../../core/api/client";
import type { UserClubsApiResponse } from "../types/userClubs";
import type { ClubResponse } from "../types/club";

export async function getUserClubs(
  token?: string
): Promise<UserClubsApiResponse> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const config = Object.keys(headers).length ? { headers } : undefined;

  const resp = await client.get<UserClubsApiResponse>(
    "/api/catalog/user-clubs",
    config as any
  );
  return resp.data ?? [];
}

export async function getClubById(id: string): Promise<ClubResponse | null> {
  if (!id) throw new Error("id is required");
  const resp = await client.get<ClubResponse>(`/api/catalog/club/${id}`);
  return resp.data ?? null;
}

export async function getClubEmblem(
  id: string
): Promise<{ data: ArrayBuffer | null; contentType?: string | null }> {
  if (!id) throw new Error("id is required");
  const resp = await client.get<ArrayBuffer>(`/api/catalog/club/${id}/emblem`, {
    responseType: "arraybuffer",
  } as any);

  const contentType =
    (resp && (resp as any).headers && (resp as any).headers["content-type"]) ||
    null;
  return { data: resp.data ?? null, contentType };
}

export async function createClub(payload: { name: string; countryId: number }) {
  const resp = await client.post("/api/catalog/club", payload);
  return resp.data;
}

export async function createClubMultipart(payload: {
  name: string;
  countryCode: string;
  roleId: number;
  emblem?: File | null;
}) {
  const form = new FormData();
  form.append("Name", payload.name);
  form.append("CountryCode", payload.countryCode);
  form.append("RoleId", String(payload.roleId));
  if (payload.emblem) {
    form.append("Emblem", payload.emblem);
  }

  const resp = await client.post(`/api/catalog/club`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  } as any);
  return resp.data;
}

export async function uploadClubEmblem(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const resp = await client.post(`/api/catalog/club/${id}/emblem`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  } as any);
  return resp.data;
}

export default {
  getUserClubs,
  getClubById,
  getClubEmblem,
  createClub,
  createClubMultipart,
  uploadClubEmblem,
};
