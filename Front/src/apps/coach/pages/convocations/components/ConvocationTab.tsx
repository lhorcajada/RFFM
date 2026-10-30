import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import { useEffect, useState, type DragEvent, type MouseEvent } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { ExcuseType } from "../../../services/excuseTypeService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import ConvocationPlayerRow from "./ConvocationPlayerRow";
import PlayerFormLegend from "../../../components/PlayerFormLegend/PlayerFormLegend";
import type { DropZone } from "./convocationMatchDetail.types";
import type { DeconvokeProposal } from "../utils/deconvokeProposal";
import { formatProposalFactorValue } from "../utils/deconvokeProposal";
import { formatShortfall, roleLabel } from "../utils/positionRequirements";
import styles from "./ConvocationTab.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mgmtRatingColor(v: number): string {
  if (v >= 7) return "#66bb6a";
  if (v >= 5) return "#ffb300";
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
  /** League match: adds the waiting and pending-availability lists. */
  isLeagueMatch?: boolean;
  mgmtWaiting?: string[];
  mgmtAvailabilityPending?: string[];
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
  onCallPlayers?: (playerIds: string[]) => Promise<void>;
  /** Moves a called player to «Desconvocados» without dragging. */
  onDeconvokePlayer?: (playerId: string) => Promise<void>;
  /** League: answers a pending availability request as available on the player's behalf. */
  onMarkAvailable?: (playerId: string) => Promise<void>;
  playerStreaks?: Map<string, number>;
  proposal: DeconvokeProposal;
  proposalLoading: boolean;
  onApplyProposal: (ids: string[]) => Promise<void>;
  onPrintProposal: () => Promise<void>;
  /** Rodaje/condición física por teamPlayerId (best-effort, puede estar vacío mientras carga). */
  readinessMap?: Record<string, Pick<PlayerStatistics, "readiness" | "fatigue"> & Partial<Pick<PlayerStatistics, "formStatus">>>;
  /** Jugadores en la semana de recuperación tras una baja de dos semanas o más. */
  recoveringIds?: ReadonlySet<string>;
};

const GROUPS = [
  { order: 0, label: "Porteros" },
  { order: 1, label: "Defensas" },
  { order: 2, label: "Medios" },
  { order: 3, label: "Delanteros" },
  { order: 4, label: "Sin posición" },
];

type ZoneConfig = {
  zone: DropZone;
  label: string;
  headerClass: keyof typeof styles;
};

const LEAGUE_ONLY_ZONES: ZoneConfig[] = [
  { zone: "waiting", label: "Lista de espera", headerClass: "dropColumnHeaderWaiting" },
  { zone: "availabilityPending", label: "Pendientes de respuesta", headerClass: "dropColumnHeaderAvailabilityPending" },
];

