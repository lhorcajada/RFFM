import { useEffect, useState } from "react";
import {
  Box,
  Chip,
  Typography,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  type SelectChangeEvent,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditNoteIcon from "@mui/icons-material/EditNote";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import gameModelService from "../../services/gameModelService";
import seasonService, { type Season } from "../../services/seasonService";
import type { GameModel as GameModelType, Zone } from "../../types/gameModel";
import ScenarioAccordion from "./components/ScenarioAccordion";
import GameModelPrintView from "./components/GameModelPrintView";
import styles from "./GameModel.module.css";

function ZoneContent({
  zone, clubId, teamId, gameMomentName,
}: { zone: Zone; clubId: string; teamId: string; gameMomentName: string }) {
  if (zone.scenarios.length === 0) {
    return (
      <Box className={styles.emptyZone}>
        <Typography className={styles.emptyZoneText}>
          No hay escenarios definidos para esta zona.
        </Typography>
      </Box>
    );
  }
  return (
    <Box className={styles.scenarios}>
      <ScenarioAccordion
        scenarios={zone.scenarios}
        clubId={clubId}
        teamId={teamId}
        gameMomentName={gameMomentName}
        zoneName={zone.name}
      />
    </Box>
  );
}

export default function GameModel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { team, teamTitleNode } = useTeamAndClub();
  const goToTeamDashboard = useTeamDashboardBack();

  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [gameModel, setGameModel] = useState<GameModelType | null>(null);
  const [loading, setLoading] = useState(false);
  const [momentTab, setMomentTab] = useState(0);
  const [zoneTab, setZoneTab] = useState(0);
  const [newSeasonDialogOpen, setNewSeasonDialogOpen] = useState(false);
  const [dialogSeasons, setDialogSeasons] = useState<Season[]>([]);
  const [dialogSeasonsLoading, setDialogSeasonsLoading] = useState(false);
  const [selectedDialogSeasonId, setSelectedDialogSeasonId] = useState("");
  const [showAddSeasonInDialog, setShowAddSeasonInDialog] = useState(false);
  const [newSeasonFormName, setNewSeasonFormName] = useState("");
  const [createSeasonLoading, setCreateSeasonLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load available seasons once team is known
  useEffect(() => {
    if (!team?.id) return;
    const teamId = team.id;
    let mounted = true;
    async function loadSeasons() {
      setLoading(true);
      try {
        const seasons = await gameModelService.getSeasonsByTeamId(teamId);
        if (mounted) {
          setAvailableSeasons(seasons);
          if (seasons.length > 0) {
            setSelectedSeason(seasons[0]);
          } else {
            setLoading(false); // no seasons → no model to load
          }
        }
      } catch {
        if (mounted) setLoading(false);
      }
    }
    loadSeasons();
    return () => {
      mounted = false;
    };
  }, [team]);

  // Load model whenever the selected season changes
  useEffect(() => {
    if (!selectedSeason || !team?.id) return;
    const teamId = team.id;
    let mounted = true;
    async function loadModel() {
      setLoading(true);
      setMomentTab(0);
      setZoneTab(0);
      try {
        const model = await gameModelService.getByTeamIdAndSeason(
          teamId,
          selectedSeason
        );
        if (mounted) setGameModel(model);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadModel();
    return () => {
      mounted = false;
    };
  }, [team, selectedSeason]);

  const handleSeasonChange = (e: SelectChangeEvent) => {
    setSelectedSeason(e.target.value);
  };

  const handleMomentChange = (e: SelectChangeEvent<number>) => {
    setMomentTab(Number(e.target.value));
    setZoneTab(0);
  };

  const handleZoneChange = (newValue: number) => {
    setZoneTab(newValue);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (!gameModel?.id) return;
    setDeleting(true);
    try {
      await gameModelService.delete(gameModel.id);
      setDeleteDialogOpen(false);
      setGameModel(null);
      setAvailableSeasons((prev) => prev.filter((s) => s !== selectedSeason));
      setSelectedSeason("");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenNewSeasonDialog = async () => {
    const clubId = team?.club?.id;
    if (!clubId) return;
    setSelectedDialogSeasonId("");
    setShowAddSeasonInDialog(false);
    setNewSeasonFormName("");
    setNewSeasonDialogOpen(true);
    setDialogSeasonsLoading(true);
    try {
      const seasons = await seasonService.getSeasons(clubId);
      setDialogSeasons(seasons);
    } finally {
      setDialogSeasonsLoading(false);
    }
  };

  const handleCloseNewSeasonDialog = () => {
    setNewSeasonDialogOpen(false);
    setShowAddSeasonInDialog(false);
    setNewSeasonFormName("");
  };

  const handleConfirmNewSeason = () => {
    const season = dialogSeasons.find((s) => s.id === selectedDialogSeasonId);
    if (!season) return;
    setNewSeasonDialogOpen(false);
    navigate(`/coach/game-model/create${location.search}`, { state: { season: season.name ?? season.id, teamId: team?.id } });
  };

  const handleCreateSeasonInDialog = async () => {
    const name = newSeasonFormName.trim();
    const clubId = team?.club?.id;
    if (!name || !clubId) return;
    setCreateSeasonLoading(true);
    try {
      await seasonService.createSeason(name, false, undefined, undefined, clubId);
      const seasons = await seasonService.getSeasons(clubId);
      setDialogSeasons(seasons);
      const created = seasons.find((s) => s.name === name);
      if (created) setSelectedDialogSeasonId(created.id);
      setShowAddSeasonInDialog(false);
      setNewSeasonFormName("");
    } finally {
      setCreateSeasonLoading(false);
    }
  };

  const selectedDialogSeason = dialogSeasons.find((s) => s.id === selectedDialogSeasonId);
  const selectedSeasonHasModel = selectedDialogSeason
    ? availableSeasons.includes(selectedDialogSeason.name ?? "")
    : false;

  const currentMoment = gameModel?.gameMoments[momentTab] ?? null;
  const currentZone = currentMoment?.zones[zoneTab] ?? null;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Modelo de Juego"
        subtitle={teamTitleNode}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {!loading && (
              <Button
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleOpenNewSeasonDialog}
                variant="contained"
                size="small"
                color="primary"
              >
                Nuevo Modelo
              </Button>
            )}
            {gameModel && (
              <Button
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                variant="outlined"
                size="small"
                color="error"
              >
                Eliminar Modelo
              </Button>
            )}
            {gameModel && (
              <Button
                startIcon={<EditNoteIcon />}
                onClick={() =>
                  navigate(`/coach/game-model/edit${location.search}`, {
                    state: { season: selectedSeason, teamId: team?.id },
                  })
                }
                variant="outlined"
                size="small"
              >
                Editar Modelo
              </Button>
            )}
            {gameModel && (
              <Button
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                variant="contained"
                size="small"
                color="primary"
              >
                Imprimir PDF
              </Button>
            )}
          </>
        }
      >
        {loading ? (
          <Box className={styles.loadingBox}>
            <CircularProgress color="primary" />
          </Box>
        ) : !gameModel ? (
          <Box className={styles.emptyState}>
            <Typography className={styles.emptyStateText}>
              No hay modelo de juego creado para este equipo. Usa el botón <strong>Nuevo Modelo</strong> para empezar.
            </Typography>
          </Box>
        ) : (
          <Box className={styles.page}>
            <Box className={styles.modelHeader}>
              <Typography className={styles.modelName}>
                {gameModel.name}
              </Typography>
              {availableSeasons.length > 1 && (
                <FormControl size="small" className={styles.seasonSelect}>
                  <Select
                    value={selectedSeason}
                    onChange={handleSeasonChange}
                    variant="outlined"
                    classes={{ select: styles.seasonSelectInput }}
                  >
                    {availableSeasons.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>

            {/* Game moment selector */}
            <FormControl size="small" className={styles.momentSelect} fullWidth>
              <InputLabel id="game-moment-label">Fase</InputLabel>
              <Select
                labelId="game-moment-label"
                label="Fase"
                value={momentTab}
                onChange={handleMomentChange}
                classes={{ select: styles.momentSelectInput }}
              >
                {gameModel.gameMoments.map((moment, index) => {
                  const zoneCount = moment.zones.length;
                  return (
                    <MenuItem key={moment.id} value={index}>
                      {moment.name} ({zoneCount} {zoneCount === 1 ? "zona" : "zonas"})
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {currentMoment && (
              <Box className={styles.momentContent}>
                {/* Zone chips */}
                <Box className={styles.zoneChips} role="group" aria-label="Zonas">
                  {currentMoment.zones.map((zone, index) => {
                    const count = zone.scenarios.length;
                    const selected = index === zoneTab;
                    return (
                      <Chip
                        key={zone.id}
                        label={
                          <Box className={styles.zoneChipLabel}>
                            <span>{zone.name}</span>
                            {count > 0 && (
                              <span className={styles.zoneCount}>{count}</span>
                            )}
                          </Box>
                        }
                        onClick={() => handleZoneChange(index)}
                        variant={selected ? "filled" : "outlined"}
                        color={selected ? "primary" : "default"}
                        className={`${styles.zoneChip} ${selected ? styles.zoneChipSelected : ""}`}
                      />
                    );
                  })}
                </Box>

                {/* Zone content */}
                {currentZone && (
                  <Box className={styles.zoneContent}>
                    <Typography className={styles.zoneName}>
                      {currentZone.name}
                    </Typography>
                    <ZoneContent zone={currentZone} clubId={team?.club?.id ?? ""} teamId={team?.id ?? ""} gameMomentName={currentMoment.name} />
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </ContentLayout>

      {/* ── Vista de impresión (oculta en pantalla, visible al imprimir) ── */}
      {gameModel && (
        <GameModelPrintView
          gameModel={gameModel}
          teamName={team ? team.name : ""}
          season={selectedSeason}
        />
      )}

      {/* ── Dialog nueva temporada ── */}
      <Dialog
        open={newSeasonDialogOpen}
        onClose={handleCloseNewSeasonDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nuevo Modelo de Juego</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="dialog-season-label">Temporada</InputLabel>
            <Select
              labelId="dialog-season-label"
              label="Temporada"
              value={selectedDialogSeasonId}
              onChange={(e) => setSelectedDialogSeasonId(e.target.value)}
              disabled={dialogSeasonsLoading}
            >
              {dialogSeasonsLoading ? (
                <MenuItem disabled value="">
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Cargando temporadas…
                </MenuItem>
              ) : dialogSeasons.length === 0 ? (
                <MenuItem disabled value="">
                  No hay temporadas disponibles
                </MenuItem>
              ) : (
                dialogSeasons.map((s) => {
                  const hasModel = availableSeasons.includes(s.name ?? "");
                  return (
                    <MenuItem key={s.id} value={s.id} disabled={hasModel}>
                      {s.name ?? s.id}
                      {hasModel && " (ya tiene modelo)"}
                    </MenuItem>
                  );
                })
              )}
            </Select>
          </FormControl>

          <Button
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setShowAddSeasonInDialog((v) => !v)}
            sx={{ mt: 1.5 }}
          >
            {showAddSeasonInDialog ? "Cancelar" : "Nueva temporada"}
          </Button>

          {showAddSeasonInDialog && (
            <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "flex-start" }}>
              <TextField
                size="small"
                label="Nombre de temporada"
                placeholder="Ej. 2026/2027"
                value={newSeasonFormName}
                onChange={(e) => setNewSeasonFormName(e.target.value)}
                inputProps={{ maxLength: 200 }}
                fullWidth
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSeasonFormName.trim() && !createSeasonLoading)
                    handleCreateSeasonInDialog();
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleCreateSeasonInDialog}
                disabled={!newSeasonFormName.trim() || createSeasonLoading}
                sx={{ whiteSpace: "nowrap", flexShrink: 0, height: 40 }}
              >
                {createSeasonLoading ? <CircularProgress size={16} /> : "Crear"}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewSeasonDialog} size="small">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmNewSeason}
            variant="contained"
            size="small"
            disabled={!selectedDialogSeasonId || selectedSeasonHasModel}
          >
            Crear modelo
          </Button>
        </DialogActions>
      </Dialog>
      {/* ── Dialog eliminar modelo ── */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { backgroundColor: "#07071a" } }}
      >
        <DialogTitle>Eliminar modelo de juego</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que quieres eliminar el modelo de juego
            {gameModel ? ` «${gameModel.name}»` : ""}? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small" disabled={deleting}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            size="small"
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={16} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseLayout>
  );
}
