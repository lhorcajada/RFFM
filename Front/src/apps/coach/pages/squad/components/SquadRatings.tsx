import { useMemo, useState } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { PlayerRating } from "../../../types/playerRating";
import type { CreateRatingPayload, CreateGoalkeeperRatingPayload } from "../../../services/playerRatingService";
import playerRatingService from "../../../services/playerRatingService";
import PlayerCromo from "./PlayerCromo";
import SubRatingsPanel from "./SubRatingsPanel";
import EditRatingDialog from "./EditRatingDialog";
import EditGoalkeeperRatingDialog from "./EditGoalkeeperRatingDialog";
import RatingHistoryDialog from "./RatingHistoryDialog";
import styles from "./SquadRatings.module.css";

type PlayerEntry = {
  teamPlayerId: string;
  displayName: string;
  position?: string | null;
  dorsal?: number | null;
  photoSrc?: string | null;
};

type Props = {
  teamId: string;
  players: PlayerEntry[];
  latestRatings: Record<string, PlayerRating>;
  onRatingCreated: (rating: PlayerRating) => void;
};

const POSITION_ORDER = ["Portero", "Defensa", "Centrocampista", "Delantero"];

function positionCategory(position: string): number {
  const p = position.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero") || p.includes("stopper")) return 1;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return 2;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return 3;
  return 4;
}

function positionAccent(position: string): string {
  const cat = positionCategory(position);
  if (cat === 0) return "#f59e0b";
  if (cat === 1) return "#3b82f6";
  if (cat === 2) return "#10b981";
  if (cat === 3) return "#ef4444";
  return "#6b7280";
}

const RATING_FIELDS: { key: keyof Omit<PlayerRating, "id" | "teamPlayerId" | "ratedAt" | "notes">; label: string }[] = [
  { key: "technical", label: "Técnico" },
  { key: "tactical", label: "Táctico" },
  { key: "physical", label: "Físico" },
  { key: "competitiveness", label: "Competitividad" },
];

function groupPlayersByPosition(players: PlayerEntry[]) {
  const groups: Record<string, PlayerEntry[]> = {};
  for (const p of players) {
    const key = p.position?.trim() || "Sin posición";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const ia = POSITION_ORDER.findIndex((pos) =>
      a.toLowerCase().includes(pos.toLowerCase())
    );
    const ib = POSITION_ORDER.findIndex((pos) =>
      b.toLowerCase().includes(pos.toLowerCase())
    );
    const ra = ia === -1 ? POSITION_ORDER.length : ia;
    const rb = ib === -1 ? POSITION_ORDER.length : ib;
    return ra !== rb ? ra - rb : a.localeCompare(b, "es");
  });
}

function pickInitialSubRatings(rating: PlayerRating | undefined): Partial<Omit<CreateRatingPayload, "notes">> {
  if (!rating) return {};
  return {
    physicalSpeed: rating.physicalSpeed ?? undefined,
    physicalEndurance: rating.physicalEndurance ?? undefined,
    physicalStrength: rating.physicalStrength ?? undefined,
    technicalDribbling: rating.technicalDribbling ?? undefined,
    technicalPassing: rating.technicalPassing ?? undefined,
    technicalControl: rating.technicalControl ?? undefined,
    technicalShooting: rating.technicalShooting ?? undefined,
    technicalTackling: rating.technicalTackling ?? undefined,
    technicalInterceptions: rating.technicalInterceptions ?? undefined,
    technicalHeading: rating.technicalHeading ?? undefined,
    tacticalDefensiveAwareness: rating.tacticalDefensiveAwareness ?? undefined,
    tacticalMarking: rating.tacticalMarking ?? undefined,
    tacticalTrackBack: rating.tacticalTrackBack ?? undefined,
    tacticalPressing: rating.tacticalPressing ?? undefined,
    tacticalGeneratesAdvantage: rating.tacticalGeneratesAdvantage ?? undefined,
    tacticalOffMovement: rating.tacticalOffMovement ?? undefined,
    tacticalBeatsOpponents: rating.tacticalBeatsOpponents ?? undefined,
    tacticalAttackParticipation: rating.tacticalAttackParticipation ?? undefined,
    competDuelWinning: rating.competDuelWinning ?? undefined,
    competLooseBalls: rating.competLooseBalls ?? undefined,
    competRecoveries: rating.competRecoveries ?? undefined,
    competDecisiveActions: rating.competDecisiveActions ?? undefined,
    competResponsibility: rating.competResponsibility ?? undefined,
    competConstantEffort: rating.competConstantEffort ?? undefined,
  };
}

