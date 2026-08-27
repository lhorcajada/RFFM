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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import teamplayerService, {
  createPlayerInjury,
  getTeamInjuries,
  updatePlayerInjury,
} from "../../services/teamplayerService";
import type { InjuryRecord, PlayerResponse } from "../../services/teamplayerService";
import InjuryDialog from "../player/components/InjuryDialog";
import styles from "./Injured.module.css";

type InjuryRow = {
  player: PlayerResponse;
  injury: InjuryRecord;
};

export default function Injured() {
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode } = useTeamAndClub();

  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<InjuryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addPlayer, setAddPlayer] = useState<PlayerResponse | null>(null);
  const [addStartDate, setAddStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [addInjuryType, setAddInjuryType] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addEstimatedRecovery, setAddEstimatedRecovery] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<InjuryRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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
        if (mounted) { setPlayers([]); setRows([]); }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
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

  async function handleDischarge(row: InjuryRow) {
    const name =
      ((row.player.name ?? "") + " " + (row.player.lastName ?? "")).trim() ||
      row.player.alias;
    if (!confirm(`¿Dar de alta a ${name}?`)) return;
    await updatePlayerInjury(row.player.id, row.injury.id, {
      startDate: row.injury.startDate,
      injuryType: row.injury.injuryType,
      description: row.injury.description,
      estimatedRecovery: row.injury.estimatedRecovery,
      endDate: new Date().toISOString(),
    });
    setRefreshKey((k) => k + 1);
  }

  const canAdd =
    !!addPlayer && addInjuryType.trim().length > 0 && addStartDate.length > 0;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Lesionados"
        subtitle={teamTitleNode ?? "Histórico de lesiones de la plantilla"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
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
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </Stack>
        }
      >
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
          <TableContainer className={styles.tableCard}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Jugador</TableCell>
                  <TableCell>Lesión</TableCell>
                  <TableCell>Inicio</TableCell>
                  <TableCell>Alta</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ player, injury }) => {
                  const isActive = !injury.endDate;
                  return (
                    <TableRow key={injury.id} hover>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{injury.injuryType}</Typography>
                        {injury.estimatedRecovery && (
                          <Typography variant="caption" color="text.secondary">
                            Rec.: {injury.estimatedRecovery}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(injury.startDate).toLocaleDateString("es-ES")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {injury.endDate
                            ? new Date(injury.endDate).toLocaleDateString("es-ES")
                            : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Chip label="Activa" color="error" size="small" />
                        ) : (
                          <Chip
                            label="Alta"
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <div className={styles.actions}>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => openEdit({ player, injury })}
                            >
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentLayout>

      {/* Add injury dialog */}
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
                <TextField
                  {...params}
                  label="Jugador"
                  size="small"
                  required
                  fullWidth
                />
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

      {/* Edit injury dialog */}
      <InjuryDialog
        open={editOpen}
        current={editRow?.injury ?? null}
        saving={editSaving}
        onSave={handleEditSave}
        onClose={() => setEditOpen(false)}
      />
    </BaseLayout>
  );
}
