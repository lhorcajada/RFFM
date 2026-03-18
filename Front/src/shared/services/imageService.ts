import { client } from "../../core/api/client";

export async function fetchImage(url: string): Promise<string | null> {
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

export default {
  fetchImage,
};
