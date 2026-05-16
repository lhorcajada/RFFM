import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import teamplayerService, { type PlayerResponse } from "../../../../services/teamplayerService";
import { FIELD_WIDTH_METERS, HALF_FIELD_LENGTH_METERS, SPACE_COLORS, anonymousChapaOptions } from "../constants";
import { getMaterialSizePercent, isMaterialKind, getChapaSizePercent } from "../helpers/materialHelpers";
import {
  clamp,
  formatMeters,
  getBaseDimensionsMeters,
  getDimensionsPercent,
  getMaxScalesForPlayableArea,
  getSpaceVerticesPercent,
  isSpaceKind,
  snapToRangeEdges,
} from "../helpers/spaceGeometry";
import type {
  ChapaPosition,
  DrawingState,
  LineKind,
  MaterialKind,
  PlacedLine,
  PlacedMaterial,
  PetoOption,
  ResizeHandle,
  ResizeSession,
  SpaceKind,
  SpacePosition,
} from "../types";
import type { TacticalBoardSnapshot } from "../types";

export function useTacticalBoard(
  halfPitchRef: React.RefObject<HTMLDivElement | null>,
  teamId: string,
) {
  const [showChapas, setShowChapas] = useState(false);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [chapasError, setChapasError] = useState<string | null>(null);
  const [placedChapas, setPlacedChapas] = useState<Record<string, ChapaPosition>>({});
  const [draggingChapaId, setDraggingChapaId] = useState<string | null>(null);
  const [chapaPetoById, setChapaPetoById] = useState<Record<string, string>>({});
  const [activeChapaMenuId, setActiveChapaMenuId] = useState<string | null>(null);

  const [showSpaces, setShowSpaces] = useState(false);
  const [placedSpaces, setPlacedSpaces] = useState<SpacePosition[]>([]);
  const [draggingSpaceId, setDraggingSpaceId] = useState<string | null>(null);
  const spaceDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [resizeSession, setResizeSession] = useState<ResizeSession | null>(null);

  const [showMaterials, setShowMaterials] = useState(false);
  const [placedMaterials, setPlacedMaterials] = useState<PlacedMaterial[]>([]);
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);

  const [showLines, setShowLines] = useState(false);
  const [placedLines, setPlacedLines] = useState<PlacedLine[]>([]);
  const [activeLineKind, setActiveLineKind] = useState<LineKind | null>(null);
  const [activeLineColor, setActiveLineColor] = useState<string>("#ffffff");
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);

  const normalizeSpacePosition = (space: SpacePosition): SpacePosition => ({
    ...space,
    scaleX: space.scaleX ?? 1,
    scaleY: space.scaleY ?? 1,
    rotation: space.rotation ?? 0,
    locked: space.locked ?? false,
    color: space.color ?? SPACE_COLORS[0].value,
  });

  const clearBoardState = () => {
    setPlacedChapas({});
    setChapaPetoById({});
    setPlacedSpaces([]);
    setPlacedMaterials([]);
    setPlacedLines([]);
  };

  const normalizeChapaPosition = (chapa: ChapaPosition): ChapaPosition => {
    const scale = chapa.scaleX ?? chapa.scaleY ?? 1;
    return {
      ...chapa,
      scaleX: scale,
      scaleY: scale,
    };
  };

  const loadBoardSnapshot = (snapshot: TacticalBoardSnapshot | null | undefined) => {
    if (!snapshot) return;

    const normalizedChapas = Object.fromEntries(
      Object.entries(snapshot.placedChapas ?? {}).map(([playerId, chapa]) => [playerId, normalizeChapaPosition(chapa)]),
    );

    setPlacedChapas(normalizedChapas);
    setChapaPetoById(snapshot.chapaPetoById ?? {});
    setPlacedSpaces((snapshot.placedSpaces ?? []).map(normalizeSpacePosition));
    setPlacedMaterials(snapshot.placedMaterials ?? []);
    setPlacedLines(snapshot.placedLines ?? []);
  };

  const loadBoardStateJson = (boardStateJson?: string | null) => {
    if (!boardStateJson) {
      clearBoardState();
      return;
    }

    try {
      const snapshot = JSON.parse(boardStateJson) as TacticalBoardSnapshot;
      loadBoardSnapshot(snapshot);
    } catch {
      clearBoardState();
    }
  };

  const serializeBoardStateJson = () =>
    JSON.stringify({
      placedChapas: Object.fromEntries(
        Object.entries(placedChapas).map(([playerId, chapa]) => [playerId, normalizeChapaPosition(chapa)]),
      ),
      chapaPetoById,
      placedSpaces,
      placedMaterials,
      placedLines,
    } satisfies TacticalBoardSnapshot);

  useEffect(() => {
    let cancelled = false;

    const loadPlayers = async () => {
      if (!teamId) {
        setPlayers([]);
        setChapasError(null);
        setLoadingPlayers(false);
        return;
      }

      setLoadingPlayers(true);
      setChapasError(null);

      try {
        const list = await teamplayerService.getPlayersByTeam(teamId);
        if (cancelled) return;
        setPlayers(list);
      } catch {
        if (cancelled) return;
        setPlayers([]);
        setChapasError("No se pudieron cargar las chapas del equipo.");
      } finally {
        if (!cancelled) setLoadingPlayers(false);
      }
    };

    void loadPlayers();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // ─── Helpers that depend on the pitch ref ────────────────────────────────

  const getFieldBands = () => {
    const pitch = halfPitchRef.current;
    const style = pitch ? window.getComputedStyle(pitch) : null;
    const touchlineBand = parseFloat(style?.getPropertyValue("--touchline-band") ?? "") || 8;
    const goalBackBand = parseFloat(style?.getPropertyValue("--goal-back-band") ?? "") || 10;
    return { touchlineBand, goalBackBand };
  };

  const getRawDropPosition = (clientX: number, clientY: number) => {
    const pitch = halfPitchRef.current;
    if (!pitch) return null;
    const rect = pitch.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const clampMaterialToPlayableArea = (
    kind: MaterialKind,
    x: number,
    y: number,
    touchlineBand = 8,
    goalBackBand = 10,
    scaleX = 1,
    scaleY = 1,
  ) => {
    const playableLeft = 0;
    const playableRight = 100 - goalBackBand;
    const playableTop = touchlineBand;
    const playableBottom = 100 - touchlineBand;

    const size = getMaterialSizePercent(kind);
    const halfWidth = (size.width * scaleX) / 2;
    const halfHeight = (size.height * scaleY) / 2;

    return {
      x: clamp(x, playableLeft + halfWidth, playableRight - halfWidth),
      y: clamp(y, playableTop + halfHeight, playableBottom - halfHeight),
    };
  };

  const clampChapaToPlayableArea = (
    x: number,
    y: number,
    touchlineBand = 8,
    goalBackBand = 10,
    scaleX = 1,
    scaleY = 1,
  ) => {
    const playableLeft = 0;
    const playableRight = 100 - goalBackBand;
    const playableTop = touchlineBand;
    const playableBottom = 100 - touchlineBand;

    const size = getChapaSizePercent();
    const halfWidth = (size.width * scaleX) / 2;
    const halfHeight = (size.height * scaleY) / 2;

    return {
      x: clamp(x, playableLeft + halfWidth, playableRight - halfWidth),
      y: clamp(y, playableTop + halfHeight, playableBottom - halfHeight),
    };
  };

  const clampSpaceToPlayableArea = (
    kind: SpaceKind,
    scaleX: number,
    scaleY: number,
    x: number,
    y: number,
    touchlineBand = 8,
    goalBackBand = 10,
  ) => {
    const pitch = halfPitchRef.current;
    if (!pitch) return { x, y };

    const playableLeft = 0;
    const playableRight = 100 - goalBackBand;
    const playableTop = touchlineBand;
    const playableBottom = 100 - touchlineBand;

    const size = getDimensionsPercent(kind, scaleX, scaleY, touchlineBand, goalBackBand);
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;

    const minX = playableLeft + halfWidth;
    const maxX = playableRight - halfWidth;
    const minY = playableTop + halfHeight;
    const maxY = playableBottom - halfHeight;

    const centerX = (playableLeft + playableRight) / 2;
    const centerY = (playableTop + playableBottom) / 2;
    const snapThreshold = 1.2;
    const snappedX = snapToRangeEdges(x, minX, maxX, snapThreshold);
    const snappedY = snapToRangeEdges(y, minY, maxY, snapThreshold);

    return {
      x: minX > maxX ? centerX : clamp(snappedX, minX, maxX),
      y: minY > maxY ? centerY : clamp(snappedY, minY, maxY),
    };
  };

  const handleToggleSpaces = () => {
    setShowSpaces((prev) => {
      const next = !prev;
      if (next) {
        setShowChapas(false);
        setShowMaterials(false);
        setShowLines(false);
        setActiveLineKind(null);
        setDrawingState(null);
      }
      return next;
    });
  };

  const handleToggleChapas = () => {
    setShowChapas((prev) => {
      const next = !prev;
      if (next) {
        setShowSpaces(false);
        setShowMaterials(false);
        setShowLines(false);
        setActiveLineKind(null);
        setDrawingState(null);
      }
      return next;
    });
  };

  const handleToggleMaterials = () => {
    setShowMaterials((prev) => {
      const next = !prev;
      if (next) {
        setShowChapas(false);
        setShowSpaces(false);
        setShowLines(false);
        setActiveLineKind(null);
        setDrawingState(null);
      }
      return next;
    });
  };

  const handleToggleLines = () => {
    setShowLines((prev) => {
      const next = !prev;
      if (next) {
        setShowChapas(false);
        setShowSpaces(false);
        setShowMaterials(false);
      } else {
        setActiveLineKind(null);
        setDrawingState(null);
      }
      return next;
    });
  };

  // ─── Space operations ─────────────────────────────────────────────────────

  const createSpaceAtPoint = (kind: SpaceKind, clientX: number, clientY: number) => {
    const raw = getRawDropPosition(clientX, clientY);
    if (!raw) return;

    const nextScaleX = 1;
    const nextScaleY = 1;
    const clamped = clampSpaceToPlayableArea(kind, nextScaleX, nextScaleY, raw.x, raw.y);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `space-${Date.now()}-${Math.random()}`;

    setPlacedSpaces((prev) => [
      ...prev,
      {
        id,
        kind,
        x: clamped.x,
        y: clamped.y,
        scaleX: nextScaleX,
        scaleY: nextScaleY,
        rotation: 0,
        locked: false,
        color: SPACE_COLORS[0].value,
      },
    ]);
  };

  const movePlacedSpace = (spaceId: string, clientX: number, clientY: number) => {
    const raw = getRawDropPosition(clientX, clientY);
    if (!raw) return;
    const dragOffset = spaceDragOffsetRef.current ?? { x: 0, y: 0 };
    const targetX = raw.x - dragOffset.x;
    const targetY = raw.y - dragOffset.y;

    const { touchlineBand, goalBackBand } = getFieldBands();

    const snapByVertices = (
      draft: SpacePosition,
      others: SpacePosition[],
      thresholdPercent = 0.5,
    ) => {
      const selfVertices = getSpaceVerticesPercent(draft, touchlineBand, goalBackBand);
      if (selfVertices.length === 0 || others.length === 0) return draft;

      let anchorVertex = selfVertices[0];
      let anchorDistance = Number.POSITIVE_INFINITY;

      selfVertices.forEach((vertex) => {
        const distanceToDrop = Math.hypot(vertex.x - targetX, vertex.y - targetY);
        if (distanceToDrop < anchorDistance) {
          anchorDistance = distanceToDrop;
          anchorVertex = vertex;
        }
      });

      let bestDistance = Number.POSITIVE_INFINITY;
      let bestDelta: { dx: number; dy: number } | null = null;

      others.forEach((other) => {
        const otherVertices = getSpaceVerticesPercent(other, touchlineBand, goalBackBand);
        otherVertices.forEach((ov) => {
          const dx = ov.x - anchorVertex.x;
          const dy = ov.y - anchorVertex.y;
          const distance = Math.hypot(dx, dy);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestDelta = { dx, dy };
          }
        });
      });

      if (!bestDelta || bestDistance > thresholdPercent) return draft;
      const delta = bestDelta as { dx: number; dy: number };

      const snapped = clampSpaceToPlayableArea(
        draft.kind,
        draft.scaleX,
        draft.scaleY,
        draft.x + delta.dx,
        draft.y + delta.dy,
        touchlineBand,
        goalBackBand,
      );

      return { ...draft, x: snapped.x, y: snapped.y };
    };

    setPlacedSpaces((prev) =>
      prev.map((space) => {
        if (space.id !== spaceId) return space;
        if (space.locked) return space;

        const others = prev.filter((candidate) => candidate.id !== spaceId);
        const clamped = clampSpaceToPlayableArea(
          space.kind,
          space.scaleX,
          space.scaleY,
          targetX,
          targetY,
          touchlineBand,
          goalBackBand,
        );

        return snapByVertices({ ...space, x: clamped.x, y: clamped.y }, others);
      }),
    );
  };

    const nudgePlacedSpace = (spaceId: string, dxPercent: number, dyPercent: number) => {
      const { touchlineBand, goalBackBand } = getFieldBands();

      setPlacedSpaces((prev) =>
        prev.map((space) => {
          if (space.id !== spaceId) return space;
          if (space.locked) return space;

          const nextX = space.x + dxPercent;
          const nextY = space.y + dyPercent;
          const clamped = clampSpaceToPlayableArea(
            space.kind,
            space.scaleX,
            space.scaleY,
            nextX,
            nextY,
            touchlineBand,
            goalBackBand,
          );

          return { ...space, x: clamped.x, y: clamped.y };
        }),
      );
    };

  const rotatePlacedSpace = (spaceId: string) => {
    setPlacedSpaces((prev) =>
      prev.map((space) =>
        space.id === spaceId && !space.locked
          ? { ...space, rotation: (space.rotation + 15) % 360 }
          : space,
      ),
    );
  };

  const toggleLockPlacedSpace = (spaceId: string) => {
    setPlacedSpaces((prev) =>
      prev.map((space) =>
        space.id === spaceId ? { ...space, locked: !space.locked } : space,
      ),
    );
  };

  const removePlacedSpace = (spaceId: string) => {
    setPlacedSpaces((prev) => prev.filter((space) => space.id !== spaceId));
  };

  const setPlacedSpaceColor = (spaceId: string, color: string) => {
    setPlacedSpaces((prev) => prev.map((space) => (space.id === spaceId ? { ...space, color } : space)));
  };

  const duplicatePlacedSpace = (spaceId: string) => {
    const source = placedSpaces.find((space) => space.id === spaceId);
    if (!source) return;

    const { touchlineBand, goalBackBand } = getFieldBands();
    const clampedPos = clampSpaceToPlayableArea(
      source.kind,
      source.scaleX,
      source.scaleY,
      source.x + 2,
      source.y + 2,
      touchlineBand,
      goalBackBand,
    );

    const duplicatedId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `space-${Date.now()}-${Math.random()}`;

    setPlacedSpaces((prev) => [
      ...prev,
      { ...normalizeSpacePosition(source), id: duplicatedId, x: clampedPos.x, y: clampedPos.y },
    ]);
  };

  const handleManualResize = (spaceId: string) => {
    const space = placedSpaces.find((item) => item.id === spaceId);
    if (!space || space.locked) return;

    const base = getBaseDimensionsMeters(space.kind);
    const currentWidthMeters = base.width * space.scaleX;
    const currentHeightMeters = base.height * space.scaleY;

    const widthInput = window.prompt("Ancho/Largo en metros", formatMeters(currentWidthMeters));
    if (widthInput === null) return;

    const heightInput = window.prompt("Alto en metros", formatMeters(currentHeightMeters));
    if (heightInput === null) return;

    const targetWidth = Number(widthInput.replace(",", "."));
    const targetHeight = Number(heightInput.replace(",", "."));
    if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) return;

    const { touchlineBand, goalBackBand } = getFieldBands();
    const maxScales = getMaxScalesForPlayableArea(space.kind, touchlineBand, goalBackBand);

    const nextScaleX = clamp(targetWidth / base.width, 1, maxScales.x);
    const nextScaleY = clamp(targetHeight / base.height, 1, maxScales.y);

    setPlacedSpaces((prev) =>
      prev.map((item) => {
        if (item.id !== spaceId) return item;

        const clampedPos = clampSpaceToPlayableArea(
          item.kind,
          nextScaleX,
          nextScaleY,
          item.x,
          item.y,
          touchlineBand,
          goalBackBand,
        );

        return { ...item, scaleX: nextScaleX, scaleY: nextScaleY, x: clampedPos.x, y: clampedPos.y };
      }),
    );
  };

  const handleResizeStart = (
    e: React.MouseEvent<HTMLButtonElement>,
    space: SpacePosition,
    handle: ResizeHandle,
  ) => {
    if (space.locked) return;
    e.preventDefault();
    e.stopPropagation();

    const pitch = halfPitchRef.current;
    const style = pitch ? window.getComputedStyle(pitch) : null;
    const touchlineBand = parseFloat(style?.getPropertyValue("--touchline-band") ?? "") || 8;
    const goalBackBand = parseFloat(style?.getPropertyValue("--goal-back-band") ?? "") || 10;

    setResizeSession({
      spaceId: space.id,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScaleX: space.scaleX,
      startScaleY: space.scaleY,
      startX: space.x,
      startY: space.y,
      rotationDeg: space.rotation,
      touchlineBandPercent: touchlineBand,
      goalBackBandPercent: goalBackBand,
    });
  };

  useEffect(() => {
    if (!resizeSession) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pitch = halfPitchRef.current;
      if (!pitch) return;

      setPlacedSpaces((prev) =>
        prev.map((space) => {
          if (space.id !== resizeSession.spaceId) return space;
          if (space.locked) return space;

          const others = prev.filter((candidate) => candidate.id !== space.id);
          const rect = pitch.getBoundingClientRect();
          const dxPx = e.clientX - resizeSession.startClientX;
          const dyPx = e.clientY - resizeSession.startClientY;

          const dxPercent = (dxPx / rect.width) * 100;
          const dyPercent = (dyPx / rect.height) * 100;

          const angle = (resizeSession.rotationDeg * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          const localDx = dxPercent * cos + dyPercent * sin;
          const localDy = -dxPercent * sin + dyPercent * cos;

          const startSize = getDimensionsPercent(
            space.kind,
            resizeSession.startScaleX,
            resizeSession.startScaleY,
            resizeSession.touchlineBandPercent,
            resizeSession.goalBackBandPercent,
          );

          const base = getBaseDimensionsMeters(space.kind);
          const maxScales = getMaxScalesForPlayableArea(
            space.kind,
            resizeSession.touchlineBandPercent,
            resizeSession.goalBackBandPercent,
          );

          const handle = resizeSession.handle;
          const isCorner = handle.length === 2;

          const signX = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
          const signY = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;

          let nextWidth = startSize.width;
          let nextHeight = startSize.height;

          if (isCorner) {
            const deltaW = signX * localDx;
            const deltaH = signY * localDy;
            const ratioW = (startSize.width + deltaW) / startSize.width;
            const ratioH = (startSize.height + deltaH) / startSize.height;
            const scaleFactor = Math.max(0.05, Math.min(ratioW, ratioH));
            nextWidth = startSize.width * scaleFactor;
            nextHeight = startSize.height * scaleFactor;
          } else {
            if (signX !== 0) nextWidth = startSize.width + signX * localDx;
            if (signY !== 0) nextHeight = startSize.height + signY * localDy;
          }

          const minScale = 1;
          const minWidth =
            ((base.width * minScale) / HALF_FIELD_LENGTH_METERS) *
            (100 - resizeSession.goalBackBandPercent);
          const minHeight =
            ((base.height * minScale) / FIELD_WIDTH_METERS) *
            (100 - resizeSession.touchlineBandPercent * 2);
          const maxWidth =
            ((base.width * maxScales.x) / HALF_FIELD_LENGTH_METERS) *
            (100 - resizeSession.goalBackBandPercent);
          const maxHeight =
            ((base.height * maxScales.y) / FIELD_WIDTH_METERS) *
            (100 - resizeSession.touchlineBandPercent * 2);

          nextWidth = clamp(nextWidth, minWidth, maxWidth);
          nextHeight = clamp(nextHeight, minHeight, maxHeight);

          const nextScaleX =
            (nextWidth * HALF_FIELD_LENGTH_METERS) /
            (base.width * (100 - resizeSession.goalBackBandPercent));
          const nextScaleY =
            (nextHeight * FIELD_WIDTH_METERS) /
            (base.height * (100 - resizeSession.touchlineBandPercent * 2));

          const widthDelta = nextWidth - startSize.width;
          const heightDelta = nextHeight - startSize.height;

          const localShiftX = signX === 0 ? 0 : (widthDelta / 2) * signX;
          const localShiftY = signY === 0 ? 0 : (heightDelta / 2) * signY;

          const shiftX = localShiftX * cos - localShiftY * sin;
          const shiftY = localShiftX * sin + localShiftY * cos;

          const moved = {
            x: resizeSession.startX + shiftX,
            y: resizeSession.startY + shiftY,
          };

          const clampedPos = clampSpaceToPlayableArea(
            space.kind,
            nextScaleX,
            nextScaleY,
            moved.x,
            moved.y,
            resizeSession.touchlineBandPercent,
            resizeSession.goalBackBandPercent,
          );

          const draft = {
            ...space,
            scaleX: nextScaleX,
            scaleY: nextScaleY,
            x: clampedPos.x,
            y: clampedPos.y,
          };

          const selfVertices = getSpaceVerticesPercent(
            draft,
            resizeSession.touchlineBandPercent,
            resizeSession.goalBackBandPercent,
          );

          let bestDistance = Number.POSITIVE_INFINITY;
          let bestDelta: { dx: number; dy: number } | null = null;

          others.forEach((other) => {
            const otherVertices = getSpaceVerticesPercent(
              other,
              resizeSession.touchlineBandPercent,
              resizeSession.goalBackBandPercent,
            );
            otherVertices.forEach((ov) => {
              selfVertices.forEach((sv) => {
                const dx = ov.x - sv.x;
                const dy = ov.y - sv.y;
                const distance = Math.hypot(dx, dy);
                if (distance < bestDistance) {
                  bestDistance = distance;
                  bestDelta = { dx, dy };
                }
              });
            });
          });

          if (bestDelta && bestDistance <= 0.9) {
            const delta = bestDelta as { dx: number; dy: number };
            const snapped = clampSpaceToPlayableArea(
              draft.kind,
              draft.scaleX,
              draft.scaleY,
              draft.x + delta.dx,
              draft.y + delta.dy,
              resizeSession.touchlineBandPercent,
              resizeSession.goalBackBandPercent,
            );
            return { ...draft, x: snapped.x, y: snapped.y };
          }

          return draft;
        }),
      );
    };

    const handleMouseUp = () => setResizeSession(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeSession]);

  // ─── Material operations ──────────────────────────────────────────────────

  const createMaterialAtPoint = (kind: MaterialKind, clientX: number, clientY: number) => {
    const raw = getRawDropPosition(clientX, clientY);
    if (!raw) return;

    const { touchlineBand, goalBackBand } = getFieldBands();
    const clamped = clampMaterialToPlayableArea(kind, raw.x, raw.y, touchlineBand, goalBackBand);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `material-${Date.now()}-${Math.random()}`;

    setPlacedMaterials((prev) => [
      ...prev,
      { id, kind, x: clamped.x, y: clamped.y, rotation: 0, scaleX: 1, scaleY: 1, locked: false },
    ]);
  };

  const movePlacedMaterial = (materialId: string, clientX: number, clientY: number) => {
    const raw = getRawDropPosition(clientX, clientY);
    if (!raw) return;

    const { touchlineBand, goalBackBand } = getFieldBands();
    setPlacedMaterials((prev) =>
      prev.map((material) => {
        if (material.id !== materialId) return material;
        const clamped = clampMaterialToPlayableArea(
          material.kind,
          raw.x,
          raw.y,
          touchlineBand,
          goalBackBand,
        );
        return { ...material, x: clamped.x, y: clamped.y };
      }),
    );
  };

  const rotatePlacedMaterial = (materialId: string) => {
    setPlacedMaterials((prev) =>
      prev.map((material) =>
        material.id === materialId
          ? { ...material, rotation: (material.rotation + 90) % 360 }
          : material,
      ),
    );
  };

  const removePlacedMaterial = (materialId: string) => {
    setPlacedMaterials((prev) => prev.filter((m) => m.id !== materialId));
  };

  const duplicatePlacedMaterial = (materialId: string) => {
    const source = placedMaterials.find((m) => m.id === materialId);
    if (!source) return;
    const { touchlineBand, goalBackBand } = getFieldBands();
    const clampedX = clampMaterialToPlayableArea(
      source.kind,
      source.x + 2,
      source.y + 2,
      touchlineBand,
      goalBackBand,
    );
    const duplicatedId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `material-${Date.now()}-${Math.random()}`;
    setPlacedMaterials((prev) => [...prev, { ...source, id: duplicatedId, x: clampedX.x, y: clampedX.y }]);
  };

  const toggleLockPlacedMaterial = (materialId: string) => {
    setPlacedMaterials((prev) => prev.map((m) => (m.id === materialId ? { ...m, locked: !m.locked } : m)));
  };

  const handleManualResizeMaterial = (materialId: string) => {
    const material = placedMaterials.find((m) => m.id === materialId);
    if (!material || material.locked) return;
    const input = window.prompt("Escala (por ejemplo 1 = 100%, 1.5 = 150%)", String(material.scaleX ?? 1));
    if (input === null) return;
    const v = Number(input.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    const next = Math.max(0.3, Math.min(4, v));
    setPlacedMaterials((prev) => prev.map((m) => (m.id === materialId ? { ...m, scaleX: next, scaleY: next } : m)));
  };

  const scalePlacedMaterial = (materialId: string, factor: number) => {
    setPlacedMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== materialId) return m;
        const curX = m.scaleX ?? 1;
        const curY = m.scaleY ?? 1;
        const nextX = Math.max(0.3, Math.min(4, curX * factor));
        const nextY = Math.max(0.3, Math.min(4, curY * factor));
        return { ...m, scaleX: nextX, scaleY: nextY };
      }),
    );
  };

  // ─── Chapa operations ─────────────────────────────────────────────────────

  const makeAnonymousChapaId = (key: string) => {
    const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    return `anon-chapa-${key}-${suffix}`;
  };

  const placeChapaAtClientPoint = (chapaId: string, clientX: number, clientY: number, anonymous = false) => {
    const pitch = halfPitchRef.current;
    if (!pitch) return;

    const rect = pitch.getBoundingClientRect();
    const style = window.getComputedStyle(pitch);
    const touchlineBand = parseFloat(style.getPropertyValue("--touchline-band")) || 8;
    const goalBackBand = parseFloat(style.getPropertyValue("--goal-back-band")) || 10;

    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;

    const x = clamp(rawX, 0, 100 - goalBackBand);
    const y = clamp(rawY, touchlineBand, 100 - touchlineBand);

    setPlacedChapas((prev) => ({
      ...prev,
      [chapaId]: { x, y, scaleX: 1, scaleY: 1, rotation: 0, locked: false, anonymous },
    }));
  };

  const handleChapaDragStart = (e: React.DragEvent<HTMLElement>, playerId: string) => {
    e.dataTransfer.setData("text/chapa-player-id", playerId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingChapaId(playerId);
  };

  const handleAnonymousChapaDragStart = (e: React.DragEvent<HTMLElement>, option: PetoOption) => {
    e.dataTransfer.setData("text/chapa-anonymous-key", option.key);
    e.dataTransfer.setData("text/chapa-anonymous-color", option.color);
    e.dataTransfer.effectAllowed = "move";
    setDraggingChapaId(`anon-${option.key}`);
  };

  const handleChapaDragEnd = (e: React.DragEvent<HTMLElement>, playerId: string) => {
    setDraggingChapaId(null);
    if (halfPitchRef.current && playerId in placedChapas) {
      const rect = halfPitchRef.current.getBoundingClientRect();
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) {
        removePlacedChapa(playerId);
      }
    }
  };

  const removePlacedChapa = (playerId: string) => {
    const shouldRemoveColor = placedChapas[playerId]?.anonymous === true;
    setPlacedChapas((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    if (shouldRemoveColor) {
      setChapaPetoById((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }
  };

  const handleToggleChapaMenu = (e: React.MouseEvent<HTMLElement>, playerId: string) => {
    e.stopPropagation();
    setActiveChapaMenuId((prev) => (prev === playerId ? null : playerId));
  };

  const handleSetChapaPeto = (
    e: React.MouseEvent<HTMLElement>,
    playerId: string,
    color: string,
  ) => {
    e.stopPropagation();
    setChapaPetoById((prev) => ({ ...prev, [playerId]: color }));
    setActiveChapaMenuId(null);
  };

  const handleClearChapaPeto = (e: React.MouseEvent<HTMLElement>, playerId: string) => {
    e.stopPropagation();
    setChapaPetoById((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    setActiveChapaMenuId(null);
  };

  const duplicatePlacedChapa = (playerId: string) => {
    const source = placedChapas[playerId];
    if (!source) return;
    const { touchlineBand, goalBackBand } = getFieldBands();
    const clamped = clampChapaToPlayableArea(source.x + 2, source.y + 2, touchlineBand, goalBackBand, source.scaleX ?? 1, source.scaleY ?? 1);
    const duplicatedId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `chapa-${Date.now()}-${Math.random()}`;
    setPlacedChapas((prev) => ({ ...prev, [duplicatedId]: { ...source, x: clamped.x, y: clamped.y } }));
    const sourceColor = chapaPetoById[playerId];
    if (sourceColor) {
      setChapaPetoById((prev) => ({ ...prev, [duplicatedId]: sourceColor }));
    }
  };

  const toggleLockPlacedChapa = (playerId: string) => {
    setPlacedChapas((prev) => {
      const next = { ...prev };
      if (next[playerId]) next[playerId] = { ...next[playerId], locked: !next[playerId].locked };
      return next;
    });
  };

  const rotatePlacedChapa = (playerId: string) => {
    setPlacedChapas((prev) => {
      const next = { ...prev };
      if (next[playerId]) next[playerId] = { ...next[playerId], rotation: ((next[playerId].rotation ?? 0) + 15) % 360 };
      return next;
    });
  };

  const handleManualResizeChapa = (playerId: string) => {
    const chapa = placedChapas[playerId];
    if (!chapa || chapa.locked) return;
    const input = window.prompt("Escala (por ejemplo 1 = 100%, 1.5 = 150%)", String(chapa.scaleX ?? 1));
    if (input === null) return;
    const v = Number(input.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    const next = Math.max(0.3, Math.min(4, v));
    setPlacedChapas((prev) => {
      const nextMap = { ...prev };
      if (nextMap[playerId]) nextMap[playerId] = { ...nextMap[playerId], scaleX: next, scaleY: next };
      return nextMap;
    });
  };

  // ─── Space drag handlers ──────────────────────────────────────────────────

  const handleSpaceTemplateDragStart = (e: React.DragEvent<HTMLElement>, kind: SpaceKind) => {
    e.dataTransfer.setData("text/space-template-kind", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlacedSpaceDragStart = (e: React.DragEvent<HTMLElement>, spaceId: string) => {
    const space = placedSpaces.find((item) => item.id === spaceId);
    if (!space || space.locked) {
      e.preventDefault();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    spaceDragOffsetRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100 - 50,
      y: ((e.clientY - rect.top) / rect.height) * 100 - 50,
    };
    e.dataTransfer.setData("text/space-instance-id", spaceId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingSpaceId(spaceId);
  };

  const handleSpaceDragEnd = () => {
    spaceDragOffsetRef.current = null;
    setDraggingSpaceId(null);
  };

  const handlePlacedSpaceDragEnd = (e: React.DragEvent<HTMLElement>, spaceId: string) => {
    spaceDragOffsetRef.current = null;
    setDraggingSpaceId(null);
    if (halfPitchRef.current) {
      const rect = halfPitchRef.current.getBoundingClientRect();
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) removePlacedSpace(spaceId);
    }
  };

  // ─── Material drag handlers ───────────────────────────────────────────────

  const handleMaterialTemplateDragStart = (
    e: React.DragEvent<HTMLElement>,
    kind: MaterialKind,
  ) => {
    e.dataTransfer.setData("text/material-template-kind", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlacedMaterialDragStart = (e: React.DragEvent<HTMLElement>, materialId: string) => {
    e.dataTransfer.setData("text/material-instance-id", materialId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingMaterialId(materialId);
  };

  const [materialResizeSession, setMaterialResizeSession] = useState<
    | {
        materialId: string;
        handle: ResizeHandle;
        startClientX: number;
        startClientY: number;
        startScaleX: number;
        startScaleY: number;
        startX: number;
        startY: number;
      }
    | null
  >(null);

  const handleMaterialResizeStart = (
    e: React.MouseEvent<HTMLButtonElement> | React.MouseEvent<HTMLElement>,
    material: PlacedMaterial,
    handle: ResizeHandle,
  ) => {
    if (material.locked) return;
    e.preventDefault();
    e.stopPropagation();
    setMaterialResizeSession({
      materialId: material.id,
      handle,
      startClientX: (e as React.MouseEvent).clientX,
      startClientY: (e as React.MouseEvent).clientY,
      startScaleX: material.scaleX ?? 1,
      startScaleY: material.scaleY ?? 1,
      startX: material.x,
      startY: material.y,
    });
  };

  useEffect(() => {
    if (!materialResizeSession) return;

    const handleMouseMove = (ev: MouseEvent) => {
      const pitch = halfPitchRef.current;
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();
      const dxPx = ev.clientX - materialResizeSession.startClientX;
      const dyPx = ev.clientY - materialResizeSession.startClientY;
      const dxPercent = (dxPx / rect.width) * 100;
      const dyPercent = (dyPx / rect.height) * 100;

      setPlacedMaterials((prev) =>
        prev.map((m) => {
          if (m.id !== materialResizeSession.materialId) return m;
          const base = getMaterialSizePercent(m.kind);
          const startWidth = base.width * materialResizeSession.startScaleX;
          const startHeight = base.height * materialResizeSession.startScaleY;

          let nextWidth = startWidth;
          let nextHeight = startHeight;

          const isCorner = materialResizeSession.handle.length === 2;
          const signX = materialResizeSession.handle.includes("e") ? 1 : materialResizeSession.handle.includes("w") ? -1 : 0;
          const signY = materialResizeSession.handle.includes("s") ? 1 : materialResizeSession.handle.includes("n") ? -1 : 0;

          if (isCorner) {
            // scale proportionally using the dominant delta
            const delta = Math.abs(dxPercent) > Math.abs(dyPercent) ? dxPercent * signX : dyPercent * signY;
            nextWidth = startWidth + delta;
            nextHeight = startHeight + delta;
          } else {
            if (signX !== 0) nextWidth = startWidth + signX * dxPercent;
            if (signY !== 0) nextHeight = startHeight + signY * dyPercent;
          }

          const minSize = 0.5; // percent-based min width/height
          const minScaleX = (minSize) / Math.max(0.01, base.width);
          const minScaleY = (minSize) / Math.max(0.01, base.height);

          const nextScaleX = Math.max(0.3, Math.min(4, nextWidth / base.width));
          const nextScaleY = Math.max(0.3, Math.min(4, nextHeight / base.height));

          // adjust center position to account for size change
          const widthDelta = (nextScaleX - materialResizeSession.startScaleX) * base.width;
          const heightDelta = (nextScaleY - materialResizeSession.startScaleY) * base.height;

          const shiftX = (widthDelta / 2) * (signX === 0 ? 0 : signX);
          const shiftY = (heightDelta / 2) * (signY === 0 ? 0 : signY);

          return {
            ...m,
            scaleX: nextScaleX,
            scaleY: nextScaleY,
            x: materialResizeSession.startX + shiftX,
            y: materialResizeSession.startY + shiftY,
          };
        }),
      );
    };

    const handleMouseUp = () => setMaterialResizeSession(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [materialResizeSession]);

  const [chapaResizeSession, setChapaResizeSession] = useState<
    | {
        playerId: string;
        handle: ResizeHandle;
        startClientX: number;
        startClientY: number;
        startScaleX: number;
        startScaleY: number;
        startX: number;
        startY: number;
        rotationDeg: number;
      }
    | null
  >(null);

  const handleChapaResizeStart = (
    e: React.MouseEvent<HTMLButtonElement> | React.MouseEvent<HTMLElement>,
    playerId: string,
    handle: ResizeHandle,
  ) => {
    const chapa = placedChapas[playerId];
    if (!chapa || chapa.locked) return;
    e.preventDefault();
    e.stopPropagation();
    setChapaResizeSession({
      playerId,
      handle,
      startClientX: (e as React.MouseEvent).clientX,
      startClientY: (e as React.MouseEvent).clientY,
      startScaleX: chapa.scaleX ?? 1,
      startScaleY: chapa.scaleY ?? 1,
      startX: chapa.x,
      startY: chapa.y,
      rotationDeg: chapa.rotation ?? 0,
    });
  };

  useEffect(() => {
    if (!chapaResizeSession) return;

    const handleMouseMove = (ev: MouseEvent) => {
      const pitch = halfPitchRef.current;
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();
      const dxPx = ev.clientX - chapaResizeSession.startClientX;
      const dyPx = ev.clientY - chapaResizeSession.startClientY;
      const dxPercent = (dxPx / rect.width) * 100;
      const dyPercent = (dyPx / rect.height) * 100;

      setPlacedChapas((prev) => {
        const next = { ...prev };
        const chapa = next[chapaResizeSession.playerId];
        if (!chapa) return prev;

        const base = getChapaSizePercent();
        const startWidth = base.width * chapaResizeSession.startScaleX;
        const startHeight = base.height * chapaResizeSession.startScaleY;

        let nextWidth = startWidth;
        let nextHeight = startHeight;

        const isCorner = chapaResizeSession.handle.length === 2;
        const signX = chapaResizeSession.handle.includes("e") ? 1 : chapaResizeSession.handle.includes("w") ? -1 : 0;
        const signY = chapaResizeSession.handle.includes("s") ? 1 : chapaResizeSession.handle.includes("n") ? -1 : 0;

        const angle = (chapaResizeSession.rotationDeg * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const localDx = dxPercent * cos + dyPercent * sin;
        const localDy = -dxPercent * sin + dyPercent * cos;

        if (isCorner) {
          const deltaW = signX * localDx;
          const deltaH = signY * localDy;
          const ratioW = (startWidth + deltaW) / Math.max(0.0001, startWidth);
          const ratioH = (startHeight + deltaH) / Math.max(0.0001, startHeight);
          const scaleFactor = Math.max(0.05, Math.min(ratioW, ratioH));
          nextWidth = startWidth * scaleFactor;
          nextHeight = startHeight * scaleFactor;
        } else {
          if (signX !== 0) nextWidth = startWidth + signX * localDx;
          if (signY !== 0) nextHeight = startHeight + signY * localDy;
        }

        const nextScaleX = Math.max(0.3, Math.min(4, nextWidth / base.width));
        const nextScaleY = Math.max(0.3, Math.min(4, nextHeight / base.height));

        const widthDelta = (nextScaleX - chapaResizeSession.startScaleX) * base.width;
        const heightDelta = (nextScaleY - chapaResizeSession.startScaleY) * base.height;

        const localShiftX = signX === 0 ? 0 : (widthDelta / 2) * signX;
        const localShiftY = signY === 0 ? 0 : (heightDelta / 2) * signY;

        const shiftX = localShiftX * cos - localShiftY * sin;
        const shiftY = localShiftX * sin + localShiftY * cos;

        const movedX = chapaResizeSession.startX + shiftX;
        const movedY = chapaResizeSession.startY + shiftY;

        const { touchlineBand, goalBackBand } = getFieldBands();
        const clamped = clampChapaToPlayableArea(movedX, movedY, touchlineBand, goalBackBand, nextScaleX, nextScaleY);

        next[chapaResizeSession.playerId] = {
          ...chapa,
          scaleX: nextScaleX,
          scaleY: nextScaleY,
          x: clamped.x,
          y: clamped.y,
        };

        return next;
      });
    };

    const handleMouseUp = () => setChapaResizeSession(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [chapaResizeSession]);

  const handleMaterialDragEnd = () => setDraggingMaterialId(null);

  const handlePlacedMaterialDragEnd = (e: React.DragEvent<HTMLElement>, materialId: string) => {
    setDraggingMaterialId(null);
    if (halfPitchRef.current) {
      const rect = halfPitchRef.current.getBoundingClientRect();
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) removePlacedMaterial(materialId);
    }
  };

  // ─── Field drop handler ───────────────────────────────────────────────────

  const handleFieldDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleFieldDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const materialTemplateKind = e.dataTransfer.getData("text/material-template-kind");
    if (materialTemplateKind && isMaterialKind(materialTemplateKind)) {
      createMaterialAtPoint(materialTemplateKind, e.clientX, e.clientY);
      setDraggingMaterialId(null);
      return;
    }

    const materialId = e.dataTransfer.getData("text/material-instance-id");
    if (materialId) {
      movePlacedMaterial(materialId, e.clientX, e.clientY);
      setDraggingMaterialId(null);
      return;
    }

    const templateKind = e.dataTransfer.getData("text/space-template-kind");
    if (templateKind && isSpaceKind(templateKind)) {
      createSpaceAtPoint(templateKind, e.clientX, e.clientY);
      setDraggingSpaceId(null);
      return;
    }

    const spaceId = e.dataTransfer.getData("text/space-instance-id");
    if (spaceId) {
      movePlacedSpace(spaceId, e.clientX, e.clientY);
      spaceDragOffsetRef.current = null;
      setDraggingSpaceId(null);
      return;
    }

    const playerId = e.dataTransfer.getData("text/chapa-player-id");
    if (playerId) {
      const isAnonymous = placedChapas[playerId]?.anonymous === true;
      placeChapaAtClientPoint(playerId, e.clientX, e.clientY, isAnonymous);
      setDraggingChapaId(null);
      return;
    }

    const anonymousColor = e.dataTransfer.getData("text/chapa-anonymous-color");
    if (!anonymousColor) return;
    const anonymousKey = e.dataTransfer.getData("text/chapa-anonymous-key") || anonymousColor;
    const anonymousId = makeAnonymousChapaId(anonymousKey);
    placeChapaAtClientPoint(anonymousId, e.clientX, e.clientY, true);
    setChapaPetoById((prev) => ({ ...prev, [anonymousId]: anonymousColor }));
    setDraggingChapaId(null);
  };

  // ─── Line drawing ─────────────────────────────────────────────────────────

  const getFieldPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const pitch = halfPitchRef.current;
    if (!pitch) return null;
    const rect = pitch.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleDrawMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeLineKind) return;
    e.preventDefault();
    const pt = getFieldPoint(e.clientX, e.clientY);
    if (!pt) return;
    setDrawingState({
      kind: activeLineKind,
      color: activeLineColor,
      x1: pt.x,
      y1: pt.y,
      x2: pt.x,
      y2: pt.y,
      points: activeLineKind === "free" ? [pt] : undefined,
    });
  };

  const handleDrawMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingState) return;
    const pt = getFieldPoint(e.clientX, e.clientY);
    if (!pt) return;
    if (drawingState.kind === "free") {
      setDrawingState((prev) =>
        prev ? { ...prev, x2: pt.x, y2: pt.y, points: [...(prev.points ?? []), pt] } : null,
      );
    } else {
      setDrawingState((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : null));
    }
  };

  const handleDrawMouseUp = () => {
    if (!drawingState) return;
    const { kind, color, x1, y1, x2, y2, points } = drawingState;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 1) {
      setDrawingState(null);
      return;
    }
    const id =
      typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `line-${Date.now()}`;
    const newLine: PlacedLine = { id, kind, color, x1, y1, x2, y2 };
    if (kind === "curved") {
      newLine.cx = (x1 + x2) / 2 + (y2 - y1) * 0.3;
      newLine.cy = (y1 + y2) / 2 - (x2 - x1) * 0.3;
    }
    if (kind === "free" && points && points.length > 1) {
      newLine.points = points;
    }
    setPlacedLines((prev) => [...prev, newLine]);
    setDrawingState(null);
  };

  const duplicatePlacedLine = (lineId: string) => {
    const src = placedLines.find((l) => l.id === lineId);
    if (!src) return;
    const dx = 2;
    const dy = 2;
    const duplicatedId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `line-${Date.now()}-${Math.random()}`;
    setPlacedLines((prev) => [
      ...prev,
      {
        ...src,
        id: duplicatedId,
        x1: Math.max(0, Math.min(100, src.x1 + dx)),
        y1: Math.max(0, Math.min(100, src.y1 + dy)),
        x2: Math.max(0, Math.min(100, src.x2 + dx)),
        y2: Math.max(0, Math.min(100, src.y2 + dy)),
      },
    ]);
  };

  const removePlacedLine = (lineId: string) => {
    setPlacedLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const setPlacedLineColor = (lineId: string, color: string) => {
    setPlacedLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, color } : l)));
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerResponse>();
    players.forEach((player) => {
      if (player.id) map.set(player.id, player);
    });
    return map;
  }, [players]);

  const availablePlayersForStrip = useMemo(
    () => players.filter((player) => !player.id || !placedChapas[player.id]),
    [players, placedChapas],
  );

  return {
    // Visibility
    showChapas,
    showSpaces,
    showMaterials,
    showLines,
    handleToggleChapas,
    handleToggleSpaces,
    handleToggleMaterials,
    handleToggleLines,
    loadBoardStateJson,
    serializeBoardStateJson,
    // Chapas
    players,
    loadingPlayers,
    chapasError,
    placedChapas,
    draggingChapaId,
    chapaPetoById,
    activeChapaMenuId,
    setActiveChapaMenuId,
    playersById,
    availablePlayersForStrip,
    anonymousChapaOptions,
    handleChapaDragStart,
    handleAnonymousChapaDragStart,
    handleChapaDragEnd,
    handleToggleChapaMenu,
    handleSetChapaPeto,
    handleClearChapaPeto,
    duplicatePlacedChapa,
    toggleLockPlacedChapa,
    rotatePlacedChapa,
    handleManualResizeChapa,
    handleChapaResizeStart,
    removePlacedChapa,
    // Spaces
    placedSpaces,
    draggingSpaceId,
    handleSpaceTemplateDragStart,
    handleSpaceDragEnd,
    handlePlacedSpaceDragStart,
    handlePlacedSpaceDragEnd,
    handleResizeStart,
    toggleLockPlacedSpace,
    handleManualResize,
    rotatePlacedSpace,
    duplicatePlacedSpace,
    removePlacedSpace,
    setPlacedSpaceColor,
    nudgePlacedSpace,
    // Materials
    placedMaterials,
    draggingMaterialId,
    handleMaterialTemplateDragStart,
    handleMaterialDragEnd,
    handlePlacedMaterialDragStart,
    handlePlacedMaterialDragEnd,
    rotatePlacedMaterial,
    duplicatePlacedMaterial,
    toggleLockPlacedMaterial,
    handleManualResizeMaterial,
    scalePlacedMaterial,
    handleMaterialResizeStart,
    removePlacedMaterial,
    // Lines
    placedLines,
    setPlacedLines,
    duplicatePlacedLine,
    removePlacedLine,
    setPlacedLineColor,
    activeLineKind,
    setActiveLineKind,
    activeLineColor,
    setActiveLineColor,
    drawingState,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    // Field events
    handleFieldDragOver,
    handleFieldDrop,
  };
}

export type TacticalBoardState = ReturnType<typeof useTacticalBoard>;
