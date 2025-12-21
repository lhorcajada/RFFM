import client from "../../../core/api/client";
import seasonService from "./seasonService";

export type TeamResponse = {
  id: string;
  name: string;
  category: { id: number; name: string };
  league: { id?: number | null; name?: string | null; group?: number | null };
  club: {
    id: string;
    name: string;
    country: { id: number; name: string; code: string };
    shieldUrl?: string | null;
  };
  urlPhoto?: string | null;
};

export async function getTeams(clubId: string): Promise<TeamResponse[]> {
  if (!clubId) throw new Error("clubId is required");
  const resp = await client.get<TeamResponse[]>(`/api/catalog/teams`, {
    params: { clubId },
  } as any);
  return resp.data ?? [];
}

export async function createTeam(
  clubId: string,
  payload: {
    name: string;
    categoryId: number;
    leagueId?: number | null;
    photo?: File | null;
  }
) {
  if (!clubId) throw new Error("clubId is required");
  const form = new FormData();
  form.append("Name", payload.name);
  form.append("CategoryId", String(payload.categoryId));
  if (typeof payload.leagueId !== "undefined" && payload.leagueId !== null) {
    form.append("LeagueId", String(payload.leagueId));
  }
  form.append("ClubId", clubId);
  if (payload.photo) form.append("Photo", payload.photo);
  // backend expects multipart/form-data with field names matching CreateTeamCommand
  // use key 'PhotoFile' to match the server property name
  if (payload.photo) {
    form.delete("Photo");
    form.append("PhotoFile", payload.photo);
  }
  const activeSeason = await seasonService.getActiveSeason();
  if (activeSeason?.id) form.append("SeasonId", activeSeason.id);
  const resp = await client.post(`/api/catalog/team`, form as any);
  return resp.data;
}

export async function uploadTeamPhoto(file: File) {
  const form = new FormData();
  form.append("file", file);
  const resp = await client.post(`/api/catalog/team/photo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  } as any);
  return resp.data;
}
export async function fetchTeamPhoto(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await client.get(`/api/catalog/team/photo`, {
      params: { url },
      responseType: "blob",
    } as any);
    const blob = resp.data as Blob;
    const objectUrl = URL.createObjectURL(blob);
    return objectUrl;
  } catch (e) {
    return null;
  }
}
export async function getTeamById(
  teamId: string
): Promise<TeamResponse | null> {
  if (!teamId) throw new Error("teamId is required");
  try {
    const resp = await client.get<TeamResponse>(
      `/api/catalog/team/${encodeURIComponent(teamId)}` as any
    );
    return resp.data ?? null;
  } catch (e) {
    return null;
  }
}
export default {
  getTeams,
  createTeam,
  uploadTeamPhoto,
  fetchTeamPhoto,
  getTeamById,
};