const COMMON_ZONES: ZoneConfig[] = [
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
  isLeagueMatch = false,
  mgmtWaiting = [],
  mgmtAvailabilityPending = [],
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
  onCallPlayers,
  onDeconvokePlayer,
  onMarkAvailable,
  playerStreaks,
  proposal,
  proposalLoading,
  onApplyProposal,
  onPrintProposal,
  readinessMap,
  recoveringIds,
}: Props) {
  const [showProposal, setShowProposal] = useState(false);
  const [applyingProposal, setApplyingProposal] = useState(false);
  const [collapsedZones, setCollapsedZones] = useState<Partial<Record<DropZone, boolean>>>({});
  const zones = isLeagueMatch ? [...LEAGUE_ONLY_ZONES, ...COMMON_ZONES] : COMMON_ZONES;
  const toggleZone = (zone: DropZone) => setCollapsedZones((prev) => ({ ...prev, [zone]: !prev[zone] }));
  // Zones without players are folded into a pill; the coach can still unfold one to see its drop area.
  const [openedEmptyZones, setOpenedEmptyZones] = useState<Partial<Record<DropZone, boolean>>>({});
  const toggleEmptyZone = (zone: DropZone) => setOpenedEmptyZones((prev) => ({ ...prev, [zone]: !prev[zone] }));
  const zoneCounts: Record<DropZone, number> = {
    waiting: mgmtWaiting.length,
    availabilityPending: mgmtAvailabilityPending.length,
    available: mgmtAvailable.length,
    called: mgmtCalled.length,
    notCalled: mgmtNotCalled.length,
  };
  useEffect(() => {
    setOpenedEmptyZones((prev) => {
      const stale = (Object.keys(prev) as DropZone[]).filter((zone) => prev[zone] && zoneCounts[zone] > 0);
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const zone of stale) delete next[zone];
      return next;
    });
  }, [zoneCounts.waiting, zoneCounts.availabilityPending, zoneCounts.available, zoneCounts.called, zoneCounts.notCalled]);
  const [selectedToCall, setSelectedToCall] = useState<string[]>([]);
  const [callingPlayers, setCallingPlayers] = useState(false);
  const [markingAvailable, setMarkingAvailable] = useState<string[]>([]);
  const selectedAvailable = selectedToCall.filter((id) => mgmtAvailable.includes(id));
  const toggleSelectedToCall = (playerId: string) =>
    setSelectedToCall((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));

  async function handleCallSelected() {
    if (!onCallPlayers || selectedAvailable.length === 0 || callingPlayers) return;
    setCallingPlayers(true);
    try {
      await onCallPlayers(mgmtAvailable.filter((id) => selectedAvailable.includes(id)));
      setSelectedToCall([]);
    } finally {
      setCallingPlayers(false);
    }
  }

  async function handleMarkAvailable(playerId: string) {
    if (!onMarkAvailable || markingAvailable.includes(playerId)) return;
    setMarkingAvailable((prev) => [...prev, playerId]);
    try {
      await onMarkAvailable(playerId);
    } finally {
      setMarkingAvailable((prev) => prev.filter((id) => id !== playerId));
    }
  }

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
    if (zone === "waiting") return mgmtWaiting;
    if (zone === "availabilityPending") return mgmtAvailabilityPending;
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
          <span className={styles.proposalChip} title={item.position ?? undefined}>
            {roleLabel(item.positionRole ?? null)}
          </span>
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
            // like 'parent.detail' are rendered under the main 'parent' factor.
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

  const stopDrag = {
    onMouseDown: (e: MouseEvent) => e.stopPropagation(),
    onDragStart: (e: DragEvent) => e.stopPropagation(),
  };

  function renderPlayerActions(playerId: string, zone: DropZone, displayName: string) {
    if (zone === "available" && onCallPlayers) {
      return (
        <label
          className={`${styles.bulkCallCheckRow} ${selectedToCall.includes(playerId) ? styles.bulkCallCheckRowSelected : ""}`}
        >
          <Checkbox
            size="small"
            checked={selectedToCall.includes(playerId)}
            onChange={() => toggleSelectedToCall(playerId)}
            disabled={callingPlayers}
            inputProps={{ "aria-label": `Seleccionar ${displayName}` }}
            className={styles.bulkCallCheckbox}
          />
        </label>
      );
    }
    if (zone === "availabilityPending" && onMarkAvailable) {
      return (
        <Button
          size="small"
          variant="outlined"
          color="success"
          onClick={() => handleMarkAvailable(playerId)}
          disabled={markingAvailable.includes(playerId)}
          aria-label={`Marcar disponible a ${displayName}`}
          className={styles.rowActionBtn}
        >
          Disponible
        </Button>
      );
    }
    if (zone === "called" && onDeconvokePlayer) {
      return (
        <IconButton
          onClick={() => onDeconvokePlayer(playerId)}
          aria-label={`Desconvocar a ${displayName}`}
          className={styles.deconvokeBtn}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      );
    }
    if (zone === "notCalled" && onCallPlayers) {
      return (
        <Button
          size="small"
          variant="outlined"
          onClick={() => onCallPlayers([playerId])}
          aria-label={`Convocar a ${displayName}`}
          className={`${styles.rowActionBtn} ${styles.callBtn}`}
        >
          Convocar
        </Button>
      );
    }
    return null;
  }

  function renderPlayerRow(playerId: string, zone: DropZone) {
    const p = players.find((pl) => pl.id === playerId);
    if (!p) return null;
    const displayName = p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
    const r = mgmtRatings[playerId];
    const actions = renderPlayerActions(playerId, zone, displayName);
    return (
      <div
        key={playerId}
        draggable
        className={`${styles.draggableCard} ${mgmtDragPlayer === playerId ? styles.draggableCardDragging : ""}`}
        onDragStart={() => onDragStart(playerId)}
        onDragEnd={onDragEnd}
      >
        <ConvocationPlayerRow
          displayName={displayName}
          photoSrc={mgmtPhotos[playerId] ?? null}
          dorsal={p.dorsal ?? null}
          position={p.position ?? null}
          injured={p.isInjured === true}
          recovering={recoveringIds?.has(playerId) === true}
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
          readiness={readinessMap?.[playerId]?.readiness ?? null}
          fatigue={readinessMap?.[playerId]?.fatigue ?? null}
          formStatus={readinessMap?.[playerId]?.formStatus}
          selected={zone === "available" && selectedToCall.includes(playerId)}
          actions={actions ? <div {...stopDrag}>{actions}</div> : undefined}
        />
        {zone === "notCalled" && excuseTypes.length > 0 && (
          <FormControl size="small" fullWidth sx={{ mt: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()} {...stopDrag}>
            <InputLabel sx={{ fontSize: "0.7rem" }}>Motivo</InputLabel>
            <Select
              label="Motivo"
              value={mgmtExcuseMap[playerId] ?? ""}
              onChange={(e) => onExcuseChange(playerId, e.target.value as number)}
              sx={{ fontSize: "0.72rem" }}
            >
              {excuseTypes.map((et) => (
                <MenuItem key={et.id} value={et.id} sx={{ fontSize: "0.72rem" }}>
                  {et.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>
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
      {!showProposal && (
        <ul className={styles.summary} aria-label="Resumen de la convocatoria">
          {zones.map(({ zone, label }) => {
            const count = getZoneIds(zone).length;
            return (
              <li key={zone} className={styles.summaryItem} aria-label={`${label}: ${count}`}>
                <span className={styles.summaryValue} aria-hidden="true">{count}</span>
                <span className={styles.summaryLabel} aria-hidden="true">{label}</span>
              </li>
            );
          })}
        </ul>
      )}

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
        <PlayerFormLegend />
      </div>

      {showProposal && (
        <div className={styles.proposalPage}>
          <div className={styles.proposalHeader}>
            <div>
              <h3 className={styles.proposalTitle}>Propuesta automática de desconvocatoria</h3>
              <p className={styles.proposalSubtitle}>
                Objetivo: {proposal.targetCount} desconvocado(s) | Plantilla: {proposal.calledCount} jugadores
              </p>
              {proposal.previousRivalResult && (
                <p className={styles.proposalSubtitle}>
                  Rival: {proposal.previousRivalResult.rival} | Resultado previo: {proposal.previousRivalResult.scoreText} ({proposal.previousRivalResult.result})
                </p>
              )}
              {(proposal.positionWarnings ?? []).length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <strong>Mínimos de posición sin cubrir</strong>
                  <ul className={styles.proposalWarningList}>
                    {proposal.positionWarnings.map((warning) => (
                      <li key={warning.requirement}>{formatShortfall(warning)}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </div>
            <div className={styles.proposalHeaderActions}>
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
      <>
      <div className={styles.emptyZones}>
        {zones
          .filter(({ zone }) => getZoneIds(zone).length === 0 && !openedEmptyZones[zone])
          .map(({ zone, label, headerClass }) => (
            <button
              key={zone}
              type="button"
              aria-expanded={false}
              className={`${styles.emptyZone} ${styles[headerClass]} ${mgmtDragOver === zone ? styles.dropColumnOver : ""}`}
              onClick={() => toggleEmptyZone(zone)}
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
              <ExpandMoreIcon fontSize="small" className={styles.dropColumnChevron} />
              {label}{" "}
              <span className={styles.dropColumnCount}>0</span>
            </button>
          ))}
      </div>
      <div className={styles.dropColumns}>
        {zones
          .filter(({ zone }) => getZoneIds(zone).length > 0 || openedEmptyZones[zone])
          .map(({ zone, label, headerClass }) => {
          const ids = getZoneIds(zone);
          const expanded = (ids.length > 0 || !!openedEmptyZones[zone]) && !collapsedZones[zone];
          return (
            <section
              key={zone}
              aria-label={label}
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
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => (ids.length === 0 ? toggleEmptyZone(zone) : toggleZone(zone))}
                className={`${styles.dropColumnHeader} ${styles.dropColumnToggle} ${styles[headerClass]}`}
              >
                <span className={styles.dropColumnTitle}>
                  <ExpandMoreIcon
                    fontSize="small"
                    className={`${styles.dropColumnChevron} ${expanded ? styles.dropColumnChevronExpanded : ""}`}
                  />
                  {label}
                </span>
                <div className={styles.dropColumnHeaderMeta}>
                  {zone === "called" && teamAvgRating != null && (
                    <span
                      className={styles.calledAvg}
                      style={{ color: mgmtRatingColor(teamAvgRating) }}
                      title="Valoración media de los convocados (1-10)"
                      aria-label={`Valoración media de los convocados: ${Math.round(teamAvgRating)}`}
                    >
                      {Math.round(teamAvgRating)}
                    </span>
                  )}
                  <span className={styles.dropColumnCount}>{ids.length}</span>
                </div>
              </button>

              {expanded && (
                <div className={styles.dropColumnBody}>
                  {ids.length === 0 && (
                    <div className={styles.dropHint}>Arrastra jugadores aquí</div>
                  )}
                  {zone === "available" && onCallPlayers && ids.length > 0 && (
                    <div className={styles.bulkCallBar}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() =>
                          setSelectedToCall(selectedAvailable.length === ids.length ? [] : [...ids])
                        }
                        disabled={callingPlayers}
                        className={styles.bulkCallSelectAll}
                      >
                        {selectedAvailable.length === ids.length ? "Quitar selección" : "Seleccionar todos"}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={callingPlayers ? <CircularProgress size={14} color="inherit" /> : <PlaylistAddCheckIcon />}
                        onClick={handleCallSelected}
                        disabled={selectedAvailable.length === 0 || callingPlayers}
                        className={styles.bulkCallBtn}
                      >
                        Convocar seleccionados ({selectedAvailable.length})
                      </Button>
                    </div>
                  )}
                  {zone === "notCalled"
                    ? ids.map((playerId) => renderPlayerRow(playerId, zone))
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
                          ...group.map((playerId) => renderPlayerRow(playerId, zone)),
                        ];
                      })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}
