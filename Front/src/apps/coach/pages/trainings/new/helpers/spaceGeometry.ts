import type { SpaceKind, SpacePosition, Vertex } from "../types";
import { FIELD_WIDTH_METERS, HALF_FIELD_LENGTH_METERS, REGULAR_POLYGON_SIDES, SPACE_TEMPLATES } from "../constants";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatMeters = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2).replace(/\.?0+$/, "");
};

export const getBaseDimensionsMeters = (kind: SpaceKind) => {
  if (kind === "rectangle") return { width: 2, height: 1 };
  if (kind === "square") return { width: 1, height: 1 };
  if (kind === "circle") return { width: 1, height: 1 };

  const sides = REGULAR_POLYGON_SIDES[kind] ?? 3;
  const sideMeters = 1;
  const diameter = sideMeters / Math.sin(Math.PI / sides);
  return { width: diameter, height: diameter };
};

export const getDimensionsPercent = (
  kind: SpaceKind,
  scaleX: number,
  scaleY: number,
  touchlineBandPercent = 8,
  goalBackBandPercent = 10,
) => {
  const base = getBaseDimensionsMeters(kind);
  const playableLengthPercent = 100 - goalBackBandPercent;
  const playableWidthPercent = 100 - touchlineBandPercent * 2;

  return {
    width: ((base.width * scaleX) / HALF_FIELD_LENGTH_METERS) * playableLengthPercent,
    height: ((base.height * scaleY) / FIELD_WIDTH_METERS) * playableWidthPercent,
  };
};

export const getMaxScalesForPlayableArea = (
  kind: SpaceKind,
  _touchlineBandPercent = 8,
  _goalBackBandPercent = 10,
) => {
  const base = getBaseDimensionsMeters(kind);
  return {
    x: Math.max(1, HALF_FIELD_LENGTH_METERS / base.width),
    y: Math.max(1, FIELD_WIDTH_METERS / base.height),
  };
};

const getRegularPolygonVertices = (sides: number): Vertex[] => {
  const center = 50;
  const radius = 50;
  const startAngle = -Math.PI / 2;
  return Array.from({ length: sides }, (_, idx) => {
    const angle = startAngle + (idx * 2 * Math.PI) / sides;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });
};

export const getShapeVertices = (kind: SpaceKind): Vertex[] => {
  if (kind === "square" || kind === "rectangle") {
    return [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
  }

  const sides = REGULAR_POLYGON_SIDES[kind];
  if (sides) return getRegularPolygonVertices(sides);

  if (kind === "circle") {
    return [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ];
  }

  return [];
};

export const getSpaceVerticesPercent = (
  space: SpacePosition,
  touchlineBandPercent = 8,
  goalBackBandPercent = 10,
) => {
  const shape = getShapeVertices(space.kind);
  if (shape.length === 0) return [];

  const size = getDimensionsPercent(
    space.kind,
    space.scaleX,
    space.scaleY,
    touchlineBandPercent,
    goalBackBandPercent,
  );

  const angle = (space.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return shape.map((vertex) => {
    const localX = ((vertex.x - 50) / 100) * size.width;
    const localY = ((vertex.y - 50) / 100) * size.height;
    return {
      x: space.x + localX * cos - localY * sin,
      y: space.y + localX * sin + localY * cos,
    };
  });
};

export const getSideLengthsMeters = (kind: SpaceKind, scaleX: number, scaleY: number) => {
  if (kind === "circle") {
    const base = getBaseDimensionsMeters(kind);
    return [base.width * scaleX, base.height * scaleY];
  }

  const base = getBaseDimensionsMeters(kind);
  const vertices = getShapeVertices(kind);
  if (vertices.length === 0) return [];

  return vertices.map((vertex, idx) => {
    const next = vertices[(idx + 1) % vertices.length];
    const dxPct = (next.x - vertex.x) / 100;
    const dyPct = (next.y - vertex.y) / 100;
    const dxMeters = dxPct * base.width * scaleX;
    const dyMeters = dyPct * base.height * scaleY;
    return Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);
  });
};

export const isSpaceKind = (value: string): value is SpaceKind =>
  SPACE_TEMPLATES.some((template) => template.kind === value);

export const snapToRangeEdges = (
  value: number,
  min: number,
  max: number,
  threshold: number,
) => {
  if (Math.abs(value - min) <= threshold) return min;
  if (Math.abs(value - max) <= threshold) return max;
  return value;
};
