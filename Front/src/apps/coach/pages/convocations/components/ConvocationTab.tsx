import {
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { ExcuseType } from "../../../services/excuseTypeService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import PlayerCromo from "../../squad/components/PlayerCromo";
import type { DropZone } from "./convocationMatchDetail.types";
import type { DeconvokeProposal } from "../utils/deconvokeProposal";
import { formatProposalFactorValue } from "../utils/deconvokeProposal";
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
  proposal: DeconvokeProposal;
  proposalLoading: boolean;
  onApplyProposal: (ids: string[]) => Promise<void>;
  onPrintProposal: () => Promise<void>;
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
  proposal,
  proposalLoading,
  onApplyProposal,
  onPrintProposal,
}: Props) {
  const [showProposal, setShowProposal] = useState(false);
  const [applyingProposal, setApplyingProposal] = useState(false);

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

  const selectedProposalPlayers = proposal.players.filter((p) => p.isSelected);

  function renderCard(item: (typeof proposal.players)[0], highlighted: boolean) {
    return (
      <article
        key={item.playerId}
        className={`${styles.proposalCard} ${highlighted && item.forced ? styles.proposalCardForced : ""} ${!highlighted ? styles.proposalCardDim : ""}`}
      >
        {/* ── Header ── */}
        <div className={styles.proposalCardTop}>
          <div className={styles.proposalCardName}>
            {highlighted && item.forced && <span className={styles.proposalForcedBadge}>OBLIGATORIO</span>}
            <strong>{item.displayName}</strong>
          </div>
          <span className={styles.proposalScore}>{item.score.toFixed(0)} pts</span>
        </div>

        {/* ── Chips de metadatos ── */}
        <div className={styles.proposalChips}>
          <span className={styles.proposalChip}>{item.position ?? "Sin posición"}</span>
          <span className={styles.proposalChip}>📋 {item.calledCount} conv.</span>
          {item.startsDataAvailable && (
            <span className={styles.proposalChip}>🏁 {item.startsCount} tit.</span>
          )}
          <span className={styles.proposalChip}>Min. conv: {item.minRequiredCalls}</span>
          {item.weeklyTraining.totalTrainings > 0 && (
            <span className={`${styles.proposalChip} ${
              item.weeklyTraining.attendedTrainings === 0 ? styles.proposalChipRed : styles.proposalChipGreen
            }`}>
              🏃 {item.weeklyTraining.attendedTrainings}/{item.weeklyTraining.totalTrainings} entrenos
            </span>
          )}
        </div>

        {/* ── Factores ── */}
        <div className={styles.factorList}>
          {
            // Group factors by parent key (prefix before first '.') so sub-factors
            // like 'positionCoverage.baseCoverageBonus' are rendered under the
            // main 'positionCoverage' factor.
          }
          {(() => {
            const groups = new Map<string, { main: any | null; children: any[] }>();
            const order: string[] = [];
            for (const factor of item.factors) {
              const key: string = factor.key;
              const parent = key.includes(".") ? key.split(".")[0] : key;
              if (!groups.has(parent)) {
                groups.set(parent, { main: null, children: [] });
                order.push(parent);
              }
              if (key === parent) groups.get(parent)!.main = factor;
              else groups.get(parent)!.children.push(factor);
            }

            return order.map((parent) => {
              const g = groups.get(parent)!;
              const main = g.main;
              return (
                <div key={`${item.playerId}-group-${parent}`}>
                  {main ? (
                    <div
                      key={`${item.playerId}-${main.key}`}
                      className={`${styles.factorItem} ${main.impact > 0 ? styles.factorItemPositive : main.impact < 0 ? styles.factorItemNegative : styles.factorItemNeutral}`}
                    >
                      <span className={styles.factorLabel}>{main.label}</span>
                      <div className={styles.factorMeta}>
                        <span className={styles.factorValueLabel}>Valor:</span>
                        <span className={styles.factorValue} title={`Valor bruto: ${main.value}`}>{formatProposalFactorValue(main)}</span>
                      </div>
                      <span
                        className={`${styles.factorImpact} ${main.impact > 0 ? styles.factorPositive : main.impact < 0 ? styles.factorNegative : styles.factorNeutral}`}
                        title={`Impacto: ${main.impact.toFixed(0)} pts`}
                      >
                        {main.impact > 0 ? "+" : ""}{main.impact.toFixed(0)} pts
                      </span>
                    </div>
                  ) : null}

                  {g.children.length > 0 && (
                    <div>
                      {g.children.map((child) => (
                        <div
                          key={`${item.playerId}-${child.key}`}
                          className={`${styles.factorItem} ${styles.factorSubItem} ${child.impact > 0 ? styles.factorItemPositive : child.impact < 0 ? styles.factorItemNegative : styles.factorItemNeutral}`}
                        >
                          <span className={styles.factorLabel}>{child.label}</span>
                          <div className={styles.factorMeta}>
                            <span className={styles.factorValueLabel}>Valor:</span>
                            <span className={styles.factorValue} title={`Valor bruto: ${child.value}`}>{formatProposalFactorValue(child)}</span>
                          </div>
                          <span
                            className={`${styles.factorImpact} ${child.impact > 0 ? styles.factorPositive : child.impact < 0 ? styles.factorNegative : styles.factorNeutral}`}
                            title={`Impacto: ${child.impact.toFixed(0)} pts`}
                          >
                            {child.impact > 0 ? "+" : ""}{child.impact.toFixed(0)} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </article>
    );
  }

  async function handleApplyProposalClick() {
    if (selectedProposalPlayers.length === 0 || applyingProposal) return;
    setApplyingProposal(true);
    try {
      await onApplyProposal(selectedProposalPlayers.map((p) => p.playerId));
      setShowProposal(false);
    } finally {
      setApplyingProposal(false);
    }
  }

  return (
    <div className={styles.convocatoriaTab}>
      <div className={styles.proposalBar}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoFixHighIcon />}
          onClick={() => setShowProposal(true)}
          disabled={proposalLoading}
          className={styles.proposalBtn}
        >
          Proponer desconvocados
        </Button>
      </div>

      {showProposal && (
        <div className={styles.proposalPage}>
          <div className={styles.proposalHeader}>
            <div>
              <h3 className={styles.proposalTitle}>Propuesta automática de desconvocatoria</h3>
              <p className={styles.proposalSubtitle}>
                Objetivo: {proposal.targetCount} desconvocado(s) | Convocados actuales: {proposal.calledCount}
              </p>
              {proposal.previousRivalResult && (
                <p className={styles.proposalSubtitle}>
                  Rival: {proposal.previousRivalResult.rival} | Resultado previo: {proposal.previousRivalResult.scoreText} ({proposal.previousRivalResult.result})
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button
                variant="text"
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={() => setShowProposal(false)}
              >
                Volver
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={
                  applyingProposal ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <AutoFixHighIcon />
                  )
                }
                disabled={applyingProposal || selectedProposalPlayers.length === 0}
                onClick={handleApplyProposalClick}
              >
                Aplicar propuesta
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PictureAsPdfIcon />}
                disabled={proposalLoading || proposal.players.length === 0}
                onClick={onPrintProposal}
              >
                Imprimir propuesta
              </Button>
            </div>
          </div>

          {proposalLoading ? (
            <div className={styles.center}><CircularProgress size={28} /></div>
          ) : proposal.players.length === 0 ? (
            <EmptyState description="No hay convocados para evaluar." />
          ) : (
            <>
              {/* ── Proposed section ── */}
              {selectedProposalPlayers.length === 0 ? (
                <p className={styles.proposalSubtitle} style={{ marginBottom: 8 }}>No hace falta desconvocar jugadores con las reglas actuales.</p>
              ) : (
                <>
                  <p className={styles.proposalSectionLabel}>Propuestos para desconvocar</p>
                  <div className={styles.proposalCards}>
                    {proposal.players.filter((p) => p.isSelected).map((item) => renderCard(item, true))}
                  </div>
                </>
              )}

              {/* ── Rest section ── */}
              {proposal.players.some((p) => !p.isSelected) && (
                <>
                  <p className={`${styles.proposalSectionLabel} ${styles.proposalSectionLabelDim}`}>Resto de convocados</p>
                  <div className={styles.proposalCards}>
                    {proposal.players.filter((p) => !p.isSelected).map((item) => renderCard(item, false))}
                  </div>
                </>
              )}

              {/* Acción de propuesta: ahora movida al actionBar superior */}
            </>
          )}
        </div>
      )}

      {!showProposal && (
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
      )}
    </div>
  );
}
