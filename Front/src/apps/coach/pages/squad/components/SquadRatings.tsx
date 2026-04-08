import { useEffect, useMemo, useState } from "react";
import { Typography } from "@mui/material";
import type { PlayerRating } from "../../../types/playerRating";
import playerRatingService from "../../../services/playerRatingService";
import PlayerCromo from "./PlayerCromo";
import EditRatingDialog from "./EditRatingDialog";
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
};

type EditState = {
  technical: number;
  tactical: number;
  physical: number;
  competitiveness: number;
  notes: string;
};

const POSITION_ORDER = ["Portero", "Defensa", "Centrocampista", "Delantero"];

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

export default function SquadRatings({ teamId, players }: Props) {
  const [latestRatings, setLatestRatings] = useState<Record<string, PlayerRating>>({});
  const [editPlayer, setEditPlayer] = useState<PlayerEntry | null>(null);
  const [historyFor, setHistoryFor] = useState<{ teamPlayerId: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    playerRatingService
      .getTeamLatestRatings(teamId)
      .then((data) => {
        if (!mounted) return;
        const map: Record<string, PlayerRating> = {};
        data.forEach((r) => { map[r.teamPlayerId] = r; });
        setLatestRatings(map);
      })
      .catch(() => { /* non-critical */ });
    return () => { mounted = false; };
  }, [teamId]);

  const grouped = useMemo(() => groupPlayersByPosition(players), [players]);

  async function handleSave(state: {
    technical: number;
    tactical: number;
    physical: number;
    competitiveness: number;
    notes: string;
  }) {
    if (!editPlayer) return;
    setSaving(true);
    try {
      const created = await playerRatingService.createRating(editPlayer.teamPlayerId, state);
      setLatestRatings((prev) => ({ ...prev, [editPlayer.teamPlayerId]: created }));
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
      {grouped.map(([position, group]) => (
        <div key={position} className={styles.positionGroup}>
          <div className={styles.positionHeader}>
            <Typography variant="subtitle2" className={styles.positionTitle}>
              {position}
            </Typography>
            <span className={styles.positionCount}>{group.length}</span>
          </div>
          <div className={styles.grid}>
            {group.map((p) => {
              const rating = latestRatings[p.teamPlayerId];
              return (
                <PlayerCromo
                  key={p.teamPlayerId}
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
              );
            })}
          </div>
        </div>
      ))}

      {editPlayer && (
        <EditRatingDialog
          playerDisplayName={editPlayer.displayName}
          initial={{
            technical: latestRatings[editPlayer.teamPlayerId]?.technical ?? 3,
            tactical: latestRatings[editPlayer.teamPlayerId]?.tactical ?? 3,
            physical: latestRatings[editPlayer.teamPlayerId]?.physical ?? 3,
            competitiveness:
              latestRatings[editPlayer.teamPlayerId]?.competitiveness ?? 3,
          }}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditPlayer(null)}
        />
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
