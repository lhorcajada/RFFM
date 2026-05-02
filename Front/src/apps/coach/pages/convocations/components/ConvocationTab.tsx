import {
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { ExcuseType } from "../../../services/excuseTypeService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import PlayerCromo from "../../squad/components/PlayerCromo";
import type { DropZone } from "./convocationMatchDetail.types";
import styles from "./ConvocationTab.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mgmtRatingColor(v: number): string {
  if (v >= 90) return "#29b6f6";
  if (v >= 70) return "#66bb6a";
  if (v >= 50) return "#ffb300";
  return "#ef5350";
}

function positionOrder(pos: string | null | undefined): number {
  const p = (pos ?? "").toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (
    p.includes("defensa") ||
    p.includes("central") ||
    p.includes("lateral") ||
    p.includes("libero") ||
    p.includes("stopper")
  )
    return 1;
  if (
    p.includes("centrocampista") ||
    p.includes("medio") ||
    p.includes("pivote") ||
    p.includes("interior") ||
    p.includes("volante")
  )
    return 2;
  if (
    p.includes("delantero") ||
    p.includes("extremo") ||
    p.includes("punta") ||
    p.includes("ariete") ||
    p.includes("winger")
  )
    return 3;
  return 4;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  mgmtEventId: string | null;
  mgmtLoadingConv: boolean;
  loadingPlayers: boolean;
  teamAvgRating: number | null;
  mgmtCalled: string[];
  mgmtAvailable: string[];
  mgmtNotCalled: string[];
  players: PlayerResponse[];
  mgmtRatings: Record<string, PlayerRating>;
  mgmtPhotos: Record<string, string | null>;
  mgmtExcuseMap: Record<string, number | null>;
  excuseTypes: ExcuseType[];
  mgmtDragPlayer: string | null;
  mgmtDragOver: DropZone | null;
  onDragStart: (playerId: string) => void;
  onDragEnd: () => void;
  onDragOver: (zone: DropZone) => void;
  onDragLeave: () => void;
  onDrop: (zone: DropZone) => void;
  onExcuseChange: (playerId: string, excuseId: number) => void;
  playerStreaks?: Map<string, number>;
};

const GROUPS = [
  { order: 0, label: "Porteros" },
  { order: 1, label: "Defensas" },
  { order: 2, label: "Medios" },
  { order: 3, label: "Delanteros" },
  { order: 4, label: "Sin posición" },
];

