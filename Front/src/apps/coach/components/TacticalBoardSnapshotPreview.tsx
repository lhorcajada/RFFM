import type { TacticalBoardSnapshot } from "../pages/trainings/new/types";
import { LINE_COLORS, SPACE_COLORS } from "../pages/trainings/new/constants";
import { buildLinePath, getArrowMarkerId } from "../pages/trainings/new/helpers/lineHelpers";
import { getChapaSizePercent, getMaterialSizePercent } from "../pages/trainings/new/helpers/materialHelpers";
import { getDimensionsPercent, getShapeVertices } from "../pages/trainings/new/helpers/spaceGeometry";
import { useTeamRoster } from "../hooks/useTeamRoster";
import styles from "./TacticalBoardSnapshotPreview.module.css";

export function tryParseBoardSnapshot(boardStateJson?: string | null): TacticalBoardSnapshot | null {
  if (!boardStateJson) return null;
  try {
    return JSON.parse(boardStateJson) as TacticalBoardSnapshot;
  } catch {
    return null;
  }
}

export function hasBoardObjects(snapshot: TacticalBoardSnapshot | null): boolean {
  if (!snapshot) return false;
  return (
    Object.keys(snapshot.placedChapas ?? {}).length > 0 ||
    (snapshot.placedSpaces?.length ?? 0) > 0 ||
    (snapshot.placedMaterials?.length ?? 0) > 0 ||
    (snapshot.placedLines?.length ?? 0) > 0
  );
}

type Props = {
  snapshot: TacticalBoardSnapshot;
  /** Team whose roster should be used to resolve dorsal/alias for placed chapas. */
  teamId?: string;
};

const previewMarkerId = (color: string) => `preview-${getArrowMarkerId(color)}`;

