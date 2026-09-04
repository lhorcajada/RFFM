/** Fixed color palette used for club kits (shirt/shorts) — single source of truth,
 *  shared by the kit editor (color pickers) and the convocation summary (WhatsApp text,
 *  "Ver convocatoria" popup) so hex values and their Spanish names never drift apart. */
export const KIT_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Rojo", hex: "#E53935" },
  { name: "Azul", hex: "#1E88E5" },
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Negro", hex: "#000000" },
  { name: "Amarillo", hex: "#FDD835" },
  { name: "Verde", hex: "#43A047" },
  { name: "Naranja", hex: "#FB8C00" },
  { name: "Morado", hex: "#8E24AA" },
  { name: "Celeste", hex: "#29B6F6" },
  { name: "Granate", hex: "#7B1E3A" },
];

/** Maps a hex color to its Spanish name from the palette; falls back to the hex itself
 *  when the color isn't in the fixed palette (e.g. legacy/custom data). */
export function colorName(hex: string): string {
  const match = KIT_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return match ? match.name : hex;
}
