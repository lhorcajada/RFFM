export function resolvePhotoUrl(urlPhoto: string | null | undefined, apiBaseUrl: string): string | null {
  if (!urlPhoto) return null;
  if (/^https?:\/\//i.test(urlPhoto)) return urlPhoto;
  return `${apiBaseUrl}/api/public/storage?url=${encodeURIComponent(urlPhoto)}`;
}
