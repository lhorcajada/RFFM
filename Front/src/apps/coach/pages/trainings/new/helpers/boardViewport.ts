import type { TacticalBoardSnapshot } from "../types";
import { getChapaSizePercent, getMaterialSizePercent } from "./materialHelpers";
import { getDimensionsPercent } from "./spaceGeometry";

export type BoardViewport = "left" | "right" | "full";

/** How far (in % of a half pitch) an object may cross the halfway line and still be
 * considered part of the other half — chapas resting on the line shouldn't force the
 * full pitch. */
const HALFWAY_LINE_TOLERANCE = 3;

type Extent = { min: number; max: number };

const around = (x: number, halfWidth: number): Extent => ({ min: x - halfWidth, max: x + halfWidth });

function collectExtents(snapshot: TacticalBoardSnapshot): Extent[] {
  const extents: Extent[] = [];

  const chapaHalfWidth = getChapaSizePercent().width / 2;
  Object.values(snapshot.placedChapas ?? {}).forEach((chapa) => {
    const scale = Math.max(chapa.scaleX ?? 1, chapa.scaleY ?? 1);
    extents.push(around(chapa.x, chapaHalfWidth * scale));
  });

  (snapshot.placedSpaces ?? []).forEach((space) => {
    const size = getDimensionsPercent(space.kind, space.scaleX, space.scaleY);
    extents.push(around(space.x, Math.max(size.width, size.height) / 2));
  });

  (snapshot.placedMaterials ?? []).forEach((material) => {
    const size = getMaterialSizePercent(material.kind);
    const width = size.width * (material.scaleX ?? 1);
    const height = size.height * (material.scaleY ?? 1);
    extents.push(around(material.x, Math.max(width, height) / 2));
  });

  (snapshot.placedLines ?? []).forEach((line) => {
    const xs = [line.x1, line.x2, ...(line.cx !== undefined ? [line.cx] : []), ...(line.points ?? []).map((p) => p.x)];
    extents.push({ min: Math.min(...xs), max: Math.max(...xs) });
  });

  (snapshot.placedTexts ?? []).forEach((text) => {
    extents.push(around(text.x, 0));
  });

  return extents;
}

/** Detects which part of the F11 pitch a board drawing actually uses, so printouts can
 * crop to a single half (coordinates: right half is 0..100, left half is negative). */
export function detectBoardViewport(snapshot: TacticalBoardSnapshot): BoardViewport {
  const extents = collectExtents(snapshot);
  if (extents.length === 0) return "full";

  const minX = Math.min(...extents.map((e) => e.min));
  const maxX = Math.max(...extents.map((e) => e.max));

  if (minX >= -HALFWAY_LINE_TOLERANCE) return "right";
  if (maxX <= HALFWAY_LINE_TOLERANCE) return "left";
  return "full";
}
