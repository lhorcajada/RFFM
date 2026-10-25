import { useEffect, useState } from "react";
import { getCalendar } from "../../../../federation/services/api";
import type { CalendarMatch } from "../../../../federation/types/calendarMatchDay";
import type { MatchApiResponse } from "../../../../federation/types/match";
import { isBye, isOwnMatch, type OwnRoundEntry } from "../utils/ownMatch";

type Params = {
  season: string;
  competition?: string;
  group?: string;
  teamCode?: string | null;
};

export default function useOwnTeamSeason({ season, competition, group, teamCode }: Params) {
  const [ownByRound, setOwnByRound] = useState<Record<number, OwnRoundEntry>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setOwnByRound({});
    setError(false);
    if (!competition || !group || !teamCode) return;

    let cancelled = false;
    setLoading(true);
    getCalendar({ season, competition, group })
      .then((response) => {
        if (cancelled) return;
        const byRound: Record<number, OwnRoundEntry> = {};
        for (const day of (response as MatchApiResponse).matchDays ?? []) {
          const number = Number(day.matchDayNumber);
          if (!number) continue;
          const own = ((day.matches ?? []) as CalendarMatch[]).filter((m) => isOwnMatch(m, teamCode));
          const played = own.find((m) => !isBye(m));
          if (played) byRound[number] = played;
          else if (own.length > 0) byRound[number] = "bye";
        }
        setOwnByRound(byRound);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [season, competition, group, teamCode]);

  return { ownByRound, loading, error } as const;
}
