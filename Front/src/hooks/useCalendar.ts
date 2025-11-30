import { useEffect, useRef, useState } from "react";
import { getCalendar } from "../services/api";

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
  const [error, setError] = useState<any>(null);
  const [calendar, setCalendar] = useState<any | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [visibleRounds, setVisibleRounds] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const autoSelectRef = useRef<boolean>(false);
  const lastNavKey = useRef<string | null | undefined>(null);

  // Helper: parse date strings from match objects (local copy)
  function parseMatchDate(raw?: string | null): Date | null {
    if (!raw) return null;
    let s = String(raw).trim();
    if (!s) return null;
    s = s.replace(/\//g, "-").trim();
    const parts = s.split("-").map((p: string) => p.trim());
    if (parts.length >= 3 && parts[0].length === 2 && parts[2].length === 4) {
      s = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(
        2,
        "0"
      )}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  function getClosestRoundIndex(rs: any[], reference: Date): number | null {
    let bestIdx: number | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let ri = 0; ri < rs.length; ri++) {
      const round = rs[ri];
      const matches = round.equipos ?? round.partidos ?? round.matches ?? [];
      for (const m of matches) {
        const raw = m.fecha ?? m.date ?? m.fecha_partido ?? null;
        const dt = parseMatchDate(raw);
        if (!dt) continue;
        const diff = Math.abs(dt.getTime() - reference.getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = ri;
        }
      }
    }
    return bestIdx;
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
        setVisibleRounds([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await getCalendar({
          season,
          competition,
          group,
          playType: "1",
        });

        let normalizedRounds: any[] = [];
        if (data && (data as any).matchDays) {
          const md = (data as any).matchDays as any[];
          normalizedRounds = (md || []).map((d: any) => ({
            codjornada: d.matchDayNumber ?? undefined,
            jornada: d.matchDayNumber ?? undefined,
            equipos: (d.matches ?? []) as any[],
            raw: d,
          }));
        } else {
          normalizedRounds = (data?.rounds ?? data?.jornadas ?? []) as any[];
        }

        setCalendar(data ?? null);
        setRounds(normalizedRounds ?? []);

        const visible = (normalizedRounds || []).filter((rr: any) => {
          const m = rr.equipos ?? rr.partidos ?? rr.matches ?? [];
          return Array.isArray(m) && m.length > 0;
        });
        setVisibleRounds(visible);

        // Auto-select logic (only once per mount unless navKey reset)
        if (
          !autoSelectRef.current &&
          Array.isArray(visible) &&
          visible.length > 0
        ) {
          const now = new Date();
          const { monday, sunday } = weekRangeFor(now);
          let foundIndex: number | null = null;
          for (let ri = (normalizedRounds || []).length - 1; ri >= 0; ri--) {
            const round = normalizedRounds[ri];
            const matches =
              round.equipos ?? round.partidos ?? round.matches ?? [];
            for (const m of matches) {
              const raw = m.fecha ?? m.date ?? m.fecha_partido ?? null;
              const dt = parseMatchDate(raw);
              if (!dt) continue;
              if (dt >= monday && dt <= sunday) {
                foundIndex = ri;
                break;
              }
            }
            if (foundIndex !== null) break;
          }

          if (foundIndex !== null) {
            const mapIdx = visible.findIndex(
              (vr: any) => vr === normalizedRounds[foundIndex!]
            );
            setSelectedTab(mapIdx >= 0 ? mapIdx : 0);
          } else {
            const fallback = getClosestRoundIndex(visible, new Date());
            setSelectedTab(fallback !== null ? fallback : 0);
          }
          autoSelectRef.current = true;
        }
      } catch (e) {
        setError(e);
        setCalendar(null);
        setRounds([]);
        setVisibleRounds([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [season, competition, group, navKey]);

  return {
    calendar,
    rounds,
    visibleRounds,
    loading,
    error,
    selectedTab,
    setSelectedTab,
  } as const;
}
