import { Box, Typography } from "@mui/material";
import type React from "react";
import { useState } from "react";
import { LINE_COLORS, petoOptions } from "../constants";
import { buildLinePath, getArrowMarkerId } from "../helpers/lineHelpers";
import { getMaterialSizePercent } from "../helpers/materialHelpers";
import { getDimensionsPercent, formatMeters, getSideLengthsMeters, getShapeVertices } from "../helpers/spaceGeometry";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import styles from "../NewExercisePage.module.css";
import type { ResizeHandle, SpacePosition } from "../types";

interface TacticalFieldProps {
  halfPitchRef: React.RefObject<HTMLDivElement | null>;
  board: TacticalBoardState;
}

export default function TacticalField({ halfPitchRef, board }: TacticalFieldProps) {
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

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
    placedMaterials,
    draggingMaterialId,
    handlePlacedMaterialDragStart,
    handlePlacedMaterialDragEnd,
    rotatePlacedMaterial,
    placedLines,
    setPlacedLines,
    drawingState,
    showLines,
    activeLineKind,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    handleFieldDragOver,
    handleFieldDrop,
  } = board;

  return (
    <Box
      ref={halfPitchRef}
      className={styles.halfPitch}
      onDragOver={handleFieldDragOver}
      onDrop={handleFieldDrop}
      onClick={() => { setActiveChapaMenuId(null); setActiveMaterialId(null); }}
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
        const dorsal = player?.dorsal ?? idx + 1;
        const alias = (player?.alias ?? "").trim() || `J${idx + 1}`;
        const petoColor = chapaPetoById[playerId];

        return (
          <Box
            key={`placed-${playerId}`}
            className={`${styles.chapa} ${styles.chapaOnField} ${draggingChapaId === playerId ? styles.chapaDragging : ""}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: petoColor
                ? `linear-gradient(165deg, ${petoColor} 0%, ${petoColor} 100%)`
                : undefined,
            }}
            draggable
            onDragStart={(e) => handleChapaDragStart(e, playerId)}
            onDragEnd={(e) => handleChapaDragEnd(e, playerId)}
            onClick={(e) => handleToggleChapaMenu(e, playerId)}
            title={`${dorsal} - ${alias}`}
          >
            <span className={styles.chapaDorsal}>{dorsal}</span>
            <span className={styles.chapaAliasOutside}>{alias}</span>

            {activeChapaMenuId === playerId && (
              <Box className={styles.chapaPetoMenu} onClick={(e) => e.stopPropagation()}>
                <Typography className={styles.chapaPetoMenuTitle}>Petos</Typography>
                <Box className={styles.chapaPetoGrid}>
                  {petoOptions.map((peto) => (
                    <button
                      key={`${playerId}-${peto.key}`}
                      type="button"
                      className={styles.chapaPetoSwatch}
                      style={{ backgroundColor: peto.color }}
                      onClick={(e) => handleSetChapaPeto(e, playerId, peto.color)}
                      title={peto.label}
                      aria-label={`Peto ${peto.label}`}
                    />
                  ))}
                </Box>
                <button
                  type="button"
                  className={styles.chapaPetoClearBtn}
                  onClick={(e) => handleClearChapaPeto(e, playerId)}
                >
                  Quitar peto
                </button>
              </Box>
            )}
          </Box>
        );
      })}

      {placedSpaces.map((space) => {
        const size = getDimensionsPercent(space.kind, space.scaleX, space.scaleY);
        const vertices = getShapeVertices(space.kind);
        const sideLengths = getSideLengthsMeters(space.kind, space.scaleX, space.scaleY);

        return (
          <Box
            key={space.id}
            className={`${styles.spaceShape} ${draggingSpaceId === space.id ? styles.spaceDragging : ""}`}
            style={{
              left: `${space.x}%`,
              top: `${space.y}%`,
              width: `${size.width}%`,
              height: `${size.height}%`,
              transform: "translate(-50%, -50%)",
            }}
            draggable={!space.locked}
            onDragStart={(e) => handlePlacedSpaceDragStart(e, space.id)}
            onDragEnd={(e) => handlePlacedSpaceDragEnd(e, space.id)}
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
                  <circle cx="50" cy="50" r="50" className={styles.spaceStroke} />
                ) : (
                  <polygon
                    points={vertices.map((v) => `${v.x},${v.y}`).join(" ")}
                    className={styles.spaceStroke}
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

            <SpaceControls
              space={space}
              onLock={toggleLockPlacedSpace}
              onManualResize={handleManualResize}
              onRotate={rotatePlacedSpace}
              onDuplicate={duplicatePlacedSpace}
              onRemove={removePlacedSpace}
            />
          </Box>
        );
      })}

      {placedMaterials.map((material) => {
        const size = getMaterialSizePercent(material.kind);

        return (
          <Box
            key={material.id}
            className={`${styles.materialOnField} ${draggingMaterialId === material.id ? styles.materialDragging : ""}`}
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
            onClick={(e) => { e.stopPropagation(); setActiveMaterialId(material.id); }}
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
              <button
                type="button"
                className={styles.materialRotateBtn}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  rotatePlacedMaterial(material.id);
                }}
                title="Girar"
                aria-label="Girar"
              >
                ↻
              </button>
            )}
          </Box>
        );
      })}

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
          return (
            <path
              key={line.id}
              d={buildLinePath(
                line.kind,
                line.x1,
                line.y1,
                line.x2,
                line.y2,
                line.cx,
                line.cy,
                line.points,
              )}
              stroke={line.color}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              fill="none"
              strokeDasharray={isDashed ? "6 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={markerId ? `url(#${markerId})` : undefined}
              style={{
                pointerEvents: showLines && !activeLineKind ? "stroke" : "none",
                cursor: "pointer",
              }}
              onClick={() => setPlacedLines((prev) => prev.filter((l) => l.id !== line.id))}
            />
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
}

function SpaceControls({ space, onLock, onManualResize, onRotate, onDuplicate, onRemove }: SpaceControlsProps) {
  return (
    <Box className={styles.spaceScaleControls}>
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
