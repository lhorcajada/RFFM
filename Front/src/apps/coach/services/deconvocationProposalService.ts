import client from "../../../core/api/client";

/** A candidate deconvocation proposal of a match: the players who would be left out, in order. */
export type SavedProposal = {
  id: string;
  name: string;
  teamPlayerIds: string[];
  createdOn: string;
};

const url = (eventId: string) => `/api/events/${encodeURIComponent(eventId)}/deconvocation-proposals`;

export async function getSavedProposals(eventId: string): Promise<SavedProposal[]> {
  const res = await client.get<{ items: SavedProposal[] }>(url(eventId));
  return res.data.items;
}

export async function saveProposal(eventId: string, name: string, teamPlayerIds: string[]): Promise<SavedProposal> {
  const res = await client.post<SavedProposal>(url(eventId), { name, teamPlayerIds });
  return res.data;
}

export async function deleteSavedProposal(eventId: string, proposalId: string): Promise<void> {
  await client.delete(`${url(eventId)}/${encodeURIComponent(proposalId)}`);
}
