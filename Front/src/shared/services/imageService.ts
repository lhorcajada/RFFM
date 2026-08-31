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

/**
 * Downloads a file via the generic `GET /api/public/storage?url=` endpoint
 * and returns an object URL for it. Use this for any `coverImageUrl`-style
 * value returned by the backend's `IStorageService` — for local storage it's
 * a relative path (e.g. `newsimages/xyz.jpg`), not a browser-navigable URL,
 * and the endpoint also transparently handles absolute Supabase URLs.
 * Returns `null` on error or an empty `url`; never throws.
 */
export async function fetchPublicStorageFile(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await client.get(`/api/public/storage`, {
      params: { url },
      responseType: "blob",
    } as any);
    const blob = resp.data as Blob;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export default {
  fetchImage,
  fetchPublicStorageFile,
};
