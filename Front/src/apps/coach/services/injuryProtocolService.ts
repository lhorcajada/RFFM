import client from "../../../core/api/client";

export type InjuryProtocolAttachment = {
  id: string;
  fileName: string;
  url: string;
  uploadedAt: string;
};

export type InjuryProtocolResponse = {
  teamId: string;
  content: string | null;
  updatedAt: string | null;
  attachments: InjuryProtocolAttachment[];
};

export async function getInjuryProtocol(
  teamId: string
): Promise<InjuryProtocolResponse | null> {
  try {
    const resp = await client.get<InjuryProtocolResponse>(
      `/api/catalog/team/${encodeURIComponent(teamId)}/injury-protocol`
    );
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export async function updateInjuryProtocol(
  teamId: string,
  content: string
): Promise<InjuryProtocolResponse> {
  const resp = await client.put<InjuryProtocolResponse>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/injury-protocol`,
    { content }
  );
  return resp.data;
}

export async function deleteInjuryProtocol(teamId: string): Promise<void> {
  await client.delete(`/api/catalog/team/${encodeURIComponent(teamId)}/injury-protocol`);
}

export async function uploadInjuryProtocolAttachment(
  teamId: string,
  file: File
): Promise<InjuryProtocolAttachment> {
  const form = new FormData();
  form.append("file", file, file.name);
  const resp = await client.post<InjuryProtocolAttachment>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/injury-protocol/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return resp.data;
}

export async function deleteInjuryProtocolAttachment(
  teamId: string,
  attachmentId: string
): Promise<void> {
  await client.delete(
    `/api/catalog/team/${encodeURIComponent(teamId)}/injury-protocol/attachments/${encodeURIComponent(
      attachmentId
    )}`
  );
}

export default {
  getInjuryProtocol,
  updateInjuryProtocol,
  deleteInjuryProtocol,
  uploadInjuryProtocolAttachment,
  deleteInjuryProtocolAttachment,
};
