export function resolveMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `/api/public/storage?url=${encodeURIComponent(url)}`;
}
