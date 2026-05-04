import { useEffect, useMemo, useState } from "react";
import type React from "react";
import teamplayerService, { type PlayerResponse } from "../../../../services/teamplayerService";
import { FIELD_WIDTH_METERS, HALF_FIELD_LENGTH_METERS } from "../constants";
import { getMaterialSizePercent, isMaterialKind } from "../helpers/materialHelpers";
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
  ResizeHandle,
  ResizeSession,
  SpaceKind,
  SpacePosition,
} from "../types";

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
  const [resizeSession, setResizeSession] = useState<ResizeSession | null>(null);

  const [showMaterials, setShowMaterials] = useState(false);
  const [placedMaterials, setPlacedMaterials] = useState<PlacedMaterial[]>([]);
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);

  const [showLines, setShowLines] = useState(false);
  const [placedLines, setPlacedLines] = useState<PlacedLine[]>([]);
  const [activeLineKind, setActiveLineKind] = useState<LineKind | null>(null);
  const [activeLineColor, setActiveLineColor] = useState<string>("#ffffff");
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);

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
  ) => {
    const playableLeft = 0;
    const playableRight = 100 - goalBackBand;
    const playableTop = touchlineBand;
    const playableBottom = 100 - touchlineBand;

    const size = getMaterialSizePercent(kind);
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;

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

  // ─── Toggle handlers ─────────────────────────────────────────────────────

  const handleToggleChapas = async () => {
    const nextOpen = !showChapas;
    setShowChapas(nextOpen);
    if (nextOpen) {
      setShowSpaces(false);
      setShowMaterials(false);
      setShowLines(false);
      setActiveLineKind(null);
      setDrawingState(null);
    }
    if (!nextOpen || players.length > 0) return;

    if (!teamId) {
      setChapasError("No hay equipo seleccionado para mostrar jugadores.");
      return;
    }

    setLoadingPlayers(true);
    setChapasError(null);
    try {
      const teamPlayers = await teamplayerService.getPlayersByTeam(teamId);
      setPlayers(teamPlayers);
    } catch {
      setChapasError("No se pudieron cargar los jugadores.");
      setPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
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
      { id, kind, x: clamped.x, y: clamped.y, scaleX: nextScaleX, scaleY: nextScaleY, rotation: 0, locked: false },
    ]);
  };

  const movePlacedSpace = (spaceId: string, clientX: number, clientY: number) => {
    const raw = getRawDropPosition(clientX, clientY);
    if (!raw) return;

    const { touchlineBand, goalBackBand } = getFieldBands();

    const snapByVertices = (
      draft: SpacePosition,
      others: SpacePosition[],
      thresholdPercent = 0.9,
    ) => {
      const selfVertices = getSpaceVerticesPercent(draft, touchlineBand, goalBackBand);
      if (selfVertices.length === 0 || others.length === 0) return draft;

      let bestDistance = Number.POSITIVE_INFINITY;
      let bestDelta: { dx: number; dy: number } | null = null;

      others.forEach((other) => {
        const otherVertices = getSpaceVerticesPercent(other, touchlineBand, goalBackBand);
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
          raw.x,
          raw.y,
          touchlineBand,
          goalBackBand,
        );

        return snapByVertices({ ...space, x: clamped.x, y: clamped.y }, others);
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
      { ...source, id: duplicatedId, x: clampedPos.x, y: clampedPos.y },
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

    setPlacedMaterials((prev) => [...prev, { id, kind, x: clamped.x, y: clamped.y, rotation: 0 }]);
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

  // ─── Chapa operations ─────────────────────────────────────────────────────

  const placeChapaAtClientPoint = (playerId: string, clientX: number, clientY: number) => {
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

    setPlacedChapas((prev) => ({ ...prev, [playerId]: { x, y } }));
  };

  const handleChapaDragStart = (e: React.DragEvent<HTMLElement>, playerId: string) => {
    e.dataTransfer.setData("text/chapa-player-id", playerId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingChapaId(playerId);
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
        setPlacedChapas((prev) => {
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }
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
    e.dataTransfer.setData("text/space-instance-id", spaceId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingSpaceId(spaceId);
  };

  const handleSpaceDragEnd = () => setDraggingSpaceId(null);

  const handlePlacedSpaceDragEnd = (e: React.DragEvent<HTMLElement>, spaceId: string) => {
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
      setDraggingSpaceId(null);
      return;
    }

    const playerId = e.dataTransfer.getData("text/chapa-player-id");
    if (!playerId) return;
    placeChapaAtClientPoint(playerId, e.clientX, e.clientY);
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
    handleChapaDragStart,
    handleChapaDragEnd,
    handleToggleChapaMenu,
    handleSetChapaPeto,
    handleClearChapaPeto,
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
    // Materials
    placedMaterials,
    draggingMaterialId,
    handleMaterialTemplateDragStart,
    handleMaterialDragEnd,
    handlePlacedMaterialDragStart,
    handlePlacedMaterialDragEnd,
    rotatePlacedMaterial,
    // Lines
    placedLines,
    setPlacedLines,
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
