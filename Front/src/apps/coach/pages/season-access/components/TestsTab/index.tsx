import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import styles from "../../SeasonAccess.module.css";
import TestGrid, { Player as TestPlayer } from "../testgrid";
import type { SeasonAccessDemarcation } from "../../../../services/seasonAccessService";
import {
  getTrialDays,
  getTrialDayRatings,
  saveSeasonAccessPlayer,
  deleteSeasonAccessPlayer,
  removeTrialPlayerFromDay,
  type SeasonAccessTrialDay,
  type SeasonAccessTrialPlayerDto,
  type UpsertTrialDayRatingPayload,
} from "../../../../services/seasonAccessService";
import useTrialDays from './hooks/useTrialDays';
import useTrialDayRatings from './hooks/useTrialDayRatings';
import { normalizeCategory } from "../../helpers/seasonAccess.helpers";

type Props = {
  selectedPlayers?: any[]; // kept for compatibility but TestsTab no longer depends on it for display
  demarcations?: SeasonAccessDemarcation[];
  trialId?: string | null;
  seasonId?: string | null;
  category?: string | null;
  reloadSelection?: () => Promise<void>;
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

function normalizeStatusValue(s: any): TestPlayer["status"] | null {
  if (s === null || s === undefined) return null;
  try {
    const v = String(s).trim().toLowerCase();
    if (v === "descartado" || v === "poco" || v === "interesado" || v === "solicitado" || v === "seleccionado") return v as TestPlayer["status"];
  } catch {}
  return null;
}

function buildMappedPlayersFromRatings(
  ratings: SeasonAccessTrialPlayerDto[],
  currentDayDate: string,
): TestPlayer[] {
  const currentDate = new Date(currentDayDate + "T00:00:00");

  const filtered = (ratings ?? []).filter((r) => {
    if (!r) return false;
    const removed = r.removedFromDate;
    if (!removed) return true;
    try {
      const removedDate = new Date(String(removed) + "T00:00:00");
      return removedDate > currentDate;
    } catch {
      return true;
    }
  });

  return filtered.map((r, idx) => {
    const trialPlayerId = String(r.id);
    const normalizedStatus = normalizeStatusValue(r.status) ?? "interesado";
    const name = (r as any).playerName ?? r.teamName ?? `Jugador ${idx + 1}`;
    

    return {
      id: idx + 1,
      trialPlayerId,
      federationPlayerCode: r.federationPlayerCode ?? String(r.id),
      name,
      birthYear: r.birthYear ?? new Date().getFullYear(),
      teamName: r.teamName ?? undefined,
      teamCode: r.teamCode ?? undefined,
      category: r.category ?? undefined,
      status: normalizedStatus,
      rating: r.score != null ? Number(r.score) : 0,
      totalGoals: (r as any)?.totalGoals ?? null,
      idealDemarcationId: r.idealDemarcationId ?? null,
      possibleDemarcationIds: r.possibleDemarcationIds ?? [],
    } as TestPlayer;
  });
}

interface DayTabProps {
  day: SeasonAccessTrialDay;
  selectedPlayers: any[];
  demarcations: SeasonAccessDemarcation[];
  previousDayId?: string | null;
  reloadSelection?: () => Promise<void>;
  seasonId?: string | null;
  category?: string | null;
  days?: SeasonAccessTrialDay[];
  activeDayIndex?: number;
}

function DayTab({ day, selectedPlayers, demarcations, previousDayId, reloadSelection, seasonId, category, days = [], activeDayIndex = 0 }: DayTabProps) {
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const needReloadSelectionRef = useRef(false);
  const lastUpsertRef = useRef<Map<string, UpsertTrialDayRatingPayload>>(new Map());
  const [actionLoading, setActionLoading] = useState(false);

  const {
    raw: rawRatings,
    filtered: ratings,
    excluded: excludedRatings,
    loading: ratingsLoading,
    reload: reloadRatings,
    counts: ratingCounts,
  } = useTrialDayRatings(day, previousDayId);

  function updateLastUpsertsFromRatings(list: SeasonAccessTrialPlayerDto[] | null | undefined) {
    if (!Array.isArray(list)) return;
    for (const r of list) {
      const trialPlayerId = String(r.id);
      const key = `${day.id}|${trialPlayerId}`;
      lastUpsertRef.current.set(key, {
        trialPlayerId,
        score: r.score ?? null,
        totalGoals: (r as any).totalGoals ?? null,
        status: normalizeStatusValue(r.status) ?? null,
        idealDemarcationId: r.idealDemarcationId ?? null,
        possibleDemarcationIds: r.possibleDemarcationIds ?? [],
      });
    }
  }

  async function handleRemovePlayer(player: TestPlayer) {
    if (!player.trialPlayerId) return;
    setActionLoading(true);
    try {
      await removeTrialPlayerFromDay(day.id, player.trialPlayerId);
      try {
        if (reloadSelection) await reloadSelection();
      } catch {}
      try {
        await reloadRatings();
      } catch {}
      window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Jugador eliminado del día y siguientes.', severity: 'success' } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'No se pudo eliminar el jugador.', severity: 'error' } }));
    } finally {
      setActionLoading(false);
    }
  }

  // Keep last-upserts in sync when ratings change
  useEffect(() => {
    try { updateLastUpsertsFromRatings(ratings); } catch {}
  }, [ratings]);

  useEffect(() => {
    return () => {
      saveTimersRef.current.forEach((t) => clearTimeout(t));
      saveTimersRef.current.clear();
    };
  }, []);

  function handlePlayerChange(player: TestPlayer) {
    const key = player.trialPlayerId ?? `__local_${player.id}`;
    
    const existing = saveTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      saveTimersRef.current.delete(key);
      try {
        let trialPlayerId = player.trialPlayerId;
        let createdFederationCode: string | null = null;
        const wasInitiallyNew = !player.trialPlayerId;
        let createdNow = false;

        if (!trialPlayerId) {
          if (!seasonId || !category) {
            window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Faltan temporada o categoría para guardar el jugador.', severity: 'warning' } }));
            return;
          }

          const payload = {
            seasonId,
            category: category,
            divisionCategory: player.category ?? category,
            federationPlayerCode: player.federationPlayerCode ?? String(player.name || `manual-${Date.now()}`),
            playerName: player.name || 'Jugador',
            teamCode: player.teamCode ?? player.teamName ?? 'manual',
            teamName: player.teamName ?? player.teamCode ?? 'manual',
            birthYear: player.birthYear ?? null,
            status: player.status ?? null,
            totalGoals: (player as any).totalGoals ?? null,
            possibleDemarcationIds: player.possibleDemarcationIds ?? [],
            idealDemarcationId: player.idealDemarcationId ?? null,
            score: player.rating ?? null,
            trialDayId: day.id,
          } as any;

          try {
            const result = await saveSeasonAccessPlayer(payload);
            const created = (result?.players ?? []).find((pl: any) => pl.federationPlayerCode === payload.federationPlayerCode || String(pl.playerName ?? '').trim() === String(payload.playerName ?? '').trim());
            if (created) {
              trialPlayerId = created.id;
              createdFederationCode = created.federationPlayerCode ?? null;
              createdNow = true;
            }
            needReloadSelectionRef.current = true;
          } catch (err) {
          }
        }

        if (!trialPlayerId) return;

        const currentPayload: UpsertTrialDayRatingPayload = {
          trialPlayerId,
          score: player.rating ?? null,
          totalGoals: (player as any).totalGoals ?? null,
          status: player.status ?? null,
          idealDemarcationId: player.idealDemarcationId ?? null,
          possibleDemarcationIds: player.possibleDemarcationIds ?? [],
        };

        try {
          const keyUp = `${day.id}|${trialPlayerId}`;
          const prev = lastUpsertRef.current.get(keyUp);

          const informativeCount = (p: UpsertTrialDayRatingPayload | undefined) => {
            if (!p) return 0;
            let c = 0;
            if (p.idealDemarcationId != null) c++;
            if (Array.isArray(p.possibleDemarcationIds) && p.possibleDemarcationIds.length > 0) c++;
            if (p.totalGoals != null) c++;
            return c;
          };

          const prevCount = informativeCount(prev);
          const nextCount = informativeCount(currentPayload);
          if (prev && nextCount < prevCount) {
          } else {
            lastUpsertRef.current.set(keyUp, currentPayload);

            const previousServerRating = ratings.find((r) => String(r.id) === String(trialPlayerId));

            try {
              const federationCodeToUse2 = player.federationPlayerCode ?? createdFederationCode ?? String(trialPlayerId);
              const snapshotPayloadForUpdate = {
                seasonId,
                category: category,
                divisionCategory: player.category ?? category,
                federationPlayerCode: federationCodeToUse2,
                playerName: player.name || 'Jugador',
                teamCode: player.teamCode ?? player.teamName ?? 'manual',
                teamName: player.teamName ?? player.teamCode ?? 'manual',
                birthYear: player.birthYear ?? null,
                status: player.status ?? null,
                totalGoals: (player as any).totalGoals ?? null,
                possibleDemarcationIds: player.possibleDemarcationIds ?? [],
                idealDemarcationId: player.idealDemarcationId ?? null,
                score: player.rating ?? null,
                trialDayId: day.id,
              } as any;

              await saveSeasonAccessPlayer(snapshotPayloadForUpdate);
            } catch (upsertErr) {
              try { lastUpsertRef.current.delete(keyUp); } catch {}
              throw upsertErr;
            }

            const arraysEqual = (a?: number[] | null, b?: number[] | null) => {
              const aa = Array.isArray(a) ? a : [];
              const bb = Array.isArray(b) ? b : [];
              if (aa.length !== bb.length) return false;
              const sa = [...aa].sort();
              const sb = [...bb].sort();
              for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
              return true;
            };

            const serverChanged = (() => {
              if (!previousServerRating) return true;
              if ((previousServerRating.idealDemarcationId ?? null) !== (currentPayload.idealDemarcationId ?? null)) return true;
              if ((previousServerRating.totalGoals ?? null) !== (currentPayload.totalGoals ?? null)) return true;
              if (!arraysEqual(previousServerRating.possibleDemarcationIds, currentPayload.possibleDemarcationIds)) return true;
              return false;
            })();

            if (!createdNow && !needReloadSelectionRef.current && !serverChanged) {
            } else {
              try {
                await reloadRatings();
                if (needReloadSelectionRef.current) {
                  try { if (reloadSelection) await reloadSelection(); } catch {}
                  needReloadSelectionRef.current = false;
                }
              } catch {}
            }
          }
          } catch (err) {
        }

        // seed subsequent days if newly created
        try {
          if (createdNow && Array.isArray(days) && typeof activeDayIndex === 'number') {
            if (!trialPlayerId) {
              return;
            }
            const subsequent = days.slice(activeDayIndex + 1);
            for (const d of subsequent) {
              const seedPayload = {
                trialPlayerId,
                score: null,
                totalGoals: (player as any).totalGoals ?? null,
                status: null,
                idealDemarcationId: player.idealDemarcationId ?? null,
                possibleDemarcationIds: player.possibleDemarcationIds ?? [],
              };
              try {
                try { lastUpsertRef.current.set(`${d.id}|${trialPlayerId}`, seedPayload); } catch {}
                const federationCodeToUseSeed = player.federationPlayerCode ?? createdFederationCode ?? String(trialPlayerId);
                const seedSnapshotPayload = {
                  seasonId,
                  category: category,
                  divisionCategory: player.category ?? category,
                  federationPlayerCode: federationCodeToUseSeed,
                  playerName: player.name || 'Jugador',
                  teamCode: player.teamCode ?? player.teamName ?? 'manual',
                  teamName: player.teamName ?? player.teamCode ?? 'manual',
                  birthYear: player.birthYear ?? null,
                  totalGoals: (player as any).totalGoals ?? null,
                  possibleDemarcationIds: player.possibleDemarcationIds ?? [],
                  idealDemarcationId: player.idealDemarcationId ?? null,
                  score: null,
                  trialDayId: d.id,
                } as any;
                await saveSeasonAccessPlayer(seedSnapshotPayload);
                } catch (seedErr) {
                try { lastUpsertRef.current.delete(`${d.id}|${trialPlayerId}`); } catch {}
              }
            }
          }
        } catch (err) {
          // ignore
        }
      } catch (err) {
      }
    }, 1500);
    saveTimersRef.current.set(key, timer);
  }

  const mappedPlayers = buildMappedPlayersFromRatings(ratings, day.date);
  // debug traces removed
  const counts = ratingCounts ?? { rawCount: (rawRatings ?? []).length, filteredCount: (ratings ?? []).length, excludedCount: (excludedRatings ?? []).length };
  const isLoading = ratingsLoading || actionLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <div>
      <TestGrid initialPlayers={mappedPlayers} demarcations={demarcations} onPlayerChange={handlePlayerChange} onPlayerRemove={handleRemovePlayer} />
    </div>
  );
}

export default function TestsTab({
  selectedPlayers = [],
  demarcations = [],
  seasonId,
  category,
  reloadSelection,
}: Props) {
  const [activeDay, setActiveDay] = useState(0);
  const { days, loading: daysLoading, reload: reloadDays } = useTrialDays(seasonId, category);

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
          reloadSelection={reloadSelection}
          seasonId={seasonId}
          category={category}
          days={days}
          activeDayIndex={activeDay}
        />
      )}
    </div>
  );
}
