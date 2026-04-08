import { useEffect, useMemo, useState } from "react";
import { Button, ButtonGroup } from "@mui/material";
import type { PlayerRating } from "../../../types/playerRating";
import playerRatingService from "../../../services/playerRatingService";
import PlayerCromo from "./PlayerCromo";
import styles from "./SquadRanking.module.css";

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

type SortKey = "avg" | "technical" | "tactical" | "physical" | "competitiveness";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "avg", label: "Media" },
  { key: "technical", label: "Técnico" },
  { key: "tactical", label: "Táctico" },
  { key: "physical", label: "Físico" },
  { key: "competitiveness", label: "Competitividad" },
];

function avg(r: PlayerRating) {
  return (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
}

export default function SquadRanking({ teamId, players }: Props) {
  const [latestRatings, setLatestRatings] = useState<Record<string, PlayerRating>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("avg");

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    setLoading(true);
    playerRatingService
      .getTeamLatestRatings(teamId)
      .then((data) => {
        if (!mounted) return;
        const map: Record<string, PlayerRating> = {};
        data.forEach((r) => { map[r.teamPlayerId] = r; });
        setLatestRatings(map);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [teamId]);

  const ranked = useMemo(() => {
    const withRating = players.filter((p) => latestRatings[p.teamPlayerId]);
    const withoutRating = players.filter((p) => !latestRatings[p.teamPlayerId]);

    const sorted = [...withRating].sort((a, b) => {
      const ra = latestRatings[a.teamPlayerId];
      const rb = latestRatings[b.teamPlayerId];
      const va = sortBy === "avg" ? avg(ra) : ra[sortBy];
      const vb = sortBy === "avg" ? avg(rb) : rb[sortBy];
      return vb - va;
    });

    return [...sorted, ...withoutRating];
  }, [players, latestRatings, sortBy]);

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

      <div className={styles.grid}>
        {ranked.map((p, i) => {
          const rating = latestRatings[p.teamPlayerId];
          const hasRating = !!rating;
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
              rank={hasRating ? i + 1 : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
