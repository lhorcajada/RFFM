import client from "../../../core/api/client";
import type { SeasonPrepSessionData } from "./seasonPrepSessionService";

export async function getSeasonPrepAllTeams(sportEventId?: string | null): Promise<SeasonPrepSessionData | null> {
  const params = sportEventId ? { sportEventId } : undefined;
  const response = await client.get<{ data: string; updatedAt: string }>("/api/season-prep/all-teams", { params });
  if (response.status === 204 || !response.data?.data) return null;
  try {
    return JSON.parse(response.data.data) as SeasonPrepSessionData;
  } catch {
    return null;
  }
}

export async function upsertSeasonPrepAllTeams(state: SeasonPrepSessionData): Promise<void> {
  await client.put("/api/season-prep/all-teams", {
    data: JSON.stringify(state),
    sportEventId: state.sportEventId ?? null,
  });
}

export async function exportSeasonPrepAllTeams(state: SeasonPrepSessionData, options?: { templateMode?: boolean; clubName?: string; clubLogoBase64?: string; saveBeforeExport?: boolean; }) : Promise<Blob> {
  const payload = {
    Data: JSON.stringify(state),
    SportEventId: state.sportEventId ?? null,
    SaveBeforeExport: options?.saveBeforeExport ?? true,
    TemplateMode: options?.templateMode ?? false,
    ClubName: options?.clubName ?? null,
    ClubLogoBase64: options?.clubLogoBase64 ?? null,
  } as any;

  const resp = await client.post("/api/season-prep/export", payload, { responseType: "blob" as const });
  return resp.data as Blob;
}

export async function deleteSeasonPrepAllTeams(sportEventId?: string | null): Promise<void> {
  await client.delete("/api/season-prep/all-teams", {
    params: sportEventId ? { sportEventId } : undefined,
  });
}
