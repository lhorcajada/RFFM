import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Button,
} from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "./PlayerQuickViewDialog.module.css";
import type { FederationPlayer } from "../../../types/federationPlayer";
import { getPlayer } from "../../../services/api";

type Props = {
  open: boolean;
  playerCode: string | null;
  playerName?: string | null;
  seasonId?: string;
  onClose: () => void;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : null;
}

function pickString(o: Record<string, unknown> | null, keys: string[]): string {
  if (!o) return "";
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return "";
}

function pickNumber(o: Record<string, unknown> | null, keys: string[]): number {
  if (!o) return 0;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function pickBool(o: Record<string, unknown> | null, keys: string[]): boolean {
  if (!o) return false;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
    if (typeof v === "number") return v === 1;
  }
  return false;
}

function mapPlayer(raw: unknown): FederationPlayer | null {
  const r = asRecord(raw);
  if (!r) return null;

  const matchesRaw = asRecord(r.matches ?? r.Matches);
  const cardsRaw = asRecord(r.cards ?? r.Cards);
  const compsRaw = r.competitions ?? r.Competitions;

  const competitions: FederationPlayer["competitions"] = Array.isArray(compsRaw)
    ? compsRaw
        .map((it) => asRecord(it))
        .filter((it): it is Record<string, unknown> => it != null)
        .map((c) => ({
          competitionName: pickString(c, [
            "competitionName",
            "CompetitionName",
          ]),
          competitionCode: pickString(c, [
            "competitionCode",
            "CompetitionCode",
          ]),
          groupCode: pickString(c, ["groupCode", "GroupCode"]),
          groupName: pickString(c, ["groupName", "GroupName"]),
          teamCode: pickString(c, ["teamCode", "TeamCode"]),
          teamName: pickString(c, ["teamName", "TeamName"]),
          clubName: pickString(c, ["clubName", "ClubName"]),
          teamPosition: pickNumber(c, ["teamPosition", "TeamPosition"]),
          teamPoints: pickNumber(c, ["teamPoints", "TeamPoints"]),
          teamShieldUrl: pickString(c, ["teamShieldUrl", "TeamShieldUrl"]),
          showStatistics: pickBool(c, ["showStatistics", "ShowStatistics"]),
        }))
    : [];

  const playerId = pickString(r, ["playerId", "PlayerId"]);
  if (!playerId) return null;

  return {
    playerId,
    seasonId: pickString(r, ["seasonId", "SeasonId"]),
    name: pickString(r, ["name", "Name", "nombre", "nombre_jugador"]),
    age: pickNumber(r, ["age", "Age", "ace", "edad"]),
    birthYear: pickNumber(r, ["birthYear", "BirthYear", "anio_nacimiento"]),
    team: pickString(r, ["team", "Team", "equipo"]),
    teamCode: pickString(r, ["teamCode", "TeamCode", "codigo_equipo"]),
    teamCategory: pickString(r, [
      "teamCategory",
      "TeamCategory",
      "categoria_equipo",
    ]),
    jerseyNumber: pickString(r, [
      "jerseyNumber",
      "JerseyNumber",
      "dorsal_jugador",
    ]),
    position: pickString(r, ["position", "Position", "posicion_jugador"]),
    isGoalkeeper: pickBool(r, ["isGoalkeeper", "IsGoalkeeper", "es_portero"]),
    photoUrl: pickString(r, ["photoUrl", "PhotoUrl", "foto"]),
    teamShieldUrl: pickString(r, [
      "teamShieldUrl",
      "TeamShieldUrl",
      "escudo_equipo",
    ]),
    matches: {
      called: pickNumber(matchesRaw, ["called", "Called"]),
      starter: pickNumber(matchesRaw, ["starter", "Starter"]),
      substitute: pickNumber(matchesRaw, ["substitute", "Substitute"]),
      played: pickNumber(matchesRaw, ["played", "Played"]),
      totalGoals: pickNumber(matchesRaw, ["totalGoals", "TotalGoals"]),
      goalsPerMatch: pickNumber(matchesRaw, ["goalsPerMatch", "GoalsPerMatch"]),
    },
    cards: {
      yellow: pickNumber(cardsRaw, ["yellow", "Yellow"]),
      red: pickNumber(cardsRaw, ["red", "Red"]),
      doubleYellow: pickNumber(cardsRaw, ["doubleYellow", "DoubleYellow"]),
    },
    competitions,
  };
}

