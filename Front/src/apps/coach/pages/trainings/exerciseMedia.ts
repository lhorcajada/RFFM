import { client } from "../../../../core/api/client";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

export function exerciseMediaUrl(urlImage: string): string {
  // If already absolute, use as-is (Supabase URLs start with https://)
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}
