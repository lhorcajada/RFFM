import { Box, Typography } from "@mui/material";
import React, { useState, useEffect, useRef } from "react";
import { LINE_COLORS, SPACE_COLORS, petoOptions } from "../constants";
import { buildLinePath, getArrowMarkerId } from "../helpers/lineHelpers";
import { getMaterialSizePercent, getChapaSizePercent } from "../helpers/materialHelpers";
import { getDimensionsPercent, formatMeters, getSideLengthsMeters, getShapeVertices } from "../helpers/spaceGeometry";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import styles from "../NewExercisePage.module.css";
import PlacedObjectControls from "./PlacedObjectControls";
import type { ResizeHandle, SpacePosition } from "../types";

interface TacticalFieldProps {
  halfPitchRef: React.RefObject<HTMLDivElement | null>;
  board: TacticalBoardState;
}

export default function TacticalField({ halfPitchRef, board }: TacticalFieldProps) {
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeSpaceMenuId, setActiveSpaceMenuId] = useState<string | null>(null);
  const [activeChapaColorMenuId, setActiveChapaColorMenuId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>("");
  const [lineResizeSession, setLineResizeSession] = useState<
    | { lineId: string; endpoint: "a" | "b"; startClientX: number; startClientY: number }
    | null
  >(null);

  const [lineDragSession, setLineDragSession] = useState<
    | {
        lineId: string;
        startClientX: number;
        startClientY: number;
        startX1: number;
        startY1: number;
        startX2: number;
        startY2: number;
      }
    | null
  >(null);

  const lineDidMoveRef = useRef(false);
  const justDraggedLineRef = useRef<string | null>(null);

  const handleSpaceKeyNudge = (key: string, shiftKey: boolean, preventDefault: () => void) => {
    if (!activeSpaceId) return;

    const pitch = halfPitchRef.current;
    if (!pitch) return;

    const rect = pitch.getBoundingClientRect();
    const baseStepPx = shiftKey ? 10 : 2;
    const stepX = (baseStepPx / rect.width) * 100;
    const stepY = (baseStepPx / rect.height) * 100;

    if (key === "ArrowLeft") {
      preventDefault();
      nudgePlacedSpace(activeSpaceId, -stepX, 0);
    } else if (key === "ArrowRight") {
      preventDefault();
      nudgePlacedSpace(activeSpaceId, stepX, 0);
    } else if (key === "ArrowUp") {
      preventDefault();
      nudgePlacedSpace(activeSpaceId, 0, -stepY);
    } else if (key === "ArrowDown") {
      preventDefault();
      nudgePlacedSpace(activeSpaceId, 0, stepY);
    }
  };
 

  const {
    placedChapas,
    playersById,
    chapaPetoById,
    draggingChapaId,
    activeChapaMenuId,
    setActiveChapaMenuId,
    handleChapaDragStart,
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
    placedSpaces,
    draggingSpaceId,
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
    placedMaterials,
    draggingMaterialId,
    handlePlacedMaterialDragStart,
    handlePlacedMaterialDragEnd,
    rotatePlacedMaterial,
    duplicatePlacedMaterial,
    toggleLockPlacedMaterial,
    handleMaterialResizeStart,
    handleManualResizeMaterial,
    scalePlacedMaterial,
    removePlacedMaterial,
    placedLines,
    setPlacedLines,
    duplicatePlacedLine,
    removePlacedLine,
    setPlacedLineColor,
    drawingState,
    activeLineKind,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    placedTexts,
    editingTextId,
    setEditingTextId,
    draggingTextId,
    updatePlacedText,
    removePlacedText,
    handlePlacedTextDragStart,
    handlePlacedTextDragEnd,
    handleTextResizeStart,
    duplicatePlacedText,
    rotatePlacedText,
    toggleLockPlacedText,
    handleTextFieldClick,
    handleFieldDragOver,
    handleFieldDrop,
  } = board;

  // Attach mousemove/up listeners for line handle dragging (defined after board destructuring)
  useEffect(() => {
    if (!lineResizeSession) return;
    const handleMouseMove = (ev: MouseEvent) => {
      const pitch = halfPitchRef.current;
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      setPlacedLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineResizeSession.lineId) return l;
          if (lineResizeSession.endpoint === "a") {
            return { ...l, x1: Math.max(0, Math.min(100, x)), y1: Math.max(0, Math.min(100, y)) };
          }
          return { ...l, x2: Math.max(0, Math.min(100, x)), y2: Math.max(0, Math.min(100, y)) };
        }),
      );
    };

    const handleMouseUp = () => setLineResizeSession(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [lineResizeSession, halfPitchRef, setPlacedLines]);

  // Drag whole line session: move both endpoints together
  useEffect(() => {
    if (!lineDragSession) return;

    const handleMouseMove = (ev: MouseEvent) => {
      const pitch = halfPitchRef.current;
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();
      const dxPercent = ((ev.clientX - lineDragSession.startClientX) / rect.width) * 100;
      const dyPercent = ((ev.clientY - lineDragSession.startClientY) / rect.height) * 100;

      setPlacedLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineDragSession.lineId) return l;
          const nx1 = Math.max(0, Math.min(100, lineDragSession.startX1 + dxPercent));
          const ny1 = Math.max(0, Math.min(100, lineDragSession.startY1 + dyPercent));
          const nx2 = Math.max(0, Math.min(100, lineDragSession.startX2 + dxPercent));
          const ny2 = Math.max(0, Math.min(100, lineDragSession.startY2 + dyPercent));
          return { ...l, x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
        }),
      );

      lineDidMoveRef.current = true;
    };

    const handleMouseUp = () => {
      if (lineDidMoveRef.current) justDraggedLineRef.current = lineDragSession.lineId;
      setLineDragSession(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [lineDragSession, halfPitchRef, setPlacedLines]);

  useEffect(() => {
    if (editingTextId) {
      const text = placedTexts.find((t) => t.id === editingTextId);
      if (text) {
        setEditingTextValue(text.text);
      }
    }
  }, [editingTextId, placedTexts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      handleSpaceKeyNudge(e.key, e.shiftKey, () => e.preventDefault());
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [activeSpaceId, halfPitchRef, nudgePlacedSpace]);

  return (
    <Box
      ref={halfPitchRef}
      className={styles.halfPitch}
      onDragOver={handleFieldDragOver}
      onDrop={handleFieldDrop}
      onClick={(e) => {
        setActiveChapaMenuId(null);
        setActiveChapaColorMenuId(null);
        setActiveMaterialId(null);
        setActiveSpaceId(null);
        setActiveSpaceMenuId(null);
        setSelectedLineId(null);
        setActiveTextId(null);
        handleTextFieldClick(e);
      }}
    >
      <Box className={styles.terrainBandTop} />
      <Box className={styles.terrainBandBottom} />
      <Box className={styles.terrainGoalBack} />
      <Box className={styles.touchLineTop} />
      <Box className={styles.touchLineBottom} />
      <Box className={styles.midLine} />
      <Box className={styles.goalLine} />
      <Box className={styles.centerCircle} />
      <Box className={styles.penaltyArea} />
      <Box className={styles.goalArea} />
      <Box className={styles.penaltySpot} />
      <Box className={styles.penaltyArc} />
      <Box className={styles.goalMouth} />
      <Box className={styles.goalFrame} />

      {Object.entries(placedChapas).map(([playerId, pos], idx) => {
        const player = playersById.get(playerId);
        const isAnonymous = pos.anonymous === true;
        const dorsal = player?.dorsal ?? idx + 1;
        const alias = (player?.alias ?? "").trim() || `J${idx + 1}`;
        const petoColor = chapaPetoById[playerId];
        const baseSize = getChapaSizePercent();
        const chapaScale = Math.max(pos.scaleX ?? 1, pos.scaleY ?? 1);
        const size = baseSize.width * chapaScale;

        return (
          <Box
            key={`placed-${playerId}`}
            className={`${styles.chapa} ${styles.chapaOnField} ${draggingChapaId === playerId ? styles.chapaDragging : ""} ${activeChapaMenuId === playerId || activeChapaColorMenuId === playerId ? styles.chapaSelected : ""}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${size}%`,
              transform: `translate(-50%, -50%) rotate(${pos.rotation ?? 0}deg)`,
              background: petoColor
                ? `linear-gradient(165deg, ${petoColor} 0%, ${petoColor} 100%)`
                : undefined,
            }}
            draggable={!pos.locked}
            onDragStart={(e) => handleChapaDragStart(e, playerId)}
            onDragEnd={(e) => handleChapaDragEnd(e, playerId)}
            onClick={(e) => {
              setActiveMaterialId(null);
              setActiveSpaceId(null);
              setActiveSpaceMenuId(null);
              setSelectedLineId(null);
              handleToggleChapaMenu(e, playerId);
            }}
            title={isAnonymous ? "Chapa anónima" : `${dorsal} - ${alias}`}
          >
            {!isAnonymous && <span className={styles.chapaDorsal}>{dorsal}</span>}
            {!isAnonymous && <span className={styles.chapaAliasOutside}>{alias}</span>}

            {activeChapaMenuId === playerId && (
              <>
                <PlacedObjectControls
                  id={playerId}
                  locked={pos.locked}
                  onLock={toggleLockPlacedChapa}
                  onManualResize={handleManualResizeChapa}
                  onRotate={rotatePlacedChapa}
                  onDuplicate={duplicatePlacedChapa}
                  onRemove={removePlacedChapa}
                  renderExtras={(
                    <button
                      type="button"
                      className={styles.spaceScaleBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveChapaColorMenuId((prev) => (prev === playerId ? null : playerId));
                      }}
                      aria-label="Elegir color del peto"
                      title="Colores"
                    >
                      C
                    </button>
                  )}
                  renderResizeHandles={(
                    ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeHandle[]
                  ).map((handle) => (
                    <button
                      key={`${playerId}-handle-${handle}`}
                      type="button"
                      className={`${styles.spaceResizeAnchor} ${styles[`spaceResize${handle.toUpperCase()}` as keyof typeof styles]}`}
                      onMouseDown={(e) => handleChapaResizeStart(e, playerId, handle)}
                      aria-label={`Redimensionar por ${handle}`}
                      title="Arrastra borde o esquina para redimensionar"
                    />
                  ))}
                />

                {activeChapaColorMenuId === playerId && (
                  <Box className={styles.chapaPetoMenu} onClick={(e) => e.stopPropagation()}>
                    <Typography className={styles.chapaPetoMenuTitle}>{isAnonymous ? "Colores" : "Petos"}</Typography>
                    <Box className={styles.chapaPetoGrid}>
                      {petoOptions.map((peto) => (
                        <button
                          key={`${playerId}-${peto.key}`}
                          type="button"
                          className={styles.chapaPetoSwatch}
                          style={{ backgroundColor: peto.color }}
                          onClick={(e) => {
                            handleSetChapaPeto(e, playerId, peto.color);
                            setActiveChapaColorMenuId(null);
                          }}
                          title={peto.label}
                          aria-label={`Peto ${peto.label}`}
                        />
                      ))}
                    </Box>
                    {!isAnonymous && (
                      <button
                        type="button"
                        className={styles.chapaPetoClearBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearChapaPeto(e, playerId);
                          setActiveChapaColorMenuId(null);
                        }}
                      >
                        Quitar peto
                      </button>
                    )}
                  </Box>
                )}
              </>
            )}
          </Box>
        );
      })}

      {placedSpaces.map((space) => {
        const size = getDimensionsPercent(space.kind, space.scaleX, space.scaleY);
        const vertices = getShapeVertices(space.kind);
        const sideLengths = getSideLengthsMeters(space.kind, space.scaleX, space.scaleY);
        const spaceColor = space.color ?? SPACE_COLORS[0].value;

        return (
          <Box
            key={space.id}
            className={`${styles.spaceShape} ${draggingSpaceId === space.id ? styles.spaceDragging : ""} ${activeSpaceMenuId === space.id ? styles.spaceMenuOpen : ""} ${activeSpaceId === space.id ? styles.spaceSelected : ""}`}
            style={{
              left: `${space.x}%`,
              top: `${space.y}%`,
              width: `${size.width}%`,
              height: `${size.height}%`,
              transform: "translate(-50%, -50%)",
            }}
            tabIndex={activeSpaceId === space.id ? 0 : -1}
            draggable={!space.locked}
            onDragStart={(e) => handlePlacedSpaceDragStart(e, space.id)}
            onDragEnd={(e) => handlePlacedSpaceDragEnd(e, space.id)}
            onClick={(e) => {
              e.stopPropagation();
              setActiveChapaMenuId(null);
              setActiveChapaColorMenuId(null);
              setActiveMaterialId(null);
              setActiveSpaceId(space.id);
              setSelectedLineId(null);
            }}
            onKeyDown={(e) => handleSpaceKeyNudge(e.key, e.shiftKey, () => e.preventDefault())}
            title={
              space.locked
                ? "Espacio bloqueado"
                : "Arrastra para mover. Usa el asa para redimensionar, y los botones para girar o eliminar"
            }
          >
            <Box
              className={styles.spaceRotatedContent}
              style={{ transform: `rotate(${space.rotation}deg)` }}
            >
              {!space.locked &&
                (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeHandle[]).map((handle) => (
                  <button
                    key={`${space.id}-handle-${handle}`}
                    type="button"
                    className={`${styles.spaceResizeAnchor} ${styles[`spaceResize${handle.toUpperCase()}` as keyof typeof styles]}`}
                    onMouseDown={(e) => handleResizeStart(e, space, handle)}
                    aria-label={`Redimensionar por ${handle}`}
                    title="Arrastra borde o esquina para redimensionar"
                  />
                ))}

              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.spaceSvg}>
                {space.kind === "circle" ? (
                  <circle
                    cx="50"
                    cy="50"
                    r="50"
                    className={styles.spaceStroke}
                    style={{ fill: spaceColor, fillOpacity: 0.18, stroke: spaceColor }}
                  />
                ) : (
                  <polygon
                    points={vertices.map((v) => `${v.x},${v.y}`).join(" ")}
                    className={styles.spaceStroke}
                    style={{ fill: spaceColor, fillOpacity: 0.18, stroke: spaceColor }}
                  />
                )}
              </svg>

              {space.kind === "circle" ? (
                <span className={styles.spaceDistance} style={{ left: "50%", top: "12%" }}>
                  D {formatMeters(sideLengths[0])} x {formatMeters(sideLengths[1])} m
                </span>
              ) : (
                vertices.map((vertex, idx) => {
                  const next = vertices[(idx + 1) % vertices.length];
                  const midX = (vertex.x + next.x) / 2;
                  const midY = (vertex.y + next.y) / 2;
                  return (
                    <span
                      key={`${space.id}-distance-${idx}`}
                      className={styles.spaceDistance}
                      style={{ left: `${midX}%`, top: `${midY}%` }}
                    >
                      {formatMeters(sideLengths[idx])} m
                    </span>
                  );
                })
              )}
            </Box>

            {activeSpaceId === space.id && (
              <PlacedObjectControls
                id={space.id}
                locked={space.locked}
                onLock={toggleLockPlacedSpace}
                onManualResize={handleManualResize}
                onRotate={rotatePlacedSpace}
                onDuplicate={duplicatePlacedSpace}
                onRemove={removePlacedSpace}
                renderExtras={(
                  <button
                    type="button"
                    className={styles.spaceScaleBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSpaceMenuId((prev) => (prev === space.id ? null : space.id));
                    }}
                    aria-label="Elegir color del espacio"
                    title="Colores"
                  >
                    C
                  </button>
                )}
                renderResizeHandles={(
                  ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeHandle[]
                ).map((handle) => (
                  <button
                    key={`${space.id}-handle-${handle}`}
                    type="button"
                    className={`${styles.spaceResizeAnchor} ${styles[`spaceResize${handle.toUpperCase()}` as keyof typeof styles]}`}
                    onMouseDown={(e) => handleResizeStart(e, space, handle)}
                    aria-label={`Redimensionar por ${handle}`}
                    title="Arrastra borde o esquina para redimensionar"
                  />
                ))}
              />
            )}

            {activeSpaceMenuId === space.id && (
              <Box className={styles.chapaPetoMenu} onClick={(e) => e.stopPropagation()}>
                <Typography className={styles.chapaPetoMenuTitle}>Colores</Typography>
                <Box className={styles.chapaPetoGrid}>
                  {SPACE_COLORS.map((option) => (
                    <button
                      key={`${space.id}-color-${option.key}`}
                      type="button"
                      className={`${styles.chapaPetoSwatch} ${spaceColor === option.value ? styles.lineColorSwatchActive : ""}`}
                      style={{ backgroundColor: option.value }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!space.locked) {
                          setPlacedSpaceColor(space.id, option.value);
                          setActiveSpaceMenuId(null);
                        }
                      }}
                      title={option.label}
                      aria-label={`Color ${option.label}`}
                      disabled={space.locked}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        );
      })}

      {placedMaterials.map((material) => {
        const baseSize = getMaterialSizePercent(material.kind);
        const size = {
          width: baseSize.width * (material.scaleX ?? 1),
          height: baseSize.height * (material.scaleY ?? 1),
        };

        return (
          <Box
            key={material.id}
            className={`${styles.materialOnField} ${draggingMaterialId === material.id ? styles.materialDragging : ""} ${activeMaterialId === material.id ? styles.materialSelected : ""}`}
            style={{
              left: `${material.x}%`,
              top: `${material.y}%`,
              width: `${size.width}%`,
              height: `${size.height}%`,
            }}
            draggable
            onDragStart={(e) => handlePlacedMaterialDragStart(e, material.id)}
            onDragEnd={(e) => handlePlacedMaterialDragEnd(e, material.id)}
            title="Arrastra para mover"
            onClick={(e) => {
              e.stopPropagation();
              setActiveChapaMenuId(null);
              setActiveChapaColorMenuId(null);
              setActiveSpaceId(null);
              setActiveSpaceMenuId(null);
              setSelectedLineId(null);
              setActiveMaterialId(material.id);
            }}
          >
            <Box
              className={`${styles.materialGlyphOnField} ${styles[`materialGlyph${material.kind.replace("-", "")}` as keyof typeof styles]}`}
              style={{ transform: `rotate(${material.rotation}deg)` }}
            >
              {material.kind === "setas" && <Box className={styles.materialSetaHole} />}
              {material.kind === "vallas" && (
                <>
                  <Box className={styles.materialVallaLegLeft} />
                  <Box className={styles.materialVallaLegRight} />
                  <Box className={styles.materialVallaBar} />
                </>
              )}
              {material.kind === "miniporterias" && (
                <>
                  <Box className={styles.materialGoalPostLeft} />
                  <Box className={styles.materialGoalPostRight} />
                  <Box className={styles.materialGoalCrossbar} />
                  <Box className={styles.materialGoalNet} />
                </>
              )}
              {material.kind === "picas" && (
                <>
                  <Box className={styles.materialPicaTip} />
                  <Box className={styles.materialPicaStick} />
                  <Box className={styles.materialPicaBase} />
                </>
              )}
              {material.kind === "porterias-f11" && (
                <>
                  <Box className={styles.materialGoalPostLeft} />
                  <Box className={styles.materialGoalPostRight} />
                  <Box className={styles.materialGoalCrossbar} />
                  <Box className={styles.materialGoalNet} />
                </>
              )}
            </Box>

            {activeMaterialId === material.id && (
              <PlacedObjectControls
                id={material.id}
                locked={material.locked}
                onLock={toggleLockPlacedMaterial}
                onManualResize={handleManualResizeMaterial}
                onRotate={rotatePlacedMaterial}
                onDuplicate={duplicatePlacedMaterial}
                onRemove={removePlacedMaterial}
                renderResizeHandles={(
                  ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeHandle[]
                ).map((handle) => (
                  <button
                    key={`${material.id}-handle-${handle}`}
                    type="button"
                    className={`${styles.spaceResizeAnchor} ${styles[`spaceResize${handle.toUpperCase()}` as keyof typeof styles]}`}
                    onMouseDown={(e) => handleMaterialResizeStart(e, material, handle)}
                    aria-label={`Redimensionar por ${handle}`}
                    title="Arrastra borde o esquina para redimensionar"
                  />
                ))}
              />
            )}
          </Box>
        );
      })}

      {/* Texts */}
      {placedTexts.map((text) => (
        <Box key={text.id}>
          {editingTextId === text.id ? (
            <textarea
              data-testid={`text-editor-${text.id}`}
              className={styles.placedTextEditor}
              autoFocus
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.currentTarget.value)}
              onBlur={(e) => {
                const newText = editingTextValue.trim();
                if (newText === "") {
                  removePlacedText(text.id);
                } else {
                  updatePlacedText(text.id, { text: newText });
                }
                setEditingTextId(null);
                setEditingTextValue("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const newText = editingTextValue.trim();
                  if (newText === "") {
                    removePlacedText(text.id);
                  } else {
                    updatePlacedText(text.id, { text: newText });
                  }
                  setEditingTextId(null);
                  setEditingTextValue("");
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingTextId(null);
                  setEditingTextValue("");
                }
              }}
              style={{
                position: "absolute",
                left: `${text.x}%`,
                top: `${text.y}%`,
                transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
                fontFamily: text.fontFamily,
                fontSize: `${text.fontSize * text.scaleX}px`,
                fontWeight: text.bold ? 700 : 400,
                fontStyle: text.italic ? "italic" : "normal",
                color: text.color,
              }}
            />
          ) : (
            <div
              data-testid={`placed-text-${text.id}`}
              className={`${styles.placedText} ${activeTextId === text.id ? styles.placedTextSelected : ""}`}
              style={{
                position: "absolute",
                left: `${text.x}%`,
                top: `${text.y}%`,
                transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
                fontFamily: text.fontFamily,
                fontSize: `${text.fontSize * text.scaleX}px`,
                fontWeight: text.bold ? 700 : 400,
                fontStyle: text.italic ? "italic" : "normal",
                color: text.color,
              }}
              draggable={!text.locked}
              onDragStart={(e) => handlePlacedTextDragStart(e, text.id)}
              onDragEnd={(e) => handlePlacedTextDragEnd(e, text.id)}
              onClick={(e) => {
                e.stopPropagation();
                setActiveChapaMenuId(null);
                setActiveChapaColorMenuId(null);
                setActiveMaterialId(null);
                setActiveSpaceId(null);
                setActiveSpaceMenuId(null);
                setSelectedLineId(null);
                setActiveTextId(text.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTextId(text.id);
              }}
            >
              {text.text}
              {activeTextId === text.id && (
                <PlacedObjectControls
                  id={text.id}
                  locked={text.locked}
                  onLock={toggleLockPlacedText}
                  onManualResize={() => {
                    /* Texts don't have manual resize */
                  }}
                  onRotate={rotatePlacedText}
                  onDuplicate={duplicatePlacedText}
                  onRemove={removePlacedText}
                  renderResizeHandles={[
                    <button
                      key={`${text.id}-resize-se`}
                      type="button"
                      className={`${styles.spaceResizeAnchor} ${styles.spaceResizeSE}`}
                      onMouseDown={(e) => handleTextResizeStart(e, text.id)}
                      aria-label="Redimensionar"
                      title="Arrastra para redimensionar"
                    />,
                  ]}
                />
              )}
            </div>
          )}
        </Box>
      ))}

      {/* Lines SVG overlay */}
      <svg
        className={styles.linesSvg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          {LINE_COLORS.map((c) => (
            <marker
              key={c.key}
              id={`line-arrow-${c.key}`}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M 0 0 L 5 2.5 L 0 5 Z" fill={c.value} />
            </marker>
          ))}
        </defs>

              {placedLines.map((line) => {
          const isArrow = line.kind === "arrow" || line.kind === "arrow-dashed";
          const isDashed = line.kind === "dashed" || line.kind === "arrow-dashed";
          const markerId = isArrow ? getArrowMarkerId(line.color) : undefined;
          const pathD = buildLinePath(
            line.kind,
            line.x1,
            line.y1,
            line.x2,
            line.y2,
            line.cx,
            line.cy,
            line.points,
          );
          return (
            <g key={line.id}>
              <path
                d={pathD}
                stroke={line.color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                fill="none"
                strokeDasharray={isDashed ? "6 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={markerId ? `url(#${markerId})` : undefined}
                style={{ pointerEvents: "none" }}
              />
              <path
                data-testid={`line-hit-${line.id}`}
                d={pathD}
                stroke="transparent"
                strokeWidth="8"
                vectorEffect="non-scaling-stroke"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  pointerEvents: activeLineKind ? "none" : "stroke",
                  cursor: "pointer",
                }}
                onMouseDown={(e) => {
                  if (activeLineKind) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveChapaMenuId(null);
                  setActiveChapaColorMenuId(null);
                  setActiveMaterialId(null);
                  setActiveSpaceId(null);
                  setActiveSpaceMenuId(null);
                  setSelectedLineId(line.id);
                  setLineDragSession({
                    lineId: line.id,
                    startClientX: (e as React.MouseEvent).clientX,
                    startClientY: (e as React.MouseEvent).clientY,
                    startX1: line.x1,
                    startY1: line.y1,
                    startX2: line.x2,
                    startY2: line.y2,
                  });
                  lineDidMoveRef.current = false;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (justDraggedLineRef.current === line.id) {
                    justDraggedLineRef.current = null;
                    return;
                  }
                  setSelectedLineId((prev) => (prev === line.id ? null : line.id));
                }}
              />
            </g>
          );
        })}

        {drawingState &&
          (() => {
            const isArrow =
              drawingState.kind === "arrow" || drawingState.kind === "arrow-dashed";
            const isDashed =
              drawingState.kind === "dashed" || drawingState.kind === "arrow-dashed";
            const markerId = isArrow ? getArrowMarkerId(drawingState.color) : undefined;
            return (
              <path
                d={buildLinePath(
                  drawingState.kind,
                  drawingState.x1,
                  drawingState.y1,
                  drawingState.x2,
                  drawingState.y2,
                  undefined,
                  undefined,
                  drawingState.points,
                )}
                stroke={drawingState.color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                fill="none"
                strokeDasharray={isDashed ? "6 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={markerId ? `url(#${markerId})` : undefined}
                opacity={0.75}
                style={{ pointerEvents: "none" }}
              />
            );
          })()}
      </svg>

      {activeLineKind && (
        <div
          className={styles.drawingOverlay}
          onMouseDown={handleDrawMouseDown}
          onMouseMove={handleDrawMouseMove}
          onMouseUp={handleDrawMouseUp}
          onMouseLeave={handleDrawMouseUp}
        />
      )}

      {/* Line endpoint handles for selected line */}
      {selectedLineId &&
        (() => {
          const line = placedLines.find((l) => l.id === selectedLineId);
          if (!line) return null;
          const start = { x: line.x1, y: line.y1 };
          const end = { x: line.x2, y: line.y2 };

          return (
            <>
              {[{ id: "a", pt: start }, { id: "b", pt: end }].map(({ id, pt }) => (
                <button
                  key={`line-handle-${id}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setLineResizeSession({ lineId: selectedLineId as string, endpoint: id as "a" | "b", startClientX: (e as React.MouseEvent).clientX, startClientY: (e as React.MouseEvent).clientY });
                  }}
                  style={{
                    position: "absolute",
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: "#fff",
                    border: "2px solid #4d9de0",
                    zIndex: 30,
                    cursor: "move",
                  }}
                />
              ))}

              {/* Line controls: color swatches and action buttons at the midpoint */}
              {
                (() => {
                  const midX = (start.x + end.x) / 2;
                  const midY = (start.y + end.y) / 2;
                  return (
                    <Box
                      key={`line-controls-${line.id}`}
                      style={{
                        position: "absolute",
                        left: `${midX}%`,
                        top: `${midY}%`,
                        transform: "translate(-50%, -140%)",
                        zIndex: 40,
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        pointerEvents: "auto",
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <Box style={{ display: "flex", gap: 6 }}>
                        {LINE_COLORS.map((c) => (
                          <button
                            key={`line-color-${c.key}`}
                            type="button"
                            className={`${styles.lineColorSwatch} ${line.color === c.value ? styles.lineColorSwatchActive : ""}`}
                            title={c.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlacedLineColor(line.id, c.value);
                            }}
                            style={{ background: c.value }}
                          />
                        ))}
                      </Box>

                      <button
                        type="button"
                        className={styles.spaceScaleBtn}
                        onClick={(e) => { e.stopPropagation(); duplicatePlacedLine(line.id); }}
                        title="Duplicar línea"
                        aria-label="Duplicar línea"
                      >
                        ⧉
                      </button>

                      <button
                        type="button"
                        className={styles.spaceScaleBtn}
                        onClick={(e) => { e.stopPropagation(); removePlacedLine(line.id); setSelectedLineId(null); }}
                        title="Eliminar línea"
                        aria-label="Eliminar línea"
                      >
                        ✕
                      </button>
                    </Box>
                  );
                })()
              }
            </>
          );
        })()}

      
    </Box>
  );
}

// ─── Space Controls sub-component ────────────────────────────────────────────

interface SpaceControlsProps {
  space: SpacePosition;
  onLock: (id: string) => void;
  onManualResize: (id: string) => void;
  onRotate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onSetColor: (id: string, color: string) => void;
}

function SpaceControls({ space, onLock, onManualResize, onRotate, onDuplicate, onRemove, onSetColor }: SpaceControlsProps) {
  const activeColor = space.color ?? SPACE_COLORS[0].value;

  return (
    <Box className={styles.spaceScaleControls}>
      <Box className={styles.linesStripColors} sx={{ flexDirection: "column", gap: 0.5 }}>
        {SPACE_COLORS.map((option) => (
          <button
            key={`${space.id}-color-${option.key}`}
            type="button"
            className={`${styles.lineColorSwatch} ${activeColor === option.value ? styles.lineColorSwatchActive : ""}`}
            title={option.label}
            aria-label={`Color ${option.label}`}
            onClick={(e) => { e.stopPropagation(); if (!space.locked) onSetColor(space.id, option.value); }}
            disabled={space.locked}
            style={{ backgroundColor: option.value }}
          />
        ))}
      </Box>
      <button
        type="button"
        className={styles.spaceScaleBtn}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onLock(space.id); }}
        aria-label={space.locked ? "Desbloquear espacio" : "Bloquear espacio"}
        title={space.locked ? "Desbloquear" : "Bloquear"}
      >
        {space.locked ? "🔓" : "🔒"}
      </button>
      <button
        type="button"
        className={styles.spaceScaleBtn}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onManualResize(space.id); }}
        aria-label="Redimension manual"
        title="Introducir tamano manual"
        disabled={space.locked}
      >
        M
      </button>
      <button
        type="button"
        className={styles.spaceScaleBtn}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRotate(space.id); }}
        aria-label="Girar espacio"
        disabled={space.locked}
      >
        ↻
      </button>
      <button
        type="button"
        className={styles.spaceScaleBtn}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDuplicate(space.id); }}
        aria-label="Duplicar espacio"
        title="Duplicar objeto"
      >
        ⧉
      </button>
      <button
        type="button"
        className={styles.spaceScaleBtn}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(space.id); }}
        aria-label="Eliminar espacio"
      >
        ✕
      </button>
    </Box>
  );
}
