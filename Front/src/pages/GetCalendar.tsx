import React, { useEffect, useState, useRef } from "react";
import Paper from "@mui/material/Paper";
import {
  CircularProgress,
  Typography,
  Tabs,
  Tab,
  Button,
  Box,
} from "@mui/material";
import CompetitionSelector from "../components/ui/CompetitionSelector";
import GroupSelector from "../components/ui/GroupSelector";
import styles from "./GetCalendar.module.css";
import MatchCard from "../components/ui/MatchCard";
import { getCalendar } from "../services/api";

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
  const [noConfig, setNoConfig] = useState<boolean>(false);
  const [competitionName, setCompetitionName] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");

  // Load primary configuration on mount
  useEffect(() => {
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
    try {
      const combos = JSON.parse(stored);
      const primary = combos.find((c: any) => c.id === primaryId);
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
        // API returns object with rounds/jornadas
        setCalendar(data ?? null);

        // after setting calendar, compute the round that contains matches in the current week
        const rounds = (data?.rounds ?? data?.jornadas ?? []) as any[];
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
          if (foundIndex !== null) setSelectedTab(foundIndex);
          else setSelectedTab(0);
        } else {
          setSelectedTab(0);
        }
      } catch (err) {
        setCalendar(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedCompetition, selectedGroup, season]);

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

  // Helper: parse time like "17:30" or "17:30h" or "5:30" -> {h,m} or null
  function parseTimeToHM(
    time?: string | null
  ): { h: number; m: number } | null {
    if (!time) return null;
    let s = String(time).trim();
    // remove trailing letters like 'h' or 'hs'
    s = s.replace(/[a-zA-Z]+$/g, "").trim();
    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
    const m2 = s.match(/^(\d{1,2})$/);
    if (m2) return { h: parseInt(m2[1], 10), m: 0 };
    return null;
  }

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
    <Paper className={styles.paper}>
      <div className={styles.filters}>
        {noConfig ? (
          <Typography variant="body2">
            No hay configuración principal guardada.
          </Typography>
        ) : null}
      </div>

      {selectedCompetition && selectedGroup && (
        <Box
          sx={{
            textAlign: "center",
            py: 3,
            px: 2,
            mb: 3,
            background:
              "linear-gradient(135deg, rgba(0,160,200,0.1) 0%, rgba(0,120,180,0.05) 100%)",
            borderRadius: "12px",
            border: "1px solid rgba(0,160,200,0.2)",
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #00a0c8 0%, #0078b4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              mb: 0.5,
              letterSpacing: "-0.5px",
            }}
          >
            {competitionName}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontSize: "0.75rem",
            }}
          >
            {groupName} • Calendario
          </Typography>
        </Box>
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

                return (
                  <div key={i} hidden={selectedTab !== i}>
                    {grouped.saturday.length > 0 && (
                      <div className={styles.dateGroup}>
                        <div className={styles.dateHeader}>
                          Sábado {saturdayDate}
                        </div>
                        <div className={styles.matchesGrid}>
                          {grouped.saturday.map((it: any, idx: number) => (
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
                          {grouped.sunday.map((it: any, idx: number) => (
                            <MatchCard key={idx} item={it} />
                          ))}
                        </div>
                      </div>
                    )}

                    {grouped.other.length > 0 && (
                      <div className={styles.dateGroup}>
                        <div className={styles.dateHeader}>Otros días</div>
                        <div className={styles.matchesGrid}>
                          {grouped.other.map((it: any, idx: number) => (
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
    </Paper>
  );
}