export default function TacticalBoardSnapshotPreview({ snapshot, teamId }: Props) {
  const { playersById } = useTeamRoster(teamId);

  const chapas = Object.entries(snapshot.placedChapas ?? {});
  const chapaPetoById = snapshot.chapaPetoById ?? {};
  const spaces = snapshot.placedSpaces ?? [];
  const materials = snapshot.placedMaterials ?? [];
  const lines = snapshot.placedLines ?? [];

  return (
    <div className={styles.board} aria-label="Vista previa de la pizarra">
      <div className={styles.pitch}>
        {/* ── Field silhouette (mirrors the editor's half-pitch with goal) ── */}
        <div className={styles.terrainBandTop} />
        <div className={styles.terrainBandBottom} />
        <div className={styles.terrainGoalBack} />
        <div className={styles.touchLineTop} />
        <div className={styles.touchLineBottom} />
        <div className={styles.midLine} />
        <div className={styles.goalLine} />
        <div className={styles.centerCircle} />
        <div className={styles.penaltyArea} />
        <div className={styles.goalArea} />
        <div className={styles.penaltySpot} />
        <div className={styles.penaltyArc} />
        <div className={styles.goalMouth} />
        <div className={styles.goalFrame} />

        {/* ── Spaces ── */}
        {spaces.map((space) => {
          const size = getDimensionsPercent(space.kind, space.scaleX, space.scaleY);
          const vertices = getShapeVertices(space.kind);
          const spaceColor = space.color ?? SPACE_COLORS[0].value;

          return (
            <div
              key={space.id}
              className={styles.spaceShape}
              style={{
                left: `${space.x}%`,
                top: `${space.y}%`,
                width: `${size.width}%`,
                height: `${size.height}%`,
                transform: `translate(-50%, -50%) rotate(${space.rotation}deg)`,
              }}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.spaceSvg}>
                {space.kind === "circle" ? (
                  <circle
                    cx="50"
                    cy="50"
                    r="50"
                    className={styles.spaceStroke}
                    style={{ fill: spaceColor, fillOpacity: 0.2, stroke: spaceColor }}
                  />
                ) : (
                  <polygon
                    points={vertices.map((v) => `${v.x},${v.y}`).join(" ")}
                    className={styles.spaceStroke}
                    style={{ fill: spaceColor, fillOpacity: 0.2, stroke: spaceColor }}
                  />
                )}
              </svg>
            </div>
          );
        })}

        {/* ── Lines (same path builder + arrow markers as the editor) ── */}
        <svg className={styles.linesSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {LINE_COLORS.map((c) => (
              <marker
                key={c.key}
                id={previewMarkerId(c.value)}
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

          {lines.map((line) => {
            const isArrow = line.kind === "arrow" || line.kind === "arrow-dashed";
            const isDashed = line.kind === "dashed" || line.kind === "arrow-dashed";
            return (
              <path
                key={line.id}
                d={buildLinePath(line.kind, line.x1, line.y1, line.x2, line.y2, line.cx, line.cy, line.points)}
                stroke={line.color}
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
                fill="none"
                strokeDasharray={isDashed ? "6 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={isArrow ? `url(#${previewMarkerId(line.color)})` : undefined}
              />
            );
          })}
        </svg>

        {/* ── Materials (per-kind glyph, mirrors the editor's markup) ── */}
        {materials.map((material) => {
          const baseSize = getMaterialSizePercent(material.kind);
          const width = baseSize.width * (material.scaleX ?? 1);
          const height = baseSize.height * (material.scaleY ?? 1);
          const glyphClass = styles[`materialGlyph_${material.kind.replace("-", "")}`];

          return (
            <div
              key={material.id}
              className={styles.materialOnField}
              style={{
                left: `${material.x}%`,
                top: `${material.y}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <div
                className={`${styles.materialGlyph} ${glyphClass ?? ""}`}
                style={{ transform: `rotate(${material.rotation}deg)` }}
              >
                {material.kind === "balones" && <span className={styles.materialBalonShine} />}
                {material.kind === "setas" && <span className={styles.materialSetaHole} />}
                {material.kind === "conos" && <span className={styles.materialConoBase} />}
                {material.kind === "vallas" && (
                  <>
                    <span className={styles.materialVallaLegLeft} />
                    <span className={styles.materialVallaLegRight} />
                    <span className={styles.materialVallaBar} />
                  </>
                )}
                {(material.kind === "miniporterias" || material.kind === "porterias-f11") && (
                  <>
                    <span className={styles.materialGoalPostLeft} />
                    <span className={styles.materialGoalPostRight} />
                    <span className={styles.materialGoalCrossbar} />
                    <span className={styles.materialGoalNet} />
                  </>
                )}
                {material.kind === "picas" && (
                  <>
                    <span className={styles.materialPicaTip} />
                    <span className={styles.materialPicaStick} />
                    <span className={styles.materialPicaBase} />
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Player chapas (dorsal + alias resolved from the team roster) ── */}
        {chapas.map(([playerId, pos], index) => {
          const player = playersById.get(playerId);
          const isAnonymous = pos.anonymous === true;
          const dorsal = player?.dorsal ?? index + 1;
          const alias = (player?.alias ?? "").trim() || `J${index + 1}`;
          const petoColor = chapaPetoById[playerId];
          const baseSize = getChapaSizePercent();
          const chapaScale = Math.max(pos.scaleX ?? 1, pos.scaleY ?? 1);
          const size = baseSize.width * chapaScale;

          return (
            <div
              key={playerId}
              className={styles.chapa}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${Math.max(6, size)}%`,
                transform: `translate(-50%, -50%) rotate(${pos.rotation ?? 0}deg)`,
                background: petoColor
                  ? `linear-gradient(165deg, ${petoColor} 0%, ${petoColor} 100%)`
                  : isAnonymous
                    ? `linear-gradient(160deg, hsl(${(index * 47) % 360} 75% 58%) 0%, hsl(${(index * 47) % 360} 75% 36%) 100%)`
                    : undefined,
              }}
              title={isAnonymous ? "Chapa anónima" : `${dorsal} - ${alias}`}
            >
              {!isAnonymous && <span className={styles.chapaDorsal}>{dorsal}</span>}
              {!isAnonymous && <span className={styles.chapaAliasOutside}>{alias}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
