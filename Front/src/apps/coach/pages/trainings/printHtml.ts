import { client } from "../../../../core/api/client";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

export function mediaUrl(urlImage: string): string {
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