const ZONE_CONFIG: {
  zone: DropZone;
  label: string;
  headerClass: keyof typeof styles;
}[] = [
  { zone: "available", label: "Disponibles", headerClass: "dropColumnHeaderAvailable" },
  { zone: "called", label: "Convocados", headerClass: "dropColumnHeaderCalled" },
  { zone: "notCalled", label: "Desconvocados", headerClass: "dropColumnHeaderNotCalled" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConvocationTab({
  mgmtEventId,
  mgmtLoadingConv,
  loadingPlayers,
  teamAvgRating,
  mgmtCalled,
  mgmtAvailable,
  mgmtNotCalled,
  players,
  mgmtRatings,
  mgmtPhotos,
  mgmtExcuseMap,
  excuseTypes,
  mgmtDragPlayer,
  mgmtDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onExcuseChange,
  playerStreaks,
}: Props) {
  if (mgmtLoadingConv || loadingPlayers) {
    return (
      <div className={styles.convocatoriaTab}>
        <div className={styles.center}>
          <CircularProgress size={32} />
        </div>
      </div>
    );
  }

  if (!mgmtEventId) {
    return (
      <div className={styles.convocatoriaTab}>
        <div className={styles.center}>
          <EmptyState description="No se encontró el partido en el sistema interno. Asegúrate de que el evento esté creado en el área de Partidos del equipo." />
        </div>
      </div>
    );
  }

  function getZoneIds(zone: DropZone): string[] {
    if (zone === "available") return mgmtAvailable;
    if (zone === "called") return mgmtCalled;
    return mgmtNotCalled;
  }

  return (
    <div className={styles.convocatoriaTab}>
      {/* Three drop zones */}
      <div className={styles.dropColumns}>
        {ZONE_CONFIG.map(({ zone, label, headerClass }) => {
          const ids = getZoneIds(zone);
          return (
            <div
              key={zone}
              className={`${styles.dropColumn} ${mgmtDragOver === zone ? styles.dropColumnOver : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOver(zone);
              }}
              onDragLeave={onDragLeave}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(zone);
              }}
            >
              <div className={`${styles.dropColumnHeader} ${styles[headerClass]}`}>
                <span>{label}</span>
                <div className={styles.dropColumnHeaderMeta}>
                  {zone === "called" && teamAvgRating != null && (
                    <span
                      className={styles.calledAvg}
                      style={{ color: mgmtRatingColor(teamAvgRating) }}
                    >
                      {Math.round(teamAvgRating)}
                    </span>
                  )}
                  <span className={styles.dropColumnCount}>{ids.length}</span>
                </div>
              </div>

              <div className={styles.dropColumnBody}>
                {ids.length === 0 && (
                  <div className={styles.dropHint}>Arrastra jugadores aquí</div>
                )}
                {zone === "notCalled"
                  ? ids.map((playerId) => {
                      const p = players.find((pl) => pl.id === playerId);
                      if (!p) return null;
                      const displayName = p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
                      const r = mgmtRatings[playerId];
                      return (
                        <div
                          key={playerId}
                          draggable
                          className={`${styles.draggableCard} ${
                            mgmtDragPlayer === playerId ? styles.draggableCardDragging : ""
                          }`}
                          onDragStart={() => onDragStart(playerId)}
                          onDragEnd={onDragEnd}
                        >
                          <PlayerCromo
                            displayName={displayName}
                            photoSrc={mgmtPhotos[playerId] ?? null}
                            dorsal={p.dorsal ?? null}
                            position={p.position ?? null}
                            injured={p.isInjured === true}
                            rating={
                              r
                                ? {
                                    technical: r.technical,
                                    tactical: r.tactical,
                                    physical: r.physical,
                                    competitiveness: r.competitiveness,
                                  }
                                : null
                            }
                            streakCount={playerStreaks?.get(playerId) ?? null}
                          />
                          {excuseTypes.length > 0 && (
                            <FormControl
                              size="small"
                              fullWidth
                              sx={{ mt: 0.5 }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDragStart={(e) => e.stopPropagation()}
                            >
                              <InputLabel sx={{ fontSize: "0.7rem" }}>Motivo</InputLabel>
                              <Select
                                label="Motivo"
                                value={mgmtExcuseMap[playerId] ?? ""}
                                onChange={(e) => {
                                  onExcuseChange(playerId, e.target.value as number);
                                }}
                                sx={{ fontSize: "0.72rem" }}
                              >
                                {excuseTypes.map((et) => (
                                  <MenuItem
                                    key={et.id}
                                    value={et.id}
                                    sx={{ fontSize: "0.72rem" }}
                                  >
                                    {et.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        </div>
                      );
                    })
                  : GROUPS.flatMap(({ order, label: groupLabel }) => {
                  const sorted = [...ids].sort((a, b) => {
                    const pa = players.find((pl) => pl.id === a)?.position ?? "";
                    const pb = players.find((pl) => pl.id === b)?.position ?? "";
                    return positionOrder(pa) - positionOrder(pb);
                  });
                  const group = sorted.filter((pid) => {
                    const pos = players.find((pl) => pl.id === pid)?.position ?? "";
                    return positionOrder(pos) === order;
                  });
                  if (group.length === 0) return [];
                  return [
                    <div key={`group-${order}`} className={styles.positionGroupLabel}>
                      {groupLabel}
                    </div>,
                    ...group.map((playerId) => {
                      const p = players.find((pl) => pl.id === playerId);
                      if (!p) return null;
                      const displayName = p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
                      const r = mgmtRatings[playerId];
                      return (
                        <div
                          key={playerId}
                          draggable
                          className={`${styles.draggableCard} ${
                            mgmtDragPlayer === playerId ? styles.draggableCardDragging : ""
                          }`}
                          onDragStart={() => onDragStart(playerId)}
                          onDragEnd={onDragEnd}
                        >
                          <PlayerCromo
                            displayName={displayName}
                            photoSrc={mgmtPhotos[playerId] ?? null}
                            dorsal={p.dorsal ?? null}
                            position={p.position ?? null}
                            injured={p.isInjured === true}
                            rating={
                              r
                                ? {
                                    technical: r.technical,
                                    tactical: r.tactical,
                                    physical: r.physical,
                                    competitiveness: r.competitiveness,
                                  }
                                : null
                            }
                            streakCount={playerStreaks?.get(playerId) ?? null}
                          />
                          {zone === "notCalled" &&
                            excuseTypes.length > 0 && (
                              <FormControl
                                size="small"
                                fullWidth
                                sx={{ mt: 0.5 }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.stopPropagation()}
                              >
                                <InputLabel sx={{ fontSize: "0.7rem" }}>Motivo</InputLabel>
                                <Select
                                  label="Motivo"
                                  value={mgmtExcuseMap[playerId] ?? ""}
                                  onChange={(e) => {
                                    onExcuseChange(playerId, e.target.value as number);
                                  }}
                                  sx={{ fontSize: "0.72rem" }}
                                >
                                  {excuseTypes.map((et) => (
                                    <MenuItem
                                      key={et.id}
                                      value={et.id}
                                      sx={{ fontSize: "0.72rem" }}
                                    >
                                      {et.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                        </div>
                      );
                    }),
                  ];
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
