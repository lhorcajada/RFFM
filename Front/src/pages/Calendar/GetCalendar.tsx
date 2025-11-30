import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import Paper from "@mui/material/Paper";
import {
  CircularProgress,
  Typography,
  Tabs,
  Tab,
  Button,
  Box,
} from "@mui/material";
import CompetitionSelector from "../../components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../components/ui/GroupSelector/GroupSelector";
import styles from "./GetCalendar.module.css";
import useMatch, { computeMatchData } from "../../hooks/useMatch";
import MatchCard from "../../components/ui/MatchCard/MatchCard";
import { getCalendar } from "../../services/api";
import type {
  MatchApiResponse,
  MatchDay,
  MatchApiMatch,
} from "../../types/match";
import { parseTimeToHM } from "../../utils/match";

const STORAGE_PRIMARY = "rffm.primary_combination_id";
const STORAGE_KEY = "rffm.saved_combinations_v1";

export default function GetCalendar(): JSX.Element {
  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined
  );
  const [season] = useState<string>("21");
  const [loading, setLoading] = useState<boolean>(false);
  const [calendar, setCalendar] = useState<any | null>(null);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const autoSelectRef = useRef<boolean>(false);
  const location = useLocation();
  const [noConfig, setNoConfig] = useState<boolean>(false);
  const [competitionName, setCompetitionName] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");

  // Load primary configuration on mount
  useEffect(() => {
    // Prefer explicit current selection (applied from Settings) if present
    try {
      const cur = localStorage.getItem("rffm.current_selection");
      if (cur) {
        try {
          const combo = JSON.parse(cur);
          if (combo) {
            setSelectedCompetition(combo.competition?.id);
            setSelectedGroup(combo.group?.id);
            setCompetitionName(combo.competition?.name || "");
            setGroupName(combo.group?.name || "");
            setNoConfig(false);
            return;
          }
        } catch (e) {
          // fall through to saved combos
        }
      }

      const primaryId = localStorage.getItem(STORAGE_PRIMARY);
      if (!primaryId) {
        setNoConfig(true);
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setNoConfig(true);
        return;
      }
      const combos = JSON.parse(stored) as any[];
      let primary: any = null;
      if (Array.isArray(combos) && combos.length > 0) {
        // Try to find by stored primary id (compare as strings)
        const foundById = combos.find(
          (c: any) => String(c.id) === String(primaryId)
        );
        if (foundById) primary = foundById;
        // Fallback to explicit isPrimary flag
        if (!primary)
          primary = combos.find((c: any) => c.isPrimary) || combos[0];
      }

      if (primary) {
        setSelectedCompetition(primary.competition?.id);
        setSelectedGroup(primary.group?.id);
        setCompetitionName(primary.competition?.name || "");
        setGroupName(primary.group?.name || "");
        setNoConfig(false);
      } else {
        setNoConfig(true);
      }
    } catch (e) {
      setNoConfig(true);
    }
  }, []);

  // Load calendar when competition/group changes
  useEffect(() => {
    // Use persistent ref so we auto-select only once (first load)
    // However, if navigation passed `state.resetToCurrent`, allow re-auto-select.
    try {
      const navState = (location && (location as any).state) || null;
      if (navState && navState.resetToCurrent) {
        autoSelectRef.current = false;
      }
    } catch (e) {
      // ignore
    }
    async function load() {
      if (!selectedCompetition || !selectedGroup) {
        setCalendar(null);
        return;
      }
      try {
        setLoading(true);
        const data = await getCalendar({
          season,
          competition: selectedCompetition,
          group: selectedGroup,
          playType: "1",
        });
        // API may return either the old `rounds/jornadas` shape or the new
        // `matchDays` payload. Normalize `matchDays` into a rounds-like
        // structure expected by the UI while keeping the original when
        // necessary.
        if (data && (data as MatchApiResponse).matchDays) {
          const md = (data as MatchApiResponse).matchDays as MatchDay[];
          // Convert each matchDay into a Round-like object with `equipos` array
          const roundsFromDays = (md || []).map((d: MatchDay) => ({
            codjornada: d.matchDayNumber ?? undefined,
            jornada: d.matchDayNumber ?? undefined,
            equipos: (d.matches ?? []) as MatchApiMatch[],
            raw: d,
          }));
          setCalendar({ rounds: roundsFromDays } as any);
        } else {
          setCalendar(data ?? null);
        }

        // Normalize rounds from the freshly loaded `data` so we can compute
        // selectedTab deterministically before updating React state.
        let rounds: any[] = [];
        if (data && (data as MatchApiResponse).matchDays) {
          const md = (data as MatchApiResponse).matchDays as MatchDay[];
          rounds = (md || []).map((d: MatchDay) => ({
            codjornada: d.matchDayNumber ?? undefined,
            jornada: d.matchDayNumber ?? undefined,
            equipos: (d.matches ?? []) as MatchApiMatch[],
            raw: d,
          }));
        } else {
          rounds = (data?.rounds ?? data?.jornadas ?? []) as any[];
        }

        if (Array.isArray(rounds) && rounds.length > 0) {
          const now = new Date();
          const { monday, sunday } = weekRangeFor(now);
          let foundIndex: number | null = null;
          for (let ri = rounds.length - 1; ri >= 0; ri--) {
            const round = rounds[ri];
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

          const visibleForAuto = rounds.filter((rr: any) => {
            const m = rr.equipos ?? rr.partidos ?? rr.matches ?? [];
            return Array.isArray(m) && m.length > 0;
          });

          // Search for current week inside visible rounds (visible index)
          let foundVisibleIndex: number | null = null;
          for (let vi = 0; vi < visibleForAuto.length; vi++) {
            const round = visibleForAuto[vi];
            const matches =
              round.equipos ?? round.partidos ?? round.matches ?? [];
            for (const m of matches) {
              const raw = m.fecha ?? m.date ?? m.fecha_partido ?? null;
              const dt = parseMatchDate(raw);
              if (!dt) continue;
              if (dt >= monday && dt <= sunday) {
                foundVisibleIndex = vi;
                break;
              }
            }
            if (foundVisibleIndex !== null) break;
          }

          try {
            if (
              (import.meta as any).env &&
              (import.meta as any).env.MODE !== "production"
            ) {
              console.debug("GetCalendar auto-select debug", {
                roundsLength: rounds.length,
                monday: monday.toISOString(),
                sunday: sunday.toISOString(),
                foundIndex,
                foundVisibleIndex,
              });
            }
          } catch (e) {
            // ignore
          }

          if (!autoSelectRef.current) {
            if (foundVisibleIndex !== null) {
              setSelectedTab(foundVisibleIndex);
            } else if (foundIndex !== null) {
              const mapIdx = visibleForAuto.findIndex(
                (vr: any) => vr === rounds[foundIndex!]
              );
              setSelectedTab(mapIdx >= 0 ? mapIdx : 0);
            } else {
              const fallback = getClosestRoundIndex(visibleForAuto, new Date());
              setSelectedTab(fallback !== null ? fallback : 0);
            }
            autoSelectRef.current = true;
          }

          // Update calendar state with normalized rounds
          setCalendar({ rounds } as any);
        } else {
          if (!autoSelectRef.current) {
            setSelectedTab(0);
            autoSelectRef.current = true;
          }
          setCalendar({ rounds: [] } as any);
        }
      } catch (err) {
        setCalendar(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedCompetition, selectedGroup, season, location.key]);

  function roundsList(): any[] {
    if (!calendar) return [];
    const rounds = calendar.rounds ?? calendar.jornadas ?? [];
    return Array.isArray(rounds) ? rounds : [];
  }

  function groupMatchesByWeekend(matches: any[]): {
    saturday: any[];
    sunday: any[];
    other: any[];
  } {
    const saturday: any[] = [];
    const sunday: any[] = [];
    const other: any[] = [];

    (matches || []).forEach((m) => {
      const raw = m.fecha ?? m.date ?? m.fecha_partido ?? "";
      let d = null;
      if (raw) {
        let normalized = raw.replace(/\//g, "-").trim();
        const parts = normalized.split("-").map((p: string) => p.trim());
        if (
          parts.length >= 3 &&
          parts[0].length === 2 &&
          parts[2].length === 4
        ) {
          normalized = `${parts[2]}-${parts[1].padStart(
            2,
            "0"
          )}-${parts[0].padStart(2, "0")}`;
        }
        const parsed = new Date(normalized);
        if (!isNaN(parsed.getTime())) d = parsed;
      }

      const item = { rawDate: raw, parsedDate: d, match: m };

      if (d) {
        const dayOfWeek = d.getDay(); // 0=Sunday, 6=Saturday
        if (dayOfWeek === 6) {
          saturday.push(item);
        } else if (dayOfWeek === 0) {
          sunday.push(item);
        } else {
          other.push(item);
        }
      } else {
        other.push(item);
      }
    });

    return { saturday, sunday, other };
  }

  const visibleRounds = roundsList().filter((rr: any) => {
    const m = rr.equipos ?? rr.partidos ?? rr.matches ?? [];
    return Array.isArray(m) && m.length > 0;
  });

  useEffect(() => {
    if (visibleRounds.length === 0) {
      setSelectedTab(0);
      return;
    }
    if (selectedTab >= visibleRounds.length) {
      setSelectedTab(0);
    }
  }, [visibleRounds.length]);

  // Helper: parse date strings from match objects
  function parseMatchDate(raw?: string | null): Date | null {
    if (!raw) return null;
    let s = String(raw).trim();
    if (!s) return null;
    // Normalize dd/mm/yyyy or dd-mm-yyyy -> yyyy-mm-dd
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

  // Helper: choose the round index with a match date closest to reference date
  function getClosestRoundIndex(rounds: any[], reference: Date): number | null {
    let bestIdx: number | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let ri = 0; ri < rounds.length; ri++) {
      const round = rounds[ri];
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

  // parseTimeToHM imported from utils/match

  // Compute current week Monday..Sunday range (local)
  function weekRangeFor(date: Date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun,1=Mon
    // compute Monday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }

  // (old initial auto-select removed — selection happens when calendar data is loaded)

  return (
    <BaseLayout className={styles.paper}>
      <div className={styles.filters}>
        {noConfig ? (
          <Typography variant="body2">
            No hay configuración principal guardada.
          </Typography>
        ) : null}
      </div>

      {selectedCompetition && selectedGroup && (
        <PageHeader
          title={competitionName}
          subtitle={`${groupName} • Calendario`}
        />
      )}

      {loading ? (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      ) : !calendar ? (
        <Typography variant="body2">
          Selecciona temporada, competición y grupo para ver el calendario.
        </Typography>
      ) : (
        <div className={styles.tabsRoot}>
          {visibleRounds.length === 0 ? (
            <Typography variant="body2">
              No hay jornadas con partidos para la selección actual.
            </Typography>
          ) : (
            <>
              <Tabs
                value={selectedTab}
                onChange={(_, v) => setSelectedTab(v)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {visibleRounds.map((r: any, i: number) => (
                  <Tab key={i} label={`Jornada ${i + 1}`} />
                ))}
              </Tabs>

              {visibleRounds.map((r: any, i: number) => {
                const allMatches = r.equipos ?? r.partidos ?? r.matches ?? [];
                const grouped = groupMatchesByWeekend(allMatches);

                // Get formatted dates for headers
                const saturdayDate = grouped.saturday[0]?.parsedDate
                  ? grouped.saturday[0].parsedDate.toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                    })
                  : "";

                const sundayDate = grouped.sunday[0]?.parsedDate
                  ? grouped.sunday[0].parsedDate.toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                    })
                  : "";

                // sort helper: compare two match items by time then date
                function sortByTime(a: any, b: any) {
                  const ta =
                    parseTimeToHM(
                      a.rawDate?.includes(" ")
                        ? a.rawDate.split(" ").pop()
                        : a.match?.hora ?? a.match?.time ?? ""
                    ) ||
                    parseTimeToHM(a.match?.hora) ||
                    parseTimeToHM(a.match?.time) ||
                    null;
                  const tb =
                    parseTimeToHM(
                      b.rawDate?.includes(" ")
                        ? b.rawDate.split(" ").pop()
                        : b.match?.hora ?? b.match?.time ?? ""
                    ) ||
                    parseTimeToHM(b.match?.hora) ||
                    parseTimeToHM(b.match?.time) ||
                    null;

                  if (ta && tb) {
                    if (ta.h !== tb.h) return ta.h - tb.h;
                    return ta.m - tb.m;
                  }
                  // fallback to parsedDate comparison
                  const da = a.parsedDate ? a.parsedDate.getTime() : null;
                  const db = b.parsedDate ? b.parsedDate.getTime() : null;
                  if (da !== null && db !== null) return da - db;
                  if (da !== null) return -1;
                  if (db !== null) return 1;
                  // final fallback: raw string compare
                  const ra = String(a.rawDate ?? a.match?.fecha ?? "");
                  const rb = String(b.rawDate ?? b.match?.fecha ?? "");
                  return ra.localeCompare(rb);
                }

                return (
                  <div key={i} hidden={selectedTab !== i}>
                    {grouped.saturday.length > 0 && (
                      <div className={styles.dateGroup}>
                        <div className={styles.dateHeader}>
                          Sábado {saturdayDate}
                        </div>
                        <div className={styles.matchesGrid}>
                          {grouped.saturday
                            .slice()
                            .sort(sortByTime)
                            .map((it: any, idx: number) => (
                              <MatchCard key={idx} item={it} />
                            ))}
                        </div>
                      </div>
                    )}

                    {grouped.sunday.length > 0 && (
                      <div className={styles.dateGroup}>
                        <div className={styles.dateHeader}>
                          Domingo {sundayDate}
                        </div>
                        <div className={styles.matchesGrid}>
                          {grouped.sunday
                            .slice()
                            .sort(sortByTime)
                            .map((it: any, idx: number) => (
                              <MatchCard key={idx} item={it} />
                            ))}
                        </div>
                      </div>
                    )}

                    {grouped.other.length > 0 && (
                      <div className={styles.dateGroup}>
                        <div className={styles.dateHeader}>Descanso</div>
                        <div className={styles.matchesGrid}>
                          {grouped.other
                            .slice()
                            .sort(sortByTime)
                            .map((it: any, idx: number) => (
                              <MatchCard key={idx} item={it} />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </BaseLayout>
  );
}
