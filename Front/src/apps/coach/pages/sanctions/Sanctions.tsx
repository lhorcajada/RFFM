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
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import teamplayerService from "../../services/teamplayerService";
import teamplayerSanctionService, {
  getPlayerSanctions,
  createPlayerSanction,
  updatePlayerSanction,
} from "../../services/teamplayerSanctionService";
import type { PlayerResponse } from "../../services/teamplayerService";
import type { SanctionRecord } from "../../services/teamplayerSanctionService";
import styles from "./Sanctions.module.css";

type SanctionRow = { player: PlayerResponse; sanction: SanctionRecord };

export default function Sanctions() {
  const navigate = useNavigate();
  const { team, teamTitleNode } = useTeamAndClub();

  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<SanctionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addPlayer, setAddPlayer] = useState<PlayerResponse | null>(null);
  const [addStartDate, setAddStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [addSanctionType, setAddSanctionType] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addEstimatedEnd, setAddEstimatedEnd] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<SanctionRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!team) return;
    let mounted = true;
    setLoading(true);

    teamplayerService
      .getPlayersByTeam(team.id)
      .then(async (list) => {
        if (!mounted) return;
        setPlayers(list);
        const allRows: SanctionRow[] = [];
        await Promise.all(
          list.map(async (player) => {
            const sanctions = await getPlayerSanctions(player.id);
            for (const s of sanctions) allRows.push({ player, sanction: s });
          })
        );
        if (!mounted) return;
        allRows.sort((a, b) => new Date(b.sanction.startDate).getTime() - new Date(a.sanction.startDate).getTime());
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
    setAddSanctionType("");
    setAddDescription("");
    setAddEstimatedEnd("");
    setAddOpen(true);
  }

  async function handleAddSave() {
    if (!addPlayer || !addSanctionType.trim() || !addStartDate) return;
    setAddSaving(true);
    const result = await createPlayerSanction(addPlayer.id, {
      startDate: addStartDate,
      sanctionType: addSanctionType,
      description: addDescription || null,
      estimatedEnd: addEstimatedEnd || null,
    });
    setAddSaving(false);
    if (result) {
      setAddOpen(false);
      setRefreshKey((k) => k + 1);
    }
  }

  function openEdit(row: SanctionRow) {
    setEditRow(row);
    setEditOpen(true);
  }

  async function handleEditSave(data: { startDate: string; sanctionType: string; description?: string | null; estimatedEnd?: string | null; endDate?: string | null }) {
    if (!editRow) return;
    setEditSaving(true);
    await updatePlayerSanction(editRow.player.id, editRow.sanction.id, { ...data, endDate: data.endDate || null });
    setEditSaving(false);
    setEditOpen(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleLift(row: SanctionRow) {
    const name = ((row.player.name ?? "") + " " + (row.player.lastName ?? "")).trim() || row.player.alias;
    if (!confirm(`¿Levantar sanción a ${name}?`)) return;
    await updatePlayerSanction(row.player.id, row.sanction.id, {
      startDate: row.sanction.startDate,
      sanctionType: row.sanction.sanctionType,
      description: row.sanction.description,
      estimatedEnd: row.sanction.estimatedEnd,
      endDate: new Date().toISOString(),
    });
    setRefreshKey((k) => k + 1);
  }

  const canAdd = !!addPlayer && addSanctionType.trim().length > 0 && addStartDate.length > 0;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Sanciones"
        subtitle={teamTitleNode ?? "Registro de sanciones a jugadores"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button startIcon={<AddIcon />} onClick={openAdd} variant="contained" size="small" color="warning" disabled={players.length === 0}>
              Añadir sanción
            </Button>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/dashboard")} variant="outlined" size="small">
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
          <EmptyState title="Sin sanciones" description="No hay sanciones registradas actualmente." />
        ) : (
          <TableContainer className={styles.tableCard}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Jugador</TableCell>
                  <TableCell>Sanción</TableCell>
                  <TableCell>Inicio</TableCell>
                  <TableCell>Fin</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ player, sanction }) => {
                  const isActive = !sanction.endDate;
                  return (
                    <TableRow key={sanction.id} hover>
                      <TableCell>
                        <div className={styles.playerCell}>
                          <span className={styles.playerName}>{((player.name ?? "") + " " + (player.lastName ?? "")).trim() || player.alias}</span>
                          {player.alias && <span className={styles.playerMeta}>{player.alias}{player.dorsal != null ? ` · #${player.dorsal}` : ""}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{sanction.sanctionType}</Typography>
                        {sanction.estimatedEnd && <Typography variant="caption" color="text.secondary">Fin estimado: {sanction.estimatedEnd}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{new Date(sanction.startDate).toLocaleDateString("es-ES")}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{sanction.endDate ? new Date(sanction.endDate).toLocaleDateString("es-ES") : "—"}</Typography>
                      </TableCell>
                      <TableCell>{isActive ? <Chip label="Activa" color="error" size="small" /> : <Chip label="Cumplida" color="success" size="small" variant="outlined" />}</TableCell>
                      <TableCell align="right">
                        <div className={styles.actions}>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit({ player, sanction })}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isActive && (
                            <Tooltip title="Levantar sanción">
                              <IconButton size="small" color="success" onClick={() => handleLift({ player, sanction })}>
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

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar sanción</DialogTitle>
        <DialogContent>
          <div className={styles.addDialogFields}>
            <Autocomplete options={players} getOptionLabel={(p) => ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias} value={addPlayer} onChange={(_, val) => setAddPlayer(val)} renderInput={(params) => <TextField {...params} label="Jugador" size="small" required fullWidth />} />
            <TextField label="Fecha inicio" type="date" size="small" fullWidth value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
            <TextField label="Tipo de sanción" size="small" fullWidth value={addSanctionType} onChange={(e) => setAddSanctionType(e.target.value)} placeholder="Ej: Expulsión, sanción federativa..." required />
            <TextField label="Descripción" size="small" fullWidth multiline minRows={2} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} placeholder="Motivo de la sanción" />
            <TextField label="Fin estimado" size="small" fullWidth value={addEstimatedEnd} onChange={(e) => setAddEstimatedEnd(e.target.value)} placeholder="Ej: 1 partido, 2 semanas" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={addSaving}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddSave} disabled={!canAdd || addSaving}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog (reuses same structure) */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar sanción</DialogTitle>
        <DialogContent>
          <div className={styles.addDialogFields}>
            <TextField label="Fecha inicio" type="date" size="small" fullWidth value={editRow?.sanction.startDate?.slice(0,10) ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, startDate: e.target.value } } : r)} InputLabelProps={{ shrink: true }} />
            <TextField label="Tipo de sanción" size="small" fullWidth value={editRow?.sanction.sanctionType ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, sanctionType: e.target.value } } : r)} />
            <TextField label="Descripción" size="small" fullWidth multiline minRows={2} value={editRow?.sanction.description ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, description: e.target.value } } : r)} />
            <TextField label="Fin estimado" size="small" fullWidth value={editRow?.sanction.estimatedEnd ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, estimatedEnd: e.target.value } } : r)} />
            <TextField label="Fecha fin" type="date" size="small" fullWidth value={editRow?.sanction.endDate ? editRow.sanction.endDate.slice(0,10) : ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, endDate: e.target.value || null } } : r)} InputLabelProps={{ shrink: true }} helperText="Rellena para marcar la sanción como finalizada" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>Cancelar</Button>
          <Button variant="contained" onClick={() => handleEditSave({ startDate: editRow?.sanction.startDate ?? "", sanctionType: editRow?.sanction.sanctionType ?? "", description: editRow?.sanction.description ?? null, estimatedEnd: editRow?.sanction.estimatedEnd ?? null, endDate: editRow?.sanction.endDate ?? null })} disabled={editSaving}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </BaseLayout>
  );
}
