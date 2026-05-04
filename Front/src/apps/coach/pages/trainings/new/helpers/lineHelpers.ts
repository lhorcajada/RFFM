import type { LineKind } from "../types";
import { LINE_COLORS } from "../constants";

export const buildLinePath = (
  kind: LineKind,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx?: number,
  cy?: number,
  points?: { x: number; y: number }[],
): string => {
  if (kind === "free" && points && points.length > 1) {
    return (
      `M ${points[0].x} ${points[0].y} ` +
      points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
    );
  }
  if (kind === "curved") {
    const controlX = cx ?? (x1 + x2) / 2 + (y2 - y1) * 0.3;
    const controlY = cy ?? (y1 + y2) / 2 - (x2 - x1) * 0.3;
    return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} L ${x2} ${y2}`;
};

export const getArrowMarkerId = (color: string): string => {
  const found = LINE_COLORS.find((c) => c.value === color);
  return `line-arrow-${found?.key ?? "white"}`;
};
