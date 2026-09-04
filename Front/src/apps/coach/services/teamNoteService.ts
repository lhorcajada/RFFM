import client from "../../../core/api/client";

export interface TeamNote {
  id: string;
  teamId: string;
  text: string;
  order: number;
}

export async function getTeamNotes(teamId: string): Promise<TeamNote[]> {
  const resp = await client.get<TeamNote[]>(`/api/teams/${encodeURIComponent(teamId)}/notes`);
  return resp.data;
}

export async function createTeamNote(teamId: string, text: string): Promise<TeamNote> {
  const resp = await client.post<TeamNote>(`/api/teams/${encodeURIComponent(teamId)}/notes`, { text });
  return resp.data;
}

export async function updateTeamNote(teamId: string, noteId: string, text: string): Promise<TeamNote> {
  const resp = await client.put<TeamNote>(
    `/api/teams/${encodeURIComponent(teamId)}/notes/${encodeURIComponent(noteId)}`,
    { text },
  );
  return resp.data;
}

export async function deleteTeamNote(teamId: string, noteId: string): Promise<void> {
  await client.delete(
    `/api/teams/${encodeURIComponent(teamId)}/notes/${encodeURIComponent(noteId)}`,
  );
}
