import { useEffect, useRef, useState } from "react";
import { getCalendarMatchDay } from "../../apps/federation/services/api";
import type {
  CalendarMatch,
  CalendarMatchDayWithRoundsResponse,
  CalendarRoundInfo,
} from "../../apps/federation/types/calendarMatchDay";

type UseCalendarParams = {
  season: string;
  competition?: string | undefined;
  group?: string | undefined;
  // navKey is used to force resetting auto-select when navigation requests it
  navKey?: string | null | undefined;
};

export default function useCalendar({
  season,
  competition,
  group,
  navKey,
}: UseCalendarParams) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [calendar, setCalendar] =
    useState<CalendarMatchDayWithRoundsResponse | null>(null);
  const [rounds, setRounds] = useState<CalendarRoundInfo[]>([]);
  const [matchesByRound, setMatchesByRound] = useState<
    Record<number, CalendarMatch[]>
  >({});
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const autoSelectRef = useRef<boolean>(false);
  const lastNavKey = useRef<string | null | undefined>(null);
  const currentRoundRef = useRef<number>(0);

  function parseRoundDate(raw?: string | null): Date | null {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  }

  // Compute Monday..Sunday range used for auto-select
  function weekRangeFor(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }

  useEffect(() => {
    // reset auto-select if navKey changed externally
    if (lastNavKey.current !== navKey) {
      autoSelectRef.current = false;
      lastNavKey.current = navKey;
    }

    async function load() {
      if (!competition || !group) {
        setCalendar(null);
        setRounds([]);
        setMatchesByRound({});
        currentRoundRef.current = 0;
        return;
      }
      try {
        setLoading(true);
        setError(null);

        // Bootstrap: pedimos una jornada (1) para obtener listado de jornadas y primeros partidos
        const bootstrapRound = 1;
        const bootstrap = await getCalendarMatchDay({
          season,
          group,
          round: bootstrapRound,
          playType: "1",
        });

        const roundsList = (bootstrap.rounds || [])
          .slice()
          .sort((a, b) => a.matchDayNumber - b.matchDayNumber);

        setRounds(roundsList);

        if (!autoSelectRef.current && roundsList.length > 0) {
          const now = new Date();
          const { monday, sunday } = weekRangeFor(now);

          let preferredIdx: number | null = null;
          for (let i = 0; i < roundsList.length; i++) {
            const dt = parseRoundDate(roundsList[i].date);
            if (!dt) continue;
            if (dt >= monday && dt <= sunday) {
              preferredIdx = i;
              break;
            }
          }

          if (preferredIdx === null) {
            let bestDiff = Number.POSITIVE_INFINITY;
            for (let i = 0; i < roundsList.length; i++) {
              const dt = parseRoundDate(roundsList[i].date);
              if (!dt) continue;
              const diff = Math.abs(dt.getTime() - now.getTime());
              if (diff < bestDiff) {
                bestDiff = diff;
                preferredIdx = i;
              }
            }
          }

          const idx = preferredIdx ?? 0;
          setSelectedTab(idx);
          autoSelectRef.current = true;

          const preferredRound =
            roundsList[idx]?.matchDayNumber ?? bootstrapRound;
          currentRoundRef.current = preferredRound;

          // Cache only past rounds (strictly before the current round)
          if (bootstrapRound < preferredRound) {
            setMatchesByRound((prev) => ({
              ...prev,
              [bootstrapRound]: bootstrap.matchDay?.matches || [],
            }));
          }

          if (preferredRound !== bootstrapRound) {
            const preferred = await getCalendarMatchDay({
              season,
              group,
              round: preferredRound,
              playType: "1",
            });
            setCalendar(preferred);
          } else {
            setCalendar(bootstrap);
          }
        } else {
          // No rounds: keep bootstrap as calendar and treat it as current
          currentRoundRef.current = bootstrapRound;
          setCalendar(bootstrap);
        }
      } catch (e) {
        setError(e);
        setCalendar(null);
        setRounds([]);
        setMatchesByRound({});
        currentRoundRef.current = 0;
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [season, competition, group, navKey]);

  useEffect(() => {
    if (!competition || !group) return;
    if (!rounds || rounds.length === 0) return;
    if (selectedTab < 0 || selectedTab >= rounds.length) return;

    const roundNumber = rounds[selectedTab]?.matchDayNumber;
    if (!roundNumber || roundNumber <= 0) return;
    if (matchesByRound[roundNumber]) return;

    let cancelled = false;
    async function loadRound() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCalendarMatchDay({
          season,
          group,
          round: roundNumber,
          playType: "1",
        });
        if (cancelled) return;
        setCalendar(data);

        // Cache only rounds strictly before the current (auto-selected) round.
        if (roundNumber < currentRoundRef.current) {
          setMatchesByRound((prev) => ({
            ...prev,
            [roundNumber]: data.matchDay?.matches || [],
          }));
        }
      } catch (e) {
        if (cancelled) return;
        setError(e);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    loadRound();
    return () => {
      cancelled = true;
    };
  }, [selectedTab, rounds, matchesByRound, season, competition, group]);

  useEffect(() => {
    if (rounds.length > 0 && selectedTab >= rounds.length) {
      setSelectedTab(0);
    }
  }, [rounds, selectedTab]);

  return {
    calendar,
    rounds,
    roundsMeta: rounds,
    matchesByRound,
    loading,
    error,
    selectedTab,
    setSelectedTab,
  } as const;
}
