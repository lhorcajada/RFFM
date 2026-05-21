import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import styles from "../SeasonAccess.module.css";
import TestGrid, { Player as TestPlayer } from "./testgrid";
import type { SeasonAccessDemarcation } from "../../../services/seasonAccessService";
import {
  getTrialDays,
  getTrialDayRatings,
  upsertTrialDayRating,
  type SeasonAccessTrialDay,
  type SeasonAccessTrialDayRating,
} from "../../../services/seasonAccessService";

type Props = {
  selectedPlayers?: any[];
  demarcations?: SeasonAccessDemarcation[];
  trialId?: string | null;
  seasonId?: string | null;
  category?: string | null;
};

function formatTabLabel(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function buildMappedPlayers(
  selectedPlayers: any[],
  ratings: SeasonAccessTrialDayRating[],
): TestPlayer[] {
  const ratingMap = new Map(ratings.map((r) => [r.trialPlayerId, r]));

    return selectedPlayers.map((p: any, idx: number) => {
    const rating = ratingMap.get(p.id);
    return {
      id: idx + 1,
      trialPlayerId: p.id,
      federationPlayerCode: p.federationPlayerCode ?? p.id,
      name: p.displayName || p.playerName || `Jugador ${idx + 1}`,
      birthYear: p.birthYear ?? new Date().getFullYear(),
      teamName: p.teamName,
      category: p.category,
      status: (rating?.status as TestPlayer['status']) ?? 'interesado',
      rating: rating?.score != null ? Number(rating.score) : 0,
      // Prefer TotalGoals coming from the trial day rating (server), fallback to the saved player snapshot
        totalGoals: (rating as any)?.totalGoals ?? p.totalGoals ?? null,
      idealDemarcationId: rating?.idealDemarcationId ?? p.idealDemarcationId ?? null,
      possibleDemarcationIds: rating?.possibleDemarcationIds?.length
        ? rating.possibleDemarcationIds
        : (p.possibleDemarcationIds ?? []),
    };
  });
}

interface DayTabProps {
  day: SeasonAccessTrialDay;
  selectedPlayers: any[];
  demarcations: SeasonAccessDemarcation[];
  previousDayId?: string | null;
}

function DayTab({ day, selectedPlayers, demarcations, previousDayId }: DayTabProps) {
  const [ratings, setRatings] = useState<SeasonAccessTrialDayRating[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    getTrialDayRatings(day.id)
      .then((result) => {
        if (!mounted) return;
        if (result.length > 0 || !previousDayId) {
          setRatings(result);
        } else {
          getTrialDayRatings(previousDayId)
            .then((prev) => { if (mounted) setRatings(prev); })
            .catch(() => { if (mounted) setRatings([]); });
        }
      })
      .catch(() => {
        if (mounted) setRatings([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      saveTimersRef.current.forEach((t) => clearTimeout(t));
      saveTimersRef.current.clear();
    };
  }, [day.id, previousDayId]);

  function handlePlayerChange(player: TestPlayer) {
    if (!player.trialPlayerId) return;
    const key = player.trialPlayerId;
    const existing = saveTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimersRef.current.delete(key);
      upsertTrialDayRating(day.id, {
        trialPlayerId: key,
        score: player.rating ?? null,
        totalGoals: (player as any).totalGoals ?? null,
        status: player.status ?? null,
        idealDemarcationId: player.idealDemarcationId ?? null,
        possibleDemarcationIds: player.possibleDemarcationIds ?? [],
      }).catch(() => {});
    }, 1500);
    saveTimersRef.current.set(key, timer);
  }

  const mappedPlayers = buildMappedPlayers(selectedPlayers, ratings);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return <TestGrid initialPlayers={mappedPlayers} demarcations={demarcations} onPlayerChange={handlePlayerChange} />;
}

export default function TestsTab({
  selectedPlayers = [],
  demarcations = [],
  seasonId,
  category,
}: Props) {
  const [days, setDays] = useState<SeasonAccessTrialDay[]>([]);
  const [daysLoading, setDaysLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    if (!seasonId || !category) {
      setDays([]);
      return;
    }

    let mounted = true;
    setDaysLoading(true);

    getTrialDays(seasonId, category)
      .then((result) => {
        if (mounted) {
          setDays(result);
          setActiveDay(0);
        }
      })
      .catch(() => {
        if (mounted) setDays([]);
      })
      .finally(() => {
        if (mounted) setDaysLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [seasonId, category]);

  if (daysLoading) {
    return (
      <div className={styles.content}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className={styles.content}>
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No hay días de prueba configurados. Ve a la pestaña <strong>Seleccionar jugadores</strong> y añade los días de
          prueba que necesites.
        </Typography>
      </div>
    );
  }

  

  return (
    <div className={styles.content}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Tabs
          value={activeDay}
          onChange={(_, v) => setActiveDay(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Días de prueba"
          sx={{ mr: 2, flex: 1 }}
        >
          {days.map((day, idx) => (
            <Tab
              key={day.id}
              label={
                <span>
                  <strong>{formatTabLabel(day.date)}</strong>
                  {day.label ? <span style={{ marginLeft: 4, opacity: 0.7 }}>{day.label}</span> : null}
                </span>
              }
              value={idx}
            />
          ))}
        </Tabs>
      </Box>

      {days[activeDay] && (
        <DayTab
          key={days[activeDay].id}
          day={days[activeDay]}
          selectedPlayers={selectedPlayers}
          demarcations={demarcations}
          previousDayId={activeDay > 0 ? days[activeDay - 1].id : null}
        />
      )}
    </div>
  );
}

