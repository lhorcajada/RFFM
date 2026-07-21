import { useMemo, useState } from "react";
import { Button, ButtonGroup } from "@mui/material";
import type { PlayerRating } from "../../../types/playerRating";
import type { CreateRatingPayload, CreateGoalkeeperRatingPayload } from "../../../services/playerRatingService";
import playerRatingService from "../../../services/playerRatingService";
import PlayerCromo from "./PlayerCromo";
import EditRatingDialog from "./EditRatingDialog";
import EditGoalkeeperRatingDialog from "./EditGoalkeeperRatingDialog";
import styles from "./SquadRanking.module.css";

type PlayerEntry = {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  position?: string | null;
  dorsal?: number | null;
  photoSrc?: string | null;
};

type Props = {
  teamId: string;
  players: PlayerEntry[];
  latestRatings: Record<string, PlayerRating>;
  loading: boolean;
  onRatingCreated: (rating: PlayerRating) => void;
};

type SortKey = "avg" | "technical" | "tactical" | "physical" | "competitiveness";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "avg", label: "Media" },
  { key: "technical", label: "Técnico" },
  { key: "tactical", label: "Táctico" },
  { key: "physical", label: "Físico" },
  { key: "competitiveness", label: "Competitividad" },
];

type Tier = {
  rank: number;          // position of the first player in this tier
  score: number;         // shared score value
  players: PlayerEntry[];
};

function avg(r: PlayerRating) {
  return (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
}

function buildTiers(
  players: PlayerEntry[],
  latestRatings: Record<string, PlayerRating>,
  sortBy: SortKey
): { tiers: Tier[]; unrated: PlayerEntry[] } {
  const withRating = players.filter((p) => latestRatings[p.teamPlayerId]);
  const unrated = players.filter((p) => !latestRatings[p.teamPlayerId]);

  const scored = withRating
    .map((p) => {
      const r = latestRatings[p.teamPlayerId];
      const score = sortBy === "avg" ? avg(r) : Number(r[sortBy]);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  const tiers: Tier[] = [];
  let rank = 1;
  for (const { p, score } of scored) {
    const last = tiers[tiers.length - 1];
    if (last && last.score === score) {
      last.players.push(p);
    } else {
      tiers.push({ rank, score, players: [p] });
    }
    rank++;
  }

  return { tiers, unrated };
}

const MEDALS = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];

function pickInitialSubRatings(rating: PlayerRating | undefined): Partial<Record<string, number>> {
  if (!rating) return {};
  const result: Partial<Record<string, number>> = {};
  for (const a of rating.answers) {
    // answers.level is 1-10; convert to 0-100 slider scale
    result[a.characteristicKey] = Math.min(100, Math.max(0, Math.round(a.level * 10)));
  }
  return result;
}

function pickInitialKeeperSubRatings(rating: PlayerRating | undefined): Partial<Record<string, number>> {
  if (!rating) return {};
  const result: Partial<Record<string, number>> = {};
  for (const a of rating.answers) {
    result[a.characteristicKey] = Math.min(100, Math.max(0, Math.round(a.level * 10)));
  }
  return result;
}

function isGoalkeeperPosition(position?: string | null): boolean {
  if (!position) return false;
  const p = position.toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

export default function SquadRanking({ teamId: _teamId, players, latestRatings, loading, onRatingCreated }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("avg");
  const [editPlayer, setEditPlayer] = useState<PlayerEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const { tiers, unrated } = useMemo(
    () => buildTiers(players, latestRatings, sortBy),
    [players, latestRatings, sortBy]
  );

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

  const podiumTiers = tiers.slice(0, 3);
  const restTiers = tiers.slice(3);

  function renderTierBlock(tier: Tier, className: string) {
    return (
      <div key={tier.rank} className={className}>
        <div className={styles.tierHeader}>
          <span className={styles.tierRank}>
            {tier.rank <= 3 ? MEDALS[tier.rank - 1] : `#${tier.rank}`}
          </span>
          <span className={styles.tierScore}>{tier.score.toFixed(1)}</span>
          {tier.players.length > 1 && (
            <span className={styles.tierTie}>
              {tier.players.length} empatados
            </span>
          )}
        </div>
        <div className={styles.grid}>
          {tier.players.map((p) => {
            const rating = latestRatings[p.teamPlayerId];
            return (
              <PlayerCromo
                key={p.teamPlayerId}
                displayName={p.displayName}
                alias={p.alias}
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
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.empty}>Cargando...</div>;
  }

  if (players.length === 0) {
    return <div className={styles.empty}>No hay jugadores para mostrar.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Ordenar por:</span>
        <ButtonGroup size="small" variant="outlined">
          {SORT_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              onClick={() => setSortBy(key)}
              variant={sortBy === key ? "contained" : "outlined"}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {podiumTiers.length > 0 && (
        <div className={styles.podiumStage}>
          {([podiumTiers[1], podiumTiers[0], podiumTiers[2]] as (Tier | undefined)[]).map((tier, slotIdx) => {
            if (!tier) return <div key={`empty-${slotIdx}`} className={styles.podiumSlotEmpty} />;
            const rank = tier.rank;
            const platformClass =
              rank === 1 ? styles.platform1 : rank === 2 ? styles.platform2 : styles.platform3;
            return (
              <div key={tier.rank} className={styles.podiumSlot}>
                <div className={styles.podiumCards}>
                  {tier.players.map((p) => {
                    const rating = latestRatings[p.teamPlayerId];
                    return (
                      <PlayerCromo
                        key={p.teamPlayerId}
                        displayName={p.displayName}
                        alias={p.alias}
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
                      />
                    );
                  })}
                </div>
                <div className={`${styles.podiumPlatform} ${platformClass}`}>
                  <span className={styles.podiumMedal}>{MEDALS[rank - 1]}</span>
                  <span className={styles.podiumScore}>{tier.score.toFixed(1)}</span>
                  {tier.players.length > 1 && (
                    <span className={styles.podiumTie}>{tier.players.length} empatados</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {restTiers.length > 0 && (
        <div className={styles.tiersRow}>
          {restTiers.map((tier) => renderTierBlock(tier, styles.tier))}
        </div>
      )}

      {unrated.length > 0 && (
        <div className={styles.tier}>
          <div className={styles.tierHeader}>
            <span className={styles.tierRankUnrated}>Sin valorar</span>
          </div>
          <div className={styles.grid}>
            {unrated.map((p) => (
              <PlayerCromo
                key={p.teamPlayerId}
                displayName={p.displayName}
                alias={p.alias}
                photoSrc={p.photoSrc}
                dorsal={p.dorsal}
                position={p.position}
                rating={null}
                onEdit={() => setEditPlayer(p)}
              />
            ))}
          </div>
        </div>
      )}
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
    </div>
  );
}
