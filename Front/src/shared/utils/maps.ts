// Utilities for building map/search URLs

export function getMapsUrlByNameCity(
  name?: string | null,
  city?: string | null
): string | null {
  const q = [name || "", city || ""]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" ");
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}
