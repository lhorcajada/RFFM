import { useEffect, useState } from "react";
import {
  Autocomplete,
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import { recoveryProgress } from "../injuryRecovery";
import teamplayerService, {
  createPlayerInjury,
  getTeamInjuries,
  updatePlayerInjury,
} from "../../../services/teamplayerService";
import type { InjuryRecord, PlayerResponse } from "../../../services/teamplayerService";
import InjuryDialog from "../../player/components/InjuryDialog";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import styles from "./InjuredPlayersList.module.css";

type InjuryRow = {
  player: PlayerResponse;
  injury: InjuryRecord;
};

type InjuryFilter = "active" | "history";

const FILTERS: { value: InjuryFilter; label: string }[] = [
  { value: "active", label: "Activas" },
  { value: "history", label: "Historial" },
];

const EMPTY_TITLES: Record<InjuryFilter, string> = {
  active: "Sin lesiones activas",
  history: "Sin historial de lesiones",
};

function playerFullName(player: PlayerResponse): string {
  return ((player.name ?? "") + " " + (player.lastName ?? "")).trim() || player.alias;
}

type Props = {
  team: { id: string } | null;
  isCoach: boolean;
  /** Injury id to visually highlight and scroll to, e.g. from a notification deep-link. */
  highlightedId?: string | null;
};

export default function InjuredPlayersList({ team, isCoach, highlightedId }: Props) {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<InjuryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filter, setFilter] = useState<InjuryFilter>("active");

  const [addOpen, setAddOpen] = useState(false);
  const [addPlayer, setAddPlayer] = useState<PlayerResponse | null>(null);
  const [addStartDate, setAddStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [addInjuryType, setAddInjuryType] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addEstimatedRecovery, setAddEstimatedRecovery] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<InjuryRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [dischargeTarget, setDischargeTarget] = useState<InjuryRow | null>(null);
  const [dischargeProcessing, setDischargeProcessing] = useState(false);

  useEffect(() => {
    if (!team) return;
    let mounted = true;
    setLoading(true);

    Promise.all([teamplayerService.getPlayersByTeam(team.id), getTeamInjuries(team.id)])
      .then(([list, teamInjuries]) => {
        if (!mounted) return;
        setPlayers(list);
        const injuriesByPlayer = new Map(
          teamInjuries.map(({ teamPlayerId, injuries }) => [teamPlayerId, injuries])
        );
        const allRows: InjuryRow[] = [];
        for (const player of list) {
          for (const injury of injuriesByPlayer.get(player.id) ?? []) {
            allRows.push({ player, injury });
          }
        }
        allRows.sort(
          (a, b) =>
            new Date(b.injury.startDate).getTime() -
            new Date(a.injury.startDate).getTime()
        );
        setRows(allRows);
      })
      .catch(() => {
        if (mounted) {
          setPlayers([]);
          setRows([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [team, refreshKey]);

  useEffect(() => {
    if (!highlightedId || loading) return;
    const element = document.getElementById(`injury-${highlightedId}`);
    element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [highlightedId, loading, rows]);

  function openAdd() {
    setAddPlayer(null);
    setAddStartDate(new Date().toISOString().slice(0, 10));
    setAddInjuryType("");
    setAddDescription("");
    setAddEstimatedRecovery("");
    setAddOpen(true);
  }

  async function handleAddSave() {
    if (!isCoach) return;
    if (!addPlayer || !addInjuryType.trim() || !addStartDate) return;
    setAddSaving(true);
    const result = await createPlayerInjury(addPlayer.id, {
      startDate: addStartDate,
      injuryType: addInjuryType,
      description: addDescription || null,
      estimatedRecovery: addEstimatedRecovery || null,
    });
    setAddSaving(false);
    if (result) {
      setAddOpen(false);
      setRefreshKey((k) => k + 1);
    }
  }

  function openEdit(row: InjuryRow) {
    setEditRow(row);
    setEditOpen(true);
  }

  async function handleEditSave(data: {
    startDate: string;
    injuryType: string;
    description?: string | null;
    estimatedRecovery?: string | null;
    endDate?: string | null;
  }) {
    if (!isCoach) return;
    if (!editRow) return;
    setEditSaving(true);
    await updatePlayerInjury(editRow.player.id, editRow.injury.id, {
      ...data,
      endDate: data.endDate || null,
    });
    setEditSaving(false);
    setEditOpen(false);
    setRefreshKey((k) => k + 1);
  }

  function handleDischarge(row: InjuryRow) {
    if (!isCoach) return;
    setDischargeTarget(row);
  }

  function dischargeTargetName(row: InjuryRow | null): string {
    if (!row) return "";
    return (
      ((row.player.name ?? "") + " " + (row.player.lastName ?? "")).trim() ||
      row.player.alias
    );
  }

  async function handleDischargeConfirmed() {
    if (!dischargeTarget) return;
    const row = dischargeTarget;
    setDischargeProcessing(true);
    try {
      await updatePlayerInjury(row.player.id, row.injury.id, {
        startDate: row.injury.startDate,
        injuryType: row.injury.injuryType,
        description: row.injury.description,
        estimatedRecovery: row.injury.estimatedRecovery,
        endDate: new Date().toISOString(),
      });
      setDischargeTarget(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setDischargeProcessing(false);
    }
  }

  const activeCount = rows.filter(({ injury }) => !injury.endDate).length;
  const now = new Date();
  const dischargedThisMonth = rows.filter(({ injury }) => {
    if (!injury.endDate) return false;
    const end = new Date(injury.endDate);
    return end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth();
  }).length;
  const visibleRows = rows.filter(({ injury }) =>
    filter === "active" ? !injury.endDate : !!injury.endDate
  );

  const canAdd =
    !!addPlayer && addInjuryType.trim().length > 0 && addStartDate.length > 0;

  return (
    <div className={styles.wrapper}>
      {isCoach && (
        <div className={styles.toolbar}>
          <Button
            startIcon={<AddIcon />}
            onClick={openAdd}
            variant="contained"
            size="small"
            color="warning"
            className={styles.addButton}
            disabled={players.length === 0}
          >
            Añadir lesión
          </Button>
        </div>
      )}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.stat}>
              <span className={styles.statValue} data-testid="injured-count-active">
                {activeCount}
              </span>
              <span className={styles.statLabel}>Activas</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue} data-testid="injured-count-discharged">
                {dischargedThisMonth}
              </span>
              <span className={styles.statLabel}>Altas este mes</span>
            </div>
          </div>

          <div className={styles.filters}>
            {FILTERS.map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                clickable
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                color={filter === value ? "primary" : "default"}
                variant={filter === value ? "filled" : "outlined"}
                className={styles.filterChip}
              />
            ))}
          </div>

          {visibleRows.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? "Sin lesiones registradas" : EMPTY_TITLES[filter]}
              description={
                rows.length === 0
                  ? "No hay ningún registro de lesión para esta plantilla."
                  : undefined
              }
            />
          ) : (
            <div className={styles.cardsGrid}>
              {visibleRows.map(({ player, injury }) => {
                const isActive = !injury.endDate;
                const progress = isActive
                  ? recoveryProgress(injury.startDate, injury.estimatedRecovery, new Date())
                  : null;
                const hasName = ((player.name ?? "") + (player.lastName ?? "")).trim() !== "";
                const subtitle = [player.position, hasName ? player.alias : null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={injury.id}
                    id={`injury-${injury.id}`}
                    className={`${styles.card} ${
                      injury.id === highlightedId ? styles.highlighted : ""
                    }`}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.dorsal}>{player.dorsal ?? "—"}</span>
                      <div className={styles.playerCell}>
                        <span className={styles.playerName}>{playerFullName(player)}</span>
                        {subtitle && <span className={styles.playerMeta}>{subtitle}</span>}
                      </div>
                      <Chip
                        label={isActive ? "Activa" : "Alta"}
                        size="small"
                        className={isActive ? styles.chipActive : styles.chipDischarged}
                      />
                    </div>

                    <div className={styles.cardBody}>
                      <Typography variant="body2" className={styles.injuryType}>
                        {injury.injuryType}
                      </Typography>
                      {injury.estimatedRecovery && (
                        <Typography variant="caption" className={styles.playerMeta}>
                          Rec.: {injury.estimatedRecovery}
                        </Typography>
                      )}
                      {progress !== null && (
                        <div className={styles.progress}>
                          <span className={styles.playerMeta}>Recuperación {progress} %</span>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            aria-label="Recuperación"
                            className={styles.progressBar}
                          />
                        </div>
                      )}
                      <div className={styles.datesRow}>
                        <Typography variant="body2" className={styles.playerMeta}>
                          Inicio: {new Date(injury.startDate).toLocaleDateString("es-ES")}
                        </Typography>
                        {injury.endDate && (
                          <Typography variant="body2" className={styles.playerMeta}>
                            Alta: {new Date(injury.endDate).toLocaleDateString("es-ES")}
                          </Typography>
                        )}
                      </div>
                    </div>

                    {isCoach && (
                      <div className={styles.actions}>
                        <Button
                          variant="outlined"
                          color="inherit"
                          className={styles.actionButton}
                          onClick={() => openEdit({ player, injury })}
                        >
                          Actualizar
                        </Button>
                        {isActive && (
                          <Button
                            variant="contained"
                            color="success"
                            className={styles.actionButton}
                            onClick={() => handleDischarge({ player, injury })}
                          >
                            Dar de alta
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar lesión</DialogTitle>
        <DialogContent>
          <div className={styles.addDialogFields}>
            <Autocomplete
              options={players}
              getOptionLabel={(p) =>
                ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias
              }
              value={addPlayer}
              onChange={(_, val) => setAddPlayer(val)}
              renderInput={(params) => (
                <TextField {...params} label="Jugador" size="small" required fullWidth />
              )}
            />
            <TextField
              label="Fecha de inicio"
              type="date"
              size="small"
              fullWidth
              value={addStartDate}
              onChange={(e) => setAddStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Tipo de lesión"
              size="small"
              fullWidth
              value={addInjuryType}
              onChange={(e) => setAddInjuryType(e.target.value)}
              placeholder="Ej: Rotura fibrilar, esguince de tobillo..."
              required
            />
            <TextField
              label="¿Cómo ocurrió?"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              placeholder="Descripción de cómo sucedió la lesión"
            />
            <TextField
              label="Tiempo estimado de recuperación"
              size="small"
              fullWidth
              value={addEstimatedRecovery}
              onChange={(e) => setAddEstimatedRecovery(e.target.value)}
              placeholder="Ej: 3-4 semanas"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={addSaving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleAddSave}
            disabled={!canAdd || addSaving}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <InjuryDialog
        open={editOpen}
        current={editRow?.injury ?? null}
        saving={editSaving}
        onSave={handleEditSave}
        onClose={() => setEditOpen(false)}
      />

      <ConfirmDialog
        open={!!dischargeTarget}
        title="Dar de alta"
        description={`¿Dar de alta a ${dischargeTargetName(dischargeTarget)}?`}
        confirmText="Dar de alta"
        processing={dischargeProcessing}
        onCancel={() => setDischargeTarget(null)}
        onConfirm={handleDischargeConfirmed}
      />
    </div>
  );
}
