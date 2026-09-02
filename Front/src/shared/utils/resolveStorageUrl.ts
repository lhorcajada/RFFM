import { client } from "../../core/api/client";

/**
 * LocalStorageService (dev backend storage) returns a bare "{bucket}/{file}"
 * relative path instead of a public URL — a plain <img src> can't load that
 * relative to the frontend's own origin. Proxy it through the anonymous
 * GET /api/catalog/team/photo endpoint instead. Absolute http(s) URLs (RFFM
 * shields, Supabase public URLs) are returned untouched.
 */
export function resolveStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const base = (client.defaults.baseURL ?? "").toString().replace(/\/$/, "");
  return `${base}/api/catalog/team/photo?url=${encodeURIComponent(url)}`;
}
