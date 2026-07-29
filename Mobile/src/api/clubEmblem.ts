import { api } from './client';
import { encodeBase64 } from '../utils/base64';

export const fetchClubEmblemDataUri = async (clubId: string): Promise<string | null> => {
  try {
    const response = await api.get(`/api/catalog/club/${clubId}/emblem`, {
      responseType: 'arraybuffer',
    });
    const contentType = response.headers?.['content-type'] || 'image/png';
    const base64 = encodeBase64(new Uint8Array(response.data));
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
};