function pickInitialKeeperSubRatings(rating: PlayerRating | undefined): Partial<Omit<CreateGoalkeeperRatingPayload, "notes">> {
  if (!rating) return {};
  return {
    keeperReactionSpeed: rating.keeperReactionSpeed ?? undefined,
    keeperAgility: rating.keeperAgility ?? undefined,
    keeperJumpPower: rating.keeperJumpPower ?? undefined,
    keeperStrength: rating.keeperStrength ?? undefined,
    keeperEndurance: rating.keeperEndurance ?? undefined,
    keeperHandSecurity: rating.keeperHandSecurity ?? undefined,
    keeperSaves: rating.keeperSaves ?? undefined,
    keeperAerialPlay: rating.keeperAerialPlay ?? undefined,
    keeperHandDistribution: rating.keeperHandDistribution ?? undefined,
    keeperKickDistribution: rating.keeperKickDistribution ?? undefined,
    keeperFirstTouch: rating.keeperFirstTouch ?? undefined,
    keeperPlayUnderPressure: rating.keeperPlayUnderPressure ?? undefined,
    keeperPositioning: rating.keeperPositioning ?? undefined,
    keeperGameReading: rating.keeperGameReading ?? undefined,
    keeperOneOnOne: rating.keeperOneOnOne ?? undefined,
    keeperBackCoverage: rating.keeperBackCoverage ?? undefined,
    keeperSallyTiming: rating.keeperSallyTiming ?? undefined,
    keeperBuildupPlay: rating.keeperBuildupPlay ?? undefined,
    keeperDefensiveOrganization: rating.keeperDefensiveOrganization ?? undefined,
    keeperValor: rating.keeperValor ?? undefined,
    keeperConcentration: rating.keeperConcentration ?? undefined,
    keeperKeyMoments: rating.keeperKeyMoments ?? undefined,
    keeperErrorManagement: rating.keeperErrorManagement ?? undefined,
    keeperResponsibility: rating.keeperResponsibility ?? undefined,
    keeperConsistency: rating.keeperConsistency ?? undefined,
  };
}

function isGoalkeeperPosition(position?: string | null): boolean {
  if (!position) return false;
  const p = position.toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

export default function SquadRatings({ teamId: _teamId, players, latestRatings, onRatingCreated }: Props) {
  const [editPlayer, setEditPlayer] = useState<PlayerEntry | null>(null);
  const [historyFor, setHistoryFor] = useState<{ teamPlayerId: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => groupPlayersByPosition(players), [players]);

  function togglePanel(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave(state: (CreateRatingPayload | CreateGoalkeeperRatingPayload) & { notes: string }) {
    if (!editPlayer) return;
    setSaving(true);
    try {
      let created: PlayerRating;
      if (isGoalkeeperPosition(editPlayer.position)) {
        created = await playerRatingService.createGoalkeeperRating(editPlayer.teamPlayerId, state as CreateGoalkeeperRatingPayload & { notes: string });
      } else {
        created = await playerRatingService.createRating(editPlayer.teamPlayerId, state as CreateRatingPayload & { notes: string });
      }
      onRatingCreated(created);
      setEditPlayer(null);
    } catch {
      // let user retry
    } finally {
      setSaving(false);
    }
  }

  if (players.length === 0) {
    return <div className={styles.empty}>No hay jugadores para valorar.</div>;
  }

  return (
    <div className={styles.container}>
      {grouped.map(([position, group]) => {
        const accent = positionAccent(position);
        return (
          <div key={position} className={styles.positionPanel}>
            <div className={styles.positionPanelAccent} style={{ background: accent }} />
            <div className={styles.positionPanelHeader}>
              <span className={styles.positionTitle}>{position}</span>
              <span className={styles.positionCount}>{group.length}</span>
            </div>
            <div className={styles.grid}>
              {group.map((p) => {
                const rating = latestRatings[p.teamPlayerId];
                const isCollapsed = collapsedIds.has(p.teamPlayerId);
                return (
                  <div key={p.teamPlayerId} className={styles.playerRow}>
                    <div className={styles.cromoCell}>
                      <PlayerCromo
                        displayName={p.displayName}
                        photoSrc={p.photoSrc}
                        dorsal={p.dorsal}
                        position={p.position}
                        rating={
                          rating
                            ? {
                                technical: rating.technical,
                                tactical: rating.tactical,
                                physical: rating.physical,
                                competitiveness: rating.competitiveness,
                              }
                            : null
                        }
                        onEdit={() => setEditPlayer(p)}
                        onHistory={() =>
                          setHistoryFor({
                            teamPlayerId: p.teamPlayerId,
                            name: p.displayName,
                          })
                        }
                      />
                    </div>
                    <button
                      className={styles.toggleTab}
                      onClick={() => togglePanel(p.teamPlayerId)}
                      title={isCollapsed ? "Ver subvaloraciones" : "Ocultar subvaloraciones"}
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon sx={{ fontSize: 13 }} />
                      ) : (
                        <ChevronLeftIcon sx={{ fontSize: 13 }} />
                      )}
                    </button>
                    <div
                      className={`${styles.panelSlider} ${isCollapsed ? styles.panelSliderCollapsed : ""}`}
                    >
                      <SubRatingsPanel rating={rating ?? null} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {editPlayer && (
        isGoalkeeperPosition(editPlayer.position) ? (
          <EditGoalkeeperRatingDialog
            playerDisplayName={editPlayer.displayName}
            initial={pickInitialKeeperSubRatings(latestRatings[editPlayer.teamPlayerId])}
            saving={saving}
            onSave={handleSave}
            onClose={() => setEditPlayer(null)}
          />
        ) : (
          <EditRatingDialog
            playerDisplayName={editPlayer.displayName}
            initial={pickInitialSubRatings(latestRatings[editPlayer.teamPlayerId])}
            saving={saving}
            onSave={handleSave}
            onClose={() => setEditPlayer(null)}
          />
        )
      )}

      {historyFor && (
        <RatingHistoryDialog
          teamPlayerId={historyFor.teamPlayerId}
          playerDisplayName={historyFor.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}
