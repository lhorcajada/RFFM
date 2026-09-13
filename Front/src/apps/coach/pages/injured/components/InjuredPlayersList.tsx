import { useEffect, useState } from "react";
import {
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
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

type Props = {
  team: { id: string } | null;
  isCoach: boolean;
};

export default function InjuredPlayersList({ team, isCoach }: Props) {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<InjuryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin lesiones registradas"
          description="No hay ningún registro de lesión para esta plantilla."
        />
      ) : (
        <div className={styles.cardsGrid}>
          {rows.map(({ player, injury }) => {
            const isActive = !injury.endDate;
            return (
              <div key={injury.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.playerCell}>
                    <span className={styles.playerName}>
                      {((player.name ?? "") + " " + (player.lastName ?? "")).trim() ||
                        player.alias}
                    </span>
                    {player.alias && (
                      <span className={styles.playerMeta}>
                        {player.alias}
                        {player.dorsal != null ? ` · #${player.dorsal}` : ""}
                      </span>
                    )}
                  </div>
                  {isActive ? (
                    <Chip label="Activa" color="error" size="small" />
                  ) : (
                    <Chip label="Alta" color="success" size="small" variant="outlined" />
                  )}
                </div>

                <div className={styles.cardBody}>
                  <Typography variant="body2">{injury.injuryType}</Typography>
                  {injury.estimatedRecovery && (
                    <Typography variant="caption" color="text.secondary">
                      Rec.: {injury.estimatedRecovery}
                    </Typography>
                  )}
                  <div className={styles.datesRow}>
                    <Typography variant="body2" color="text.secondary">
                      Inicio: {new Date(injury.startDate).toLocaleDateString("es-ES")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Alta:{" "}
                      {injury.endDate
                        ? new Date(injury.endDate).toLocaleDateString("es-ES")
                        : "—"}
                    </Typography>
                  </div>
                </div>

                {isCoach && (
                  <div className={styles.actions}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit({ player, injury })}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isActive && (
                      <Tooltip title="Dar de alta">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleDischarge({ player, injury })}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
