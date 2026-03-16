import React, { useEffect, useState, useMemo } from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "./Callups.module.css";
import playersContainerStyles from "../../components/players/PlayersContainer/PlayersContainer.module.css";
import { getTeamCallups } from "../../services/api";
import { getSettingsForUser } from "../../services/federationApi";
import { useUser } from "../../../../shared/context/UserContext";
import type {
  TeamCallupsResponse,
  PlayerCallupsResponse,
  CallupEntry,
} from "../../types/callups";
import PlayerCallupCard from "../../components/players/PlayerCallupCard/PlayerCallupCard";
import { CircularProgress, Paper, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../../../shared/components/ui/GroupSelector/GroupSelector";
import TeamsSelector from "../../../../shared/components/ui/TeamsSelector/TeamsSelector";

export default function CallupsPage(): JSX.Element {
  const { user } = useUser();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [competitionName, setCompetitionName] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

  const [selectedCompetition, setSelectedCompetition] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);

  const [data, setData] = useState<TeamCallupsResponse>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noConfig, setNoConfig] = useState<boolean>(false);

  function handleCompetitionChange(c?: { id: string; name: string; categoryGroup: string }) {
    if (c?.id !== selectedCompetition) {
      setSelectedGroup(undefined);
      setSelectedTeam(undefined);
    }
    setSelectedCompetition(c?.id);
    setNoConfig(false);
  }

  function handleGroupChange(g?: { id: string; name: string }) {
    if (g?.id !== selectedGroup) {
      setSelectedTeam(undefined);
    }
    setSelectedGroup(g?.id);
  }

  function handleTeamChange(t?: { id: string; name: string; url?: string; raw?: any }) {
    if (!t) {
      setSelectedTeam(undefined);
      setTeamId(null);
      setTeamName(null);
      return;
    }
    setSelectedTeam(t.id);
    setTeamId(t.id);
    setTeamName(t.name);
  }

  // Load initial settings into selectors
  useEffect(() => {
    async function loadSettings() {
      if (user?.id) {
        try {
          const settings = await getSettingsForUser(user.id);
          if (Array.isArray(settings) && settings.length > 0) {
            const primary = settings.find((s: any) => s.isPrimary) || settings[0];
            setSelectedCompetition(primary.competitionId || primary.competition?.id);
            setSelectedGroup(primary.groupId || primary.group?.id);
            setSelectedTeam(primary.teamId || primary.team?.id);
            setTeamId(primary.teamId ? String(primary.teamId) : null);
            setTeamName(primary.teamName ?? null);
            setSeasonId(primary.seasonId ? String(primary.seasonId) : null);
            setSeasonName(primary.seasonName ?? null);
            setCompetitionId(primary.competitionId ? String(primary.competitionId) : null);
            setCompetitionName(primary.competitionName ?? null);
            setGroupId(primary.groupId ? String(primary.groupId) : null);
            setGroupName(primary.groupName ?? null);
          }
        } catch (e) {
          // ignore
        }
      }
    }
    loadSettings();
  }, [user]);

  // Load selection from API (legacy - for backward compatibility)
  useEffect(() => {
    function readSelection() {
      (async () => {
        try {
          const savedSettings = await getSettingsForUser(user?.id);
          let combo: any = null;
          if (Array.isArray(savedSettings) && savedSettings.length > 0) {
            const primary = savedSettings.find((c: any) => c.isPrimary);
            combo = primary || savedSettings[0];
          }
          if (!combo || !combo.teamId) {
            setNoConfig(true);
          } else {
            setNoConfig(false);
          }
        } catch (e) {
          setNoConfig(true);
        }
      })();
    }

    readSelection();

    function handle() {
      readSelection();
    }

    window.addEventListener("rffm.saved_combinations_changed", handle);
    return () => {
      window.removeEventListener("rffm.saved_combinations_changed", handle);
    };
  }, [user]);

  // Fetch callups when selection is available
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!teamId) {
        if (mounted) setData([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await getTeamCallups(teamId, {
          seasonId: seasonId ?? undefined,
          competitionId: competitionId ?? undefined,
          groupId: groupId ?? undefined,
        });
        if (mounted) setData(res || []);
      } catch (e: any) {
        if (mounted) setError(String(e?.message ?? e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [teamId, seasonId, competitionId, groupId]);

  const sortedPlayers = useMemo(() => {
    const arr = (data || []).slice();
    arr.sort((a, b) => {
      const aStar = (a.callups || []).filter((c) => c.starter).length;
      const bStar = (b.callups || []).filter((c) => c.starter).length;
      if (bStar !== aStar) return bStar - aStar;
      const aTotal = (a.callups || []).length;
      const bTotal = (b.callups || []).length;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return (a.playerName || "").localeCompare(b.playerName || "");
    });
    return arr;
  }, [data]);

  return (
    <BaseLayout>
      <ContentLayout
        title="Convocatorias"
        subtitle="Jugadores convocados / desconvocados"
      >
        <div className={styles.filters}>
          <Grid container spacing={1} className={styles.filtersGrid}>
            <Grid item xs={12} sm={4}>
              <CompetitionSelector
                onChange={handleCompetitionChange}
                value={selectedCompetition}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <GroupSelector
                competitionId={selectedCompetition}
                onChange={handleGroupChange}
                value={selectedGroup}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TeamsSelector
                competitionId={selectedCompetition}
                groupId={selectedGroup}
                onChange={handleTeamChange}
                value={selectedTeam}
              />
            </Grid>
          </Grid>
        </div>

        {noConfig && !selectedTeam ? (
          <Paper className={styles.paper}>
            <Typography>
              <EmptyState
                description={
                  "No hay configuración seleccionada. Guarda o selecciona una"
                }
              />
              combinación para ver las convocatorias.
            </Typography>
          </Paper>
        ) : loading ? (
          <div className={styles.center}>
            <CircularProgress />
          </div>
        ) : error ? (
          <Paper className={styles.paper}>
            <Typography color="error">{error}</Typography>
          </Paper>
        ) : (
          <div>
            <div className={playersContainerStyles.header}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className={playersContainerStyles.count}>
                  Jugadores: {data.length}
                </div>
              </div>
            </div>

            <div className={styles.list}>
              {sortedPlayers.map((p) => (
                <div key={p.playerId} className={styles.playerWrap}>
                  <PlayerCallupCard player={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
