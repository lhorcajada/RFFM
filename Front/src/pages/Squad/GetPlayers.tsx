import React, { useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import "../../styles/gameTheme.css";
import styles from "./GetPlayers.module.css";
import teamStyles from "../../styles/TeamCard.module.css";
import type { PlayerDetailsResponse } from "../../types/player";
import {
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Paper,
  Typography,
  Tooltip,
  Button,
  IconButton,
  Modal,
  Box,
} from "@mui/material";
// Using inline SVG for jersey icon (shows a small shirt) instead of Checkroom hanger icon

import {
  getPlayersByTeam,
  getPlayer,
  getTeamAgeSummary,
  getTeamGoalSectors,
  getTeamParticipationSummary,
} from "../../services/api";
import AgeSummaryBox from "../../components/players/AgeSummaryBox/AgeSummaryBox";
import PlayerStatsCard from "../../components/players/PlayerStatsCard/PlayerStatsCard";
import StaffCard from "../../components/teams/StaffCard/StaffCard";
import Address from "../../components/teams/Address/Address";
import PlayersContainer from "../../components/players/PlayersContainer/PlayersContainer";
import playersStyles from "../../components/players/PlayersContainer/PlayersContainer.module.css";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import {
  YellowCardIcon,
  RedCardIcon,
} from "../../components/ui/CardIcons/CardIcons";

function extractPlayerIdFromUrl(u?: string): string | null {
  if (!u) return null;
  try {
    const m = u.match(/(players|fichajugador|jugador)\/(\d+)/i);
    if (m && m[2]) return m[2];
    const m2 = u.match(/(\d{5,})/);
    if (m2) return m2[0];
    return null;
  } catch (e) {
    return null;
  }
}

type Team = { id: string | number; name: string; url?: string };

type Player = {
  id: number;
  name: string;
  url?: string;
  email?: string;
  playerId?: string | number;
  jerseyNumber?: string | number | null;
  age?: number | null;
  teamParticipations?: Array<{
    competitionName: string;
    groupName: string;
    teamName: string;
    teamPoints: number;
    seasonId?: number;
    seasonName?: string;
  }>;
  raw?: any;
  matches?: any;
  cards?: any;
  competitions?: any[];
};

export default function GetPlayers(): JSX.Element {
  const [selectedTeam, setSelectedTeam] = useState<Team | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(0);
  const [ageCounts, setAgeCounts] = useState<Record<number, number>>({});
  const [groupCounts, setGroupCounts] = useState<
    Array<{
      competitionName: string;
      teamName: string;
      teamPoints: number;
      count: number;
    }>
  >([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] =
    useState<PlayerDetailsResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined
  );
  const [teamDetails, setTeamDetails] = useState<any | null>(null);

  const [noConfig, setNoConfig] = useState<boolean>(false);
  const [showAgePopup, setShowAgePopup] = useState<boolean>(false);
  const [ageSummary, setAgeSummary] = useState<Record<number, number>>({});
  const [loadingAge, setLoadingAge] = useState<boolean>(false);
  const [showParticipationPopup, setShowParticipationPopup] =
    useState<boolean>(false);
  const [participationData, setParticipationData] = useState<any[]>([]);
  const [loadingParticipation, setLoadingParticipation] =
    useState<boolean>(false);
  const [showGoalSectors, setShowGoalSectors] = useState<boolean>(false);
  const [goalSectorsData, setGoalSectorsData] = useState<any | null>(null);
  const [loadingGoalSectors, setLoadingGoalSectors] = useState<boolean>(false);

  // Load initial configuration from localStorage (runs once on mount)
  useEffect(() => {
    try {
      const rawList = localStorage.getItem("rffm.saved_combinations_v1");
      const list = rawList ? JSON.parse(rawList) : [];
      let combo: any = null;
      if (Array.isArray(list) && list.length > 0) {
        const primaryId = localStorage.getItem("rffm.primary_combination_id");
        if (primaryId) {
          combo = list.find((c: any) => String(c.id) === String(primaryId));
        }
        if (!combo) {
          combo = list.find((c: any) => c.isPrimary) || list[0];
        }
      }
      if (!combo || !combo.team) {
        setNoConfig(true);
      } else {
        setSelectedCompetition(combo.competition?.id ?? undefined);
        setSelectedGroup(combo.group?.id ?? undefined);
        setSelectedTeam({
          id: combo.team.id,
          name: combo.team.name,
          url: combo.team.url,
        });
      }
    } catch (e) {
      setNoConfig(true);
    }
  }, []); // Empty dependency array - only runs once on mount

  // Load players when selectedTeam changes
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setError(null);
        if (!selectedTeam) {
          if (mounted) {
            setPlayers([]);
            setAgeCounts({});
            setGroupCounts([]);
            setTeamDetails(null);
          }
          return;
        }

        if (mounted) setLoading(true);

        const teamId = String(selectedTeam.id);
        const payload = await getPlayersByTeam(teamId);

        let list: any[] = [];
        // Support different API shapes: array, { players: [...] }, or { jugadores_equipo: [...] }
        if (Array.isArray(payload)) list = payload as any[];
        else if (payload && Array.isArray((payload as any).players))
          list = (payload as any).players;
        else if (payload && Array.isArray((payload as any).jugadores_equipo))
          list = (payload as any).jugadores_equipo;

        if (payload && (payload as any).team) {
          const baseTeam = (payload as any).team;
          if (selectedTeam && (selectedTeam as any).raw) {
            baseTeam.classification = (selectedTeam as any).raw;
          }
          setTeamDetails(baseTeam);
        } else {
          setTeamDetails((selectedTeam as any)?.raw ?? null);
        }

        const mapped: Player[] = list.map((p: any, idx: number) => {
          const raw = p.ace ?? p.age ?? null;
          let age: number | null = null;
          if (raw !== null && raw !== undefined && raw !== "") {
            const n = Number(raw);
            if (!Number.isNaN(n)) age = n;
            else {
              const m = String(raw).match(/(\d{1,2})/);
              if (m && m[1]) age = Number(m[1]);
            }
          }
          // Map common and Spanish API fields into our Player shape
          const name = p.name ?? p.nombre ?? "";
          const playerId = p.playerId ?? p.id ?? p.cod_jugador ?? null;
          const jersey =
            p.jerseyNumber ?? p.dorsalNumber ?? p.dorsal ?? p.number ?? null;
          return {
            id: idx + 1,
            name,
            url: p.url || p.link || "",
            email: p.url || "",
            playerId,
            jersey,
            jerseyNumber: jersey,
            age,
            teamParticipations: p.teamParticipations || p.participaciones || [],
            // keep mapped/raw payload so we can reuse it when opening details
            raw: p,
            matches: p.matches || p.partidos || null,
            cards: p.cards || p.tarjetas || null,
            competitions: p.competitions || p.competiciones || [],
          };
        });

        if (mounted) {
          setPlayers(mapped);
          setDisplayCount(mapped.length);
          const counts = mapped.reduce<Record<number, number>>((acc, p) => {
            const a = p.age ?? null;
            if (a === null) return acc;
            acc[a] = (acc[a] || 0) + 1;
            return acc;
          }, {});
          setAgeCounts(counts);

          const groupsMap = new Map<
            string,
            {
              competitionName: string;
              teamName: string;
              teamPoints: number;
              count: number;
            }
          >();
          mapped.forEach((p) => {
            const tps = (p as any).teamParticipations || [];
            (tps as any[]).forEach((tp) => {
              const key = `${tp.competitionName}||${tp.teamName}`;
              const existing = groupsMap.get(key);
              if (existing) {
                existing.count++;
                if (tp.teamPoints !== undefined && tp.teamPoints !== null)
                  existing.teamPoints = tp.teamPoints;
              } else {
                groupsMap.set(key, {
                  competitionName: tp.competitionName,
                  teamName: tp.teamName,
                  teamPoints: tp.teamPoints ?? 0,
                  count: 1,
                });
              }
            });
          });
          setGroupCounts(Array.from(groupsMap.values()));
        }
      } catch (err: unknown) {
        if (mounted) setError(String((err as Error).message || err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [selectedTeam]);

  return (
    <BaseLayout>
      <div className={styles.filters}>
        {noConfig ? (
          <Typography variant="body2">
            No hay configuración principal guardada.
          </Typography>
        ) : null}
      </div>

      {selectedTeam && (
        <PageHeader title={selectedTeam.name} subtitle="Plantilla del Equipo" />
      )}

      {/* Summary boxes are disabled for now. */}

      {teamDetails && (
        <Paper className={teamStyles.root}>
          <div className={teamStyles.header}>
            <div className={teamStyles.titleWrap}>
              <Typography className={teamStyles.subtitle}>
                Dirección del campo
              </Typography>
              <Address
                street={teamDetails.field}
                city={teamDetails.locality}
                postalCode={teamDetails.postalCode}
              />
            </div>
            {/* classification header removed to avoid duplication with summary */}
          </div>
          {teamDetails.classification && (
            <div className={teamStyles.classificationSummary}>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>Posición</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.position || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>Puntos</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.points || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>Jugados</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.played || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>G</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.won || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>E</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.drawn || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>P</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.lost || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>GF</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.goalsFor || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>GC</div>
                <div className={teamStyles.value}>
                  {teamDetails.classification.goalsAgainst || "-"}
                </div>
              </div>
              <div className={teamStyles.stat}>
                <div className={teamStyles.label}>Racha últimos 5 partidos</div>
                <div className={teamStyles.value}>
                  <div className={teamStyles.streak}>
                    {(
                      ((teamDetails.classification.matchStreaks || []) as any[])
                        .slice(-5)
                        .map((s: any) => (s.type || "").toUpperCase()) || []
                    ).map((t: string, i: number) => {
                      const key = `streak-${i}`;
                      const cls = `${teamStyles.dot} ${
                        t === "G"
                          ? teamStyles.g
                          : t === "E"
                          ? teamStyles.e
                          : t === "P"
                          ? teamStyles.p
                          : teamStyles.e
                      }`;
                      return <span key={key} className={cls} />;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Paper>
      )}

      {selectedTeam && !loading && (
        <>
          <div className={styles.actionBar}>
            <div className={styles.ageOverlay}>
              <Button
                size="small"
                variant="contained"
                onClick={async () => {
                  if (showAgePopup) {
                    setShowAgePopup(false);
                    return;
                  }
                  setShowAgePopup(true);
                  try {
                    setLoadingAge(true);
                    const id = String(
                      (selectedTeam as any).id || selectedTeam?.id
                    );
                    const data = await getTeamAgeSummary(id, "21");
                    const map: Record<number, number> = {};
                    (data || []).forEach((d: any) => {
                      const a = Number(d.age ?? d.ace ?? 0);
                      map[a] = Number(d.total ?? d.count ?? 0);
                    });
                    setAgeSummary(map);
                  } catch (err) {
                    setAgeSummary({});
                  } finally {
                    setLoadingAge(false);
                  }
                }}
              >
                Edades
              </Button>
              <Modal
                open={showAgePopup}
                onClose={() => setShowAgePopup(false)}
                aria-labelledby="age-summary-title"
                closeAfterTransition
              >
                <Box className={styles.modalContent}>
                  {loadingAge ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: 18,
                      }}
                    >
                      <CircularProgress size={28} color="inherit" />
                    </div>
                  ) : (
                    <AgeSummaryBox
                      playersCountByAge={ageSummary}
                      title="Resumen de edades"
                    />
                  )}
                </Box>
              </Modal>
            </div>
            <div>
              <Button
                size="small"
                variant="contained"
                onClick={async () => {
                  if (showGoalSectors) {
                    setShowGoalSectors(false);
                    return;
                  }
                  setShowGoalSectors(true);
                  try {
                    setLoadingGoalSectors(true);
                    const id = String(
                      (selectedTeam as any).id || selectedTeam?.id
                    );
                    const data = await getTeamGoalSectors(id, {
                      temporada: "21",
                      competicion: selectedCompetition ?? undefined,
                      grupo: selectedGroup ?? undefined,
                      tipojuego: "1",
                    });
                    setGoalSectorsData(data || null);
                  } catch (err) {
                    setGoalSectorsData(null);
                  } finally {
                    setLoadingGoalSectors(false);
                  }
                }}
              >
                Goles
              </Button>
              <Modal
                open={showGoalSectors}
                onClose={() => setShowGoalSectors(false)}
              >
                <Box className={styles.modalContent}>
                  {loadingGoalSectors ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: 18,
                      }}
                    >
                      <CircularProgress size={28} color="inherit" />
                    </div>
                  ) : goalSectorsData ? (
                    <div>
                      <div className={styles.goalSectorsHeader}>
                        <div>
                          <strong>Partidos procesados:</strong>&nbsp;
                          {goalSectorsData.matchesProcessed ?? 0}
                        </div>
                      </div>
                      <table className={styles.goalSectorsTable}>
                        <thead>
                          <tr>
                            <th>Desde (min)</th>
                            <th>Hasta (min)</th>
                            <th>Goles a favor</th>
                            <th>Goles en contra</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(goalSectorsData.sectors || []).map(
                            (s: any, i: number) => (
                              <tr key={i}>
                                <td>{s.startMinute ?? "-"}</td>
                                <td>{s.endMinute ?? "-"}</td>
                                <td>{s.goalsFor ?? 0}</td>
                                <td>{s.goalsAgainst ?? 0}</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div>No data</div>
                  )}
                </Box>
              </Modal>
            </div>
            <div>
              <Button
                size="small"
                variant="contained"
                onClick={async () => {
                  if (showParticipationPopup) {
                    setShowParticipationPopup(false);
                    return;
                  }
                  setShowParticipationPopup(true);
                  try {
                    setLoadingParticipation(true);
                    const id = String(
                      (selectedTeam as any).id || selectedTeam?.id
                    );
                    const data = await getTeamParticipationSummary(id, "21");
                    setParticipationData(data || []);
                  } catch (err) {
                    setParticipationData([]);
                  } finally {
                    setLoadingParticipation(false);
                  }
                }}
              >
                Participaciones
              </Button>
              <Modal
                open={showParticipationPopup}
                onClose={() => setShowParticipationPopup(false)}
                aria-labelledby="participation-summary-title"
                closeAfterTransition
              >
                <Box className={styles.modalContent}>
                  {loadingParticipation ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: 18,
                      }}
                    >
                      <CircularProgress size={28} color="inherit" />
                    </div>
                  ) : (
                    <div>
                      {participationData.map((p, idx) => (
                        <div key={idx} style={{ marginBottom: 8 }}>
                          <strong>
                            {p.competitionName} — {p.groupName}
                          </strong>
                          <div>
                            {p.teamName} ({p.teamCode}) — Puntos: {p.teamPoints}{" "}
                            — Jugadores: {p.count}
                          </div>
                          <ul style={{ margin: "6px 0 0 12px" }}>
                            {p.players.map((pl: any) => (
                              <li key={pl.playerId}>
                                {pl.name}{" "}
                                {pl.playerId ? `(${pl.playerId})` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </Box>
              </Modal>
            </div>
          </div>
          {/* Title moved to PlayersContainer component */}
        </>
      )}

      {loading ? (
        <div className={styles.center}>
          <CircularProgress />
        </div>
      ) : error ? (
        <Paper className={styles.paper}>
          <Typography color="error">Error: {error}</Typography>
        </Paper>
      ) : (
        <PlayersContainer
          title="Plantilla"
          count={selectedTeam ? players.length : 0}
        >
          {players.map((p) => (
            <div key={p.id}>
              <ListItem
                divider
                secondaryAction={
                  <IconButton
                    size="small"
                    disabled={loadingDetail !== null}
                    onClick={async () => {
                      if (expandedPlayerId === p.id) {
                        setExpandedPlayerId(null);
                        setExpandedDetails(null);
                        return;
                      }
                      try {
                        setLoadingDetail(p.id);
                        setExpandedPlayerId(p.id);
                        // If we already have the player's full data in `raw`, use it
                        const cached = (p as any).raw;
                        const buildFrom = (d: any) => {
                          const comps: any[] = Array.isArray(d.competitions)
                            ? d.competitions
                            : d.competiciones && Array.isArray(d.competiciones)
                            ? d.competiciones
                            : [];

                          const playerAge = d.age ?? d.ace ?? null;

                          const stats = (
                            comps.length > 0
                              ? comps
                              : [
                                  {
                                    competitionName: d.teamCategory ?? "",
                                    groupName: "",
                                    teamName: d.team ?? d.teamName ?? "",
                                    teamPoints: d.teamPoints ?? 0,
                                  },
                                ]
                          ).map((c: any) => ({
                            seasonId: d.seasonId ? Number(d.seasonId) : 0,
                            seasonName: d.seasonId ? String(d.seasonId) : "",
                            dorsalNumber: d.jerseyNumber ?? d.jersey ?? "",
                            position: d.position ?? "",
                            categoryName: d.teamCategory ?? "",
                            competitionName: c.competitionName ?? "",
                            groupName: c.groupName ?? "",
                            teamName: c.teamName ?? d.team ?? "",
                            teamPoints: c.teamPoints ?? 0,
                            age: playerAge,
                            matchesPlayed:
                              d.matches?.played ?? d.matches?.called ?? 0,
                            goals: d.matches?.totalGoals ?? 0,
                            headLine: d.matches?.starter ?? 0,
                            substitute: d.matches?.substitute ?? 0,
                            yellowCards: d.cards?.yellow ?? 0,
                            redCards: d.cards?.red ?? 0,
                            doubleYellowCards: d.cards?.doubleYellow ?? 0,
                            teamParticipations: comps.map((cp) => ({
                              competitionName: cp.competitionName,
                              groupName: cp.groupName,
                              teamName: cp.teamName,
                              teamPoints: cp.teamPoints ?? 0,
                            })),
                          }));

                          return {
                            statisticsBySeason: stats,
                            playerId: d.playerId ? Number(d.playerId) : 0,
                            playerName: d.name ?? d.nombre ?? "",
                            ace: d.age ?? null,
                          } as PlayerDetailsResponse;
                        };

                        if (
                          cached &&
                          (cached.competitions ||
                            cached.matches ||
                            cached.cards)
                        ) {
                          const details = buildFrom(cached);
                          setExpandedDetails(details);
                        } else {
                          const idToFetch = p.playerId
                            ? String(p.playerId)
                            : extractPlayerIdFromUrl(p.url || "") ||
                              String(p.id);
                          const data = await getPlayer(idToFetch);
                          if (data && (data as any).competitions) {
                            setExpandedDetails(buildFrom(data));
                          } else {
                            setExpandedDetails(data as PlayerDetailsResponse);
                          }
                        }
                      } catch (err) {
                        setExpandedDetails(null);
                      } finally {
                        setLoadingDetail(null);
                      }
                    }}
                  >
                    {loadingDetail === p.id ? (
                      <CircularProgress size={16} />
                    ) : expandedPlayerId === p.id ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </IconButton>
                }
              >
                <div
                  className={playersStyles.jerseyBadge}
                  style={{ marginRight: 12 }}
                >
                  <div className={playersStyles.jerseyShirt}>
                    <svg
                      viewBox="0 0 64 64"
                      width={44}
                      height={44}
                      aria-hidden="true"
                      role="img"
                    >
                      <g fill="none" fillRule="evenodd">
                        <path
                          d="M8 14c0 0 6-4 12-4s6 2 12 2 6-2 12-2 12 4 12 4v28c0 4-4 8-8 8H16c-4 0-8-4-8-8V14z"
                          fill="#2C7BE5"
                          stroke="#08306B"
                          strokeWidth="1.2"
                        />
                        <path
                          d="M8 14c4 0 6-4 12-4"
                          stroke="#08306B"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          fill="none"
                        />
                        <path
                          d="M56 14c-4 0-6-4-12-4"
                          stroke="#08306B"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          fill="none"
                        />
                        <path
                          d="M26 12 L32 18 L38 12"
                          stroke="#04173A"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                        <path
                          d="M14 18c4 0 10-2 18-2"
                          stroke="#ffffff"
                          strokeOpacity="0.08"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                        />
                        <path
                          d="M50 18c-4 0-10-2-18-2"
                          stroke="#ffffff"
                          strokeOpacity="0.06"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                        />
                        <rect
                          x="20"
                          y="22"
                          width="24"
                          height="18"
                          rx="3"
                          fill="#FFF"
                          opacity="0.08"
                        />
                      </g>
                    </svg>
                    <div
                      className="jerseyNumber"
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontWeight: 800,
                        color: "#000",
                      }}
                    >
                      {p.jerseyNumber ?? ""}
                    </div>
                  </div>
                  {p.age ? (
                    <div className={playersStyles.ageChip}>Edad: {p.age}</div>
                  ) : (
                    <div className={playersStyles.ageChip} />
                  )}
                </div>
                <ListItemText
                  primary={
                    <span className={playersStyles.playerName}>{p.name}</span>
                  }
                  secondary={
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {p.email || ""}
                        {(() => {
                          const goals =
                            (p as any).matches?.totalGoals ??
                            (p as any).matches?.goles ??
                            (p as any).matches?.goals ??
                            0;
                          return (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                marginLeft: 6,
                              }}
                            >
                              <SportsSoccerIcon
                                fontSize="small"
                                style={{ color: "#ffffff" }}
                              />
                              <span
                                style={{
                                  color: "#ffffff",
                                  fontWeight: 900,
                                  fontSize: 16,
                                  lineHeight: "1",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                                }}
                              >
                                {goals}
                              </span>
                              {/* Cards: yellow and red */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  marginLeft: 8,
                                }}
                                title={`Tarjetas: amarillas ${
                                  ((p as any).cards?.yellow ??
                                    (p as any).cards?.amarillas) ||
                                  0
                                } — rojas ${
                                  ((p as any).cards?.red ??
                                    (p as any).cards?.rojas) ||
                                  0
                                }`}
                              >
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <YellowCardIcon />
                                  <span
                                    style={{
                                      color: "#ffffff",
                                      fontWeight: 700,
                                      fontSize: 13,
                                    }}
                                  >
                                    {(p as any).cards?.yellow ??
                                      (p as any).cards?.amarillas ??
                                      0}
                                  </span>
                                </span>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <RedCardIcon />
                                  <span
                                    style={{
                                      color: "#ffffff",
                                      fontWeight: 700,
                                      fontSize: 13,
                                    }}
                                  >
                                    {(p as any).cards?.red ??
                                      (p as any).cards?.rojas ??
                                      0}
                                  </span>
                                </span>
                              </span>
                            </span>
                          );
                        })()}
                      </span>
                    </span>
                  }
                />
              </ListItem>

              {expandedPlayerId === p.id && expandedDetails && (
                <div className={styles.detailRoot}>
                  {expandedDetails.statisticsBySeason.map((s) => (
                    <PlayerStatsCard key={s.seasonId} stat={s} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </PlayersContainer>
      )}
      {teamDetails && (
        <Paper className={`${teamStyles.root} ${styles.staffPaper}`}>
          <div className={`${teamStyles.header} ${styles.staffHeader}`}>
            <div>
              <Typography className={teamStyles.subtitle}>
                Staff técnico
              </Typography>
            </div>
          </div>
          <div className={teamStyles.chips}>
            <div className={`${teamStyles.section} ${styles.equalSection}`}>
              <StaffCard
                title="Delegados"
                titleClassName={styles.staffTitle}
                staff={(teamDetails.delegates || []).map((d: any) => ({
                  name: d.name,
                  role: d.role,
                }))}
              />
            </div>
            <div className={`${teamStyles.section} ${styles.equalSection}`}>
              <StaffCard
                title="Técnicos"
                titleClassName={styles.staffTitle}
                staff={(teamDetails.technicians || []).map((t: any) => ({
                  name: t.name,
                  role: t.role,
                }))}
              />
            </div>
            <div className={`${teamStyles.section} ${styles.equalSection}`}>
              <StaffCard
                title="Auxiliares"
                titleClassName={styles.staffTitle}
                staff={(teamDetails.assistants || []).map((a: any) => ({
                  name: a.name,
                  role: a.role,
                }))}
              />
            </div>
          </div>
        </Paper>
      )}
    </BaseLayout>
  );
}
