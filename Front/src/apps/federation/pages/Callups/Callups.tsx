import React, { useEffect, useState, useMemo } from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
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

  const [data, setData] = useState<TeamCallupsResponse>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noConfig, setNoConfig] = useState<boolean>(false);

  // Load selection from API
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
            setTeamId(null);
            setSeasonId(null);
            setCompetitionId(null);
            setGroupId(null);
            setTeamName(null);
            setSeasonName(null);
            setCompetitionName(null);
            setGroupName(null);
          } else {
            setNoConfig(false);
            setTeamId(String(combo.teamId));
            setTeamName(combo.teamName ?? null);
            setSeasonId(combo.seasonId ? String(combo.seasonId) : null);
            setSeasonName(combo.seasonName ?? null);
            setCompetitionId(
              combo.competitionId ? String(combo.competitionId) : null
            );
            setCompetitionName(combo.competitionName ?? null);
            setGroupId(combo.groupId ? String(combo.groupId) : null);
            setGroupName(combo.groupName ?? null);
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
      if (!teamId) return;
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
        {noConfig ? (
          <Paper className={styles.paper}>
            <Typography>
              No hay configuración seleccionada. Guarda o selecciona una
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
