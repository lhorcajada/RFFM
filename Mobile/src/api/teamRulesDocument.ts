import { File, Paths } from 'expo-file-system';
import { api } from './client';

export interface UploadTeamRulesDocumentResult {
  url: string;
  uploadedAt: string;
}

export const getTeamRulesDocument = async (teamId: string): Promise<{ localUri: string } | null> => {
  const response = await api.get(`/api/mobile/teams/${teamId}/rules-document`, {
    responseType: 'arraybuffer',
    validateStatus: (status) => status === 200 || status === 204,
  });

  if (response.status === 204) {
    return null;
  }

  const bytes = new Uint8Array(response.data as ArrayBuffer);
  const file = new File(Paths.cache, `team-rules-${teamId}.pdf`);

  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);

  return { localUri: file.uri };
};

export const uploadTeamRulesDocument = async (
  teamId: string,
  fileUri: string,
  fileName: string,
): Promise<UploadTeamRulesDocumentResult> => {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: 'application/pdf',
  } as any);

  const response = await api.post(`/api/mobile/teams/${teamId}/rules-document`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return { url: response.data.url, uploadedAt: response.data.uploadedAt };
};
