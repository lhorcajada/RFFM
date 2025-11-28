import React, { useEffect, useState, useMemo } from "react";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import styles from "./Callups.module.css";
import playersContainerStyles from "../../components/players/PlayersContainer/PlayersContainer.module.css";
import { getTeamCallups } from "../../services/api";
import type {
  TeamCallupsResponse,
  PlayerCallupsResponse,
  CallupEntry,
} from "../../types/callups";
import PlayerCallupCard from "../../components/players/PlayerCallupCard/PlayerCallupCard";
import { CircularProgress, Paper, Typography } from "@mui/material";

export default function CallupsPage(): JSX.Element {
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

  // Load selection from localStorage
  useEffect(() => {
    function readSelection() {
      try {
        const rawList = localStorage.getItem("rffm.saved_combinations_v1");
        const list = rawList ? JSON.parse(rawList) : [];
        let combo: any = null;
        if (Array.isArray(list) && list.length > 0) {
          const primaryId = localStorage.getItem("rffm.primary_combination_id");
          if (primaryId)
            combo = list.find((c: any) => String(c.id) === String(primaryId));
          if (!combo) combo = list.find((c: any) => c.isPrimary) || list[0];
        }
        if (!combo || !combo.team) {
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
          setTeamId(String(combo.team.id));
          setTeamName(combo.team.name ?? combo.teamName ?? null);
          setSeasonId(
            combo.season?.id
              ? String(combo.season.id)
              : combo.seasonId
              ? String(combo.seasonId)
              : null
          );
          setSeasonName(
            combo.season?.name ?? combo.seasonName ?? combo.season ?? null
          );
          setCompetitionId(
            combo.competition?.id
              ? String(combo.competition.id)
              : combo.competitionId
              ? String(combo.competitionId)
              : null
          );
          setCompetitionName(
            combo.competition?.name ??
              combo.competitionName ??
              combo.competition ??
              null
          );
          setGroupId(
            combo.group?.id
              ? String(combo.group.id)
              : combo.groupId
              ? String(combo.groupId)
              : null
          );
          setGroupName(
            combo.group?.name ?? combo.groupName ?? combo.group ?? null
          );
        }
      } catch (e) {
        setNoConfig(true);
      }
    }

    readSelection();

    function handle() {
      readSelection();
    }

    window.addEventListener("rffm.saved_combinations_changed", handle);
    window.addEventListener("storage", handle);
    return () => {
      window.removeEventListener("rffm.saved_combinations_changed", handle);
      window.removeEventListener("storage", handle);
    };
  }, []);

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
      <PageHeader
        title="Convocatorias"
        subtitle="Jugadores convocados / desconvocados"
      />

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
    </BaseLayout>
  );
}