export default function PlayerQuickViewDialog({
  open,
  playerCode,
  playerName,
  seasonId,
  onClose,
}: Props) {
  const code = useMemo(() => (playerCode ?? "").trim(), [playerCode]);
  const effectiveSeasonId = seasonId ?? "21";

  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<FederationPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!open || !code) return;
      setLoading(true);
      setError(null);
      setPlayer(null);

      try {
        const raw = await getPlayer(code, { seasonId: effectiveSeasonId });
        const mapped = mapPlayer(raw);
        if (mounted) setPlayer(mapped);
      } catch (e) {
        if (mounted) setError("No se ha podido cargar la ficha del jugador");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [open, code, effectiveSeasonId]);

  const title =
    player?.name || playerName || (code ? `Jugador ${code}` : "Jugador");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent className={styles.dialogContent}>
        {!code ? (
          <EmptyState description={"No hay código de jugador"} />
        ) : loading ? (
          <div className={styles.center}>
            <CircularProgress />
          </div>
        ) : error ? (
          <EmptyState description={error} />
        ) : !player ? (
          <EmptyState description={"Jugador no encontrado"} />
        ) : (
          <>
            <div className={styles.header}>
              <Avatar
                className={styles.avatar}
                src={player.photoUrl || undefined}
                alt={player.name}
              />
              <div className={styles.headerInfo}>
                <div className={styles.nameRow}>
                  <Typography variant="h6" className={styles.name}>
                    {player.name}
                  </Typography>
                  {player.jerseyNumber ? (
                    <Chip
                      size="small"
                      label={`Dorsal ${player.jerseyNumber}`}
                    />
                  ) : null}
                  {player.position ? (
                    <Chip size="small" label={player.position} />
                  ) : null}
                  {player.isGoalkeeper ? (
                    <Chip size="small" label="Portero" />
                  ) : null}
                </div>
                <div className={styles.subLine}>
                  {player.team ? `${player.team}` : ""}
                  {player.teamCategory ? ` — ${player.teamCategory}` : ""}
                </div>
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.item}>
                <div className={styles.label}>Código</div>
                <div className={styles.value}>{player.playerId}</div>
              </div>
              <div className={styles.item}>
                <div className={styles.label}>Temporada</div>
                <div className={styles.value}>
                  {player.seasonId || effectiveSeasonId}
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.label}>Edad</div>
                <div className={styles.value}>{player.age || "-"}</div>
              </div>
              <div className={styles.item}>
                <div className={styles.label}>Año nacimiento</div>
                <div className={styles.value}>{player.birthYear || "-"}</div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <Chip
                size="small"
                label={`Jugados: ${player.matches.played ?? 0}`}
              />
              <Chip
                size="small"
                label={`Goles: ${player.matches.totalGoals ?? 0}`}
              />
              <Chip
                size="small"
                label={`Amarillas: ${player.cards.yellow ?? 0}`}
              />
              <Chip size="small" label={`Rojas: ${player.cards.red ?? 0}`} />
              <Chip
                size="small"
                label={`Doble amarilla: ${player.cards.doubleYellow ?? 0}`}
              />
            </div>

            {player.competitions.length > 0 ? (
              <div className={styles.comps}>
                <Typography variant="subtitle2">Competiciones</Typography>
                {player.competitions.map((c, idx) => (
                  <div
                    key={`${c.competitionCode}-${c.groupCode}-${idx}`}
                    className={styles.compItem}
                  >
                    <div className={styles.compLeft}>
                      <div className={styles.compName}>{c.competitionName}</div>
                      <div className={styles.compMeta}>
                        {c.groupName ? `${c.groupName} — ` : ""}
                        {c.teamName}
                      </div>
                    </div>
                    <div className={styles.compRight}>Pts: {c.teamPoints}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
