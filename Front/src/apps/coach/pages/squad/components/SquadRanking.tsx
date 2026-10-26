import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { PlayerRating } from "../../../types/playerRating";
import type { CreateRatingPayload, CreateGoalkeeperRatingPayload } from "../../../services/playerRatingService";
import playerRatingService from "../../../services/playerRatingService";
import RankingPlayerRow from "./RankingPlayerRow";
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

const PODIUM_COLORS = ["#f2c14e", "#c9ced6", "#d08a4e"];

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

  if (loading) {
    return <div className={styles.empty}>Cargando...</div>;
  }

  if (players.length === 0) {
    return <div className={styles.empty}>No hay jugadores para mostrar.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.sortChips}>
        <span className={styles.filterLabel}>Ordenar por</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`${styles.chip} ${sortBy === key ? styles.chipActive : ""}`}
            aria-pressed={sortBy === key}
            onClick={() => setSortBy(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {podiumTiers.length > 0 && (
        <div className={styles.podium}>
          {podiumTiers.map((tier, index) => (
            <section
              key={tier.rank}
              className={styles.podiumCard}
              style={{ "--medal": PODIUM_COLORS[index] } as CSSProperties}
              aria-label={`Puesto ${tier.rank}`}
            >
              <div className={styles.podiumHeader}>
                <span className={styles.podiumPlace} aria-hidden="true">{tier.rank}</span>
                <div className={styles.podiumScoreBlock}>
                  <span className={styles.podiumScore}>{tier.score.toFixed(1)}</span>
                  {tier.players.length > 1 && (
                    <span className={styles.tieLabel}>{tier.players.length} empatados</span>
                  )}
                </div>
              </div>
              <div className={styles.playerList}>
                {tier.players.map((p) => (
                  <RankingPlayerRow
                    key={p.teamPlayerId}
                    displayName={p.displayName}
                    alias={p.alias}
                    photoSrc={p.photoSrc}
                    dorsal={p.dorsal}
                    position={p.position}
                    rated
                    onAction={() => setEditPlayer(p)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {restTiers.length > 0 && (
        <div className={styles.rows}>
          {restTiers.map((tier) => (
            <div key={tier.rank} className={styles.row} role="group" aria-label={`Puesto ${tier.rank}`}>
              <span className={styles.rowRank}>#{tier.rank}</span>
              <div className={styles.rowPlayers}>
                {tier.players.map((p) => (
                  <RankingPlayerRow
                    key={p.teamPlayerId}
                    displayName={p.displayName}
                    alias={p.alias}
                    photoSrc={p.photoSrc}
                    dorsal={p.dorsal}
                    position={p.position}
                    rated
                    onAction={() => setEditPlayer(p)}
                  />
                ))}
                {tier.players.length > 1 && (
                  <span className={styles.tieLabel}>{tier.players.length} empatados</span>
                )}
              </div>
              <span className={styles.rowScore}>{tier.score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {unrated.length > 0 && (
        <section className={styles.unrated} aria-label="Sin valorar">
          <h2 className={styles.unratedTitle}>Sin valorar</h2>
          <div className={styles.unratedGrid}>
            {unrated.map((p) => (
              <RankingPlayerRow
                key={p.teamPlayerId}
                displayName={p.displayName}
                alias={p.alias}
                photoSrc={p.photoSrc}
                dorsal={p.dorsal}
                position={p.position}
                onAction={() => setEditPlayer(p)}
                dashed
              />
            ))}
          </div>
        </section>
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
