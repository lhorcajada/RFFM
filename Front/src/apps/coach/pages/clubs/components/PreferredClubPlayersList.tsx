import React from "react";
import { Alert, Box, Chip, CircularProgress, Paper, TextField, Typography } from "@mui/material";
import { getClubById } from "../../../services/clubService";
import configurationCoachService from "../../../services/configurationCoachService";
import { getPlayersByClub } from "../../../services/playerService";
import type { Player } from "../../../types/player";
import ClubPlayerCard from "./ClubPlayerCard";
import styles from "./PreferredClubPlayersList.module.css";

type PreferredClubPlayersListProps = {
  clubId?: string | null;
  refreshToken?: number;
};

const normalizeText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const playerDisplayName = (player: Player) => {
  const fullName = `${player.name ?? ""} ${player.lastName ?? ""}`.trim();
  return player.alias?.trim() || fullName || "Jugador";
};

export default function PreferredClubPlayersList({
  clubId = null,
  refreshToken = 0,
}: PreferredClubPlayersListProps) {
  const [clubName, setClubName] = React.useState<string | null>(null);
  const [resolvedClubId, setResolvedClubId] = React.useState<string | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let mounted = true;

    async function loadRoster() {
      setLoading(true);
      setError(null);

      try {
        const currentConfig = await configurationCoachService.getCurrent();
        if (!mounted) return;

        const preferredClubId = currentConfig?.preferredClubId?.trim() || null;
        const targetClubId = clubId?.trim() || preferredClubId;
        setResolvedClubId(targetClubId);

        if (!targetClubId) {
          setClubName(null);
          setPlayers([]);
          setError("No hay un club preferido configurado.");
          return;
        }

        const [clubResult, rosterResult] = await Promise.allSettled([
          getClubById(targetClubId),
          getPlayersByClub(targetClubId),
        ]);

        if (!mounted) return;

        if (clubResult.status === "fulfilled") {
          setClubName(clubResult.value?.name ?? null);
        } else {
          setClubName(null);
        }

        if (rosterResult.status === "fulfilled") {
          setPlayers(rosterResult.value);
        } else {
          setPlayers([]);
          setError("No se pudo cargar la lista de jugadores del club.");
        }
      } catch {
        if (!mounted) return;
        setClubName(null);
        setResolvedClubId(null);
        setPlayers([]);
        setError("No se pudo cargar la lista de jugadores del club preferido.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadRoster();

    return () => {
      mounted = false;
    };
  }, [clubId, refreshToken]);

  const filteredPlayers = React.useMemo(() => {
    const query = normalizeText(search);
    const sorted = players.slice().sort((left, right) => {
      const leftName = playerDisplayName(left);
      const rightName = playerDisplayName(right);
      return leftName.localeCompare(rightName, "es");
    });

    if (!query) return sorted;

    return sorted.filter((player) => {
      const candidates = [
        playerDisplayName(player),
        player.name,
        player.lastName,
        player.alias,
        player.dni,
      ];

      return candidates.some((candidate) => normalizeText(candidate).includes(query));
    });
  }, [players, search]);

  return (
    <Box className={styles.root}>
      <Paper elevation={0} className={styles.panel}>
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <Typography variant="overline" className={styles.kicker}>
              Club preferido
            </Typography>
            <Typography variant="h5" className={styles.title}>
              Jugadores del club
            </Typography>
            <Typography variant="body2" className={styles.description}>
              Esta lista muestra sólo los jugadores registrados en la tabla Jugadores del club preferido.
              No asigna ni identifica al jugador dentro de ningún equipo.
            </Typography>
          </div>

          <div className={styles.summaryChips}>
            {clubName ? <Chip label={clubName} variant="outlined" /> : null}
            {resolvedClubId ? <Chip label={`Club: ${resolvedClubId}`} variant="outlined" /> : null}
            <Chip label={`${filteredPlayers.length}/${players.length}`} variant="outlined" />
          </div>
        </div>

        <TextField
          size="small"
          fullWidth
          label="Buscar jugador"
          placeholder="Nombre"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {loading ? (
          <div className={styles.loadingBox}>
            <CircularProgress size={22} />
          </div>
        ) : null}

        {error ? <Alert severity="info">{error}</Alert> : null}

        {!loading && !error && filteredPlayers.length === 0 ? (
          <div className={styles.emptyWrap}>
            <div className={styles.emptyCard}>
              <Typography variant="subtitle1" className={styles.emptyTitle}>
                No hay jugadores para mostrar
              </Typography>
              <Typography variant="body2" className={styles.emptyText}>
                El club preferido todavía no tiene jugadores o la búsqueda no devuelve resultados.
              </Typography>
            </div>
          </div>
        ) : null}

        {filteredPlayers.length > 0 ? (
          <Box className={styles.grid}>
            {filteredPlayers.map((player) => (
              <ClubPlayerCard key={player.id ?? player.alias ?? player.name} player={player} />
            ))}
          </Box>
        ) : null}
      </Paper>
    </Box>
  );
}