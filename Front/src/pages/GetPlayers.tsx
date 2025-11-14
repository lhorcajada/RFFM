import React, { useEffect, useState } from "react";
import "../styles/gameTheme.css";
import styles from "./GetPlayers.module.css";
import {
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Paper,
  Typography,
  Button,
} from "@mui/material";
import TeamsSelector from "../components/ui/TeamsSelector";
import CompetitionSelector from "../components/ui/CompetitionSelector";
import GroupSelector from "../components/ui/GroupSelector";
import { getPlayersByTeam, getPlayer } from "../services/api";
import type { PlayersByTeamResponse } from "../types/player";
import PlayerStatsCard from "../components/players/PlayerStatsCard";
import AgeSummaryBox from "../components/players/AgeSummaryBox";
import GroupSummaryBox from "../components/players/GroupSummaryBox";
import type { PlayerDetailsResponse } from "../types/player";

function extractPlayerIdFromUrl(u?: string): string | null {
  if (!u) return null;
  try {
    const m = u.match(/(players|fichajugador|jugador)\/(\d+)/i);
    if (m && m[2]) return m[2];
    const m2 = u.match(/(\d{5,})/);
    return m2 ? m2[0] : null;
  } catch (e) {
    return null;
  }
}

type Team = { id: string | number; name: string; url?: string };

type Player = {
  id: number;
  name: string;
  url?: string; // original url from API
  email?: string;
  playerId?: string | number; // real player id from API
  age?: number | null;
  teamParticipations?: Array<{
    competitionName: string;
    groupName: string;
    teamName: string;
    teamPoints: number;
    seasonId?: number;
    seasonName?: string;
  }>;
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

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setError(null);
        // If no team selected, clear players and summaries
        if (!selectedTeam) {
          if (mounted) {
            setPlayers([]);
            setAgeCounts({});
            setGroupCounts([]);
          }
          return;
        }

        if (mounted) setLoading(true);

        // Prefer using the external .NET API via the frontend service
        const teamId = String(selectedTeam.id);
        const payload = await getPlayersByTeam(teamId);
        console.log("raw payload:", payload);
        let list: any[] = [];
        if (Array.isArray(payload)) list = payload;
        else if (payload && Array.isArray((payload as any).players))
          list = (payload as any).players;
        const mapped: Player[] = list.map((p: any, idx: number) => {
          const raw = p.ace ?? p.age ?? null;
          let age: number | null = null;
          if (raw !== null && raw !== undefined && raw !== "") {
            // try direct number
            const n = Number(raw);
            if (!Number.isNaN(n)) {
              age = n;
            } else {
              // try to extract digits from strings like "11 años" or URLs
              const m = String(raw).match(/(\d{1,2})/);
              if (m && m[1]) age = Number(m[1]);
            }
          }
          return {
            id: idx + 1,
            name: p.name,
            url: p.url || p.link || "",
            email: p.url || "",
            playerId: p.playerId ?? p.id ?? null,
            age,
            teamParticipations:
              p.teamParticipations || p.teamParticipations || [],
          };
        });
        console.log("mapped players:", mapped);
        if (mounted) {
          setPlayers(mapped);
          setDisplayCount(mapped.length);
          // compute counts now that players are loaded
          const counts = mapped.reduce<Record<number, number>>((acc, p) => {
            const a = p.age ?? null;
            if (a === null) return acc;
            acc[a] = (acc[a] || 0) + 1;
            return acc;
          }, {});
          setAgeCounts(counts);
          // compute group counts from teamParticipations
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
    <Paper className={styles.paper}>
      <CompetitionSelector
        onChange={(c) => {
          setSelectedCompetition(c?.id);
          setSelectedGroup(undefined);
          setSelectedTeam(undefined);
        }}
      />
      <GroupSelector
        competitionId={selectedCompetition}
        onChange={(g) => {
          setSelectedGroup(g?.id);
          setSelectedTeam(undefined);
        }}
      />
      <TeamsSelector
        competitionId={selectedCompetition}
        groupId={selectedGroup}
        onChange={(t) => {
          // hide current data immediately while new team loads
          setSelectedTeam(t);
          setPlayers([]);
          setDisplayCount(0);
          setAgeCounts({});
          setGroupCounts([]);
          setExpandedPlayerId(null);
          setExpandedDetails(null);
          setError(null);
        }}
      />

      {selectedTeam &&
        (players.length > 0 || Object.keys(ageCounts).length > 0) && (
          <AgeSummaryBox
            playersCountByAge={ageCounts}
            title="Distribución por edades"
          />
        )}

      {selectedTeam && groupCounts && groupCounts.length > 0 && (
        <GroupSummaryBox
          groups={groupCounts}
          title="Agrupación por competición"
          totalPlayers={players.length}
        />
      )}

      {selectedTeam && !loading && (
        <Typography variant="h5" gutterBottom>
          Número de jugadores: {selectedTeam ? `${players.length}` : "0"}
        </Typography>
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
        <List>
          {players.map((p) => (
            <div key={p.id}>
              <ListItem
                divider
                secondaryAction={
                  <Button
                    size="small"
                    disabled={loadingDetail !== null}
                    onClick={async () => {
                      // toggle expansion
                      if (expandedPlayerId === p.id) {
                        setExpandedPlayerId(null);
                        setExpandedDetails(null);
                        return;
                      }
                      try {
                        setLoadingDetail(p.id);
                        setExpandedPlayerId(p.id);
                        const idToFetch = p.playerId
                          ? String(p.playerId)
                          : extractPlayerIdFromUrl(p.url || "") || String(p.id);
                        const data = await getPlayer(idToFetch);
                        setExpandedDetails(data as PlayerDetailsResponse);
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
                      "Ocultar"
                    ) : (
                      "Ver"
                    )}
                  </Button>
                }
              >
                <ListItemText
                  primary={p.name}
                  secondary={`${p.email || ""}${
                    p.age ? ` — Edad: ${p.age}` : ""
                  }`}
                />
              </ListItem>

              {expandedPlayerId === p.id && expandedDetails && (
                <div className={styles.detailRoot}>
                  <Typography variant="caption">
                    Identificador: {expandedDetails.playerId} —{" "}
                    {expandedDetails.playerName} — Edad: {expandedDetails.ace}
                  </Typography>

                  {expandedDetails.statisticsBySeason.map((s) => (
                    <PlayerStatsCard key={s.seasonId} stat={s} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </List>
      )}
    </Paper>
  );
}
