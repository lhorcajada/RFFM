import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import AssessmentIcon from "@mui/icons-material/Assessment";

import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import type { PoolPlayer, RecruitmentStatus } from "../SeasonPrep";
import type { ImportResult } from "./evaluationExcel.ts";
import type { PlayerRating } from "../../../types/playerRating";
import type { SportEventResponse } from "../../../services/sportEventService";
import { useEvaluationPool } from "./hooks/useEvaluationPool";
import { useEvaluationPersistence } from "./hooks/useEvaluationPersistence";
import { useEvaluationExcel } from "./hooks/useEvaluationExcel";
import { usePositionOptions } from "./hooks/usePositionOptions";
import SeasonPrepEventPicker from "../components/SeasonPrepEventPicker";
import { PlayerListPanel } from "./components/PlayerListPanel";
import { EvaluationPanel } from "./components/EvaluationPanel.tsx";
import { AddPlayerDialog } from "./components/AddPlayerDialog";
import { RecruitmentSummaryDialog } from "./components/RecruitmentSummaryDialog";
import { loadSeasonPrepSelection, saveSeasonPrepSelection } from "../seasonPrepSelectionStorage";

import styles from "./EvaluationPage.module.css";

function isDiscardedRecruitmentStatus(status?: string | null) {
  const normalized = status?.trim().toLowerCase() ?? "";
  return normalized.includes("descart") || normalized.includes("descat");
}

function isDiscardedPlayer(player: { recruitmentStatus?: string | null; assignment?: string | null }) {
  return isDiscardedRecruitmentStatus(player.recruitmentStatus) || player.assignment?.trim().toLowerCase() === "discard";
}

export default function EvaluationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as {
    teamId?: string;
    teamName?: string;
    sportEventId?: string;
    sportEventName?: string;
  } | null) ?? null;
  const storedSelection = loadSeasonPrepSelection();
  const teamId = routeState?.teamId ?? storedSelection?.teamId ?? null;
  const teamName = routeState?.teamName ?? storedSelection?.teamName ?? null;

  const [selectedEvent, setSelectedEvent] = useState<SportEventResponse | null>(() =>
    (routeState?.sportEventId ?? storedSelection?.sportEventId)
      ? ({
          id: routeState?.sportEventId ?? storedSelection?.sportEventId ?? "",
          name: routeState?.sportEventName ?? storedSelection?.sportEventName ?? "Evento seleccionado",
        } as SportEventResponse)
      : null
  );

  const activeEventId = selectedEvent?.id ?? routeState?.sportEventId ?? storedSelection?.sportEventId ?? null;

  const { pool, setPool, fedSeason, loading, handleRatingChange, handlePositionChange, handleStatusChange, handleAddPlayer } =
    useEvaluationPool(activeEventId);
  const { saving, saveNow } = useEvaluationPersistence(pool, fedSeason, activeEventId, loading);
  const positionOptions = usePositionOptions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  function notify(message: string, severity: "success" | "error" | "info") {
    setSnackbar({ open: true, message, severity });
  }

  const { fileInputRef, handleExport, handleImportFile, openFilePicker } = useEvaluationExcel(
    pool,
    fedSeason,
    (updatedPlayers: PoolPlayer[], result: ImportResult) => {
      setPool(updatedPlayers);
      if (result.updated === 0) {
        notify("No se encontraron jugadores para actualizar", "error");
      } else {
        const msg = result.unknown.length > 0
          ? `${result.updated} actualizados. Sin coincidencia: ${result.unknown.slice(0, 3).join(", ")}${result.unknown.length > 3 ? "…" : ""}`
          : `${result.updated} jugadores importados`;
        notify(msg, "success");
      }
    },
    () => notify("Error al generar el Excel", "error")
  );

  useEffect(() => {
    setSelectedId(null);
  }, [activeEventId]);

  useEffect(() => {
    if (!teamId) return;
    saveSeasonPrepSelection({
      teamId,
      teamName,
      sportEventId: activeEventId,
      sportEventName: selectedEvent?.name ?? selectedEvent?.title ?? routeState?.sportEventName ?? null,
    });
  }, [activeEventId, routeState?.sportEventName, selectedEvent, teamId, teamName]);

  async function handleSave() {
    try {
      await saveNow();
      notify("Evaluación guardada", "success");
    } catch {
      notify("Error al guardar", "error");
    }
  }

  function handleAddPlayerWithNotify(data: { name: string; procedencia: string; birthYear: number; position: string }) {
    const added = handleAddPlayer(data);
    notify(`${added.name} añadido`, "success");
  }

  const eligiblePlayers = activeEventId ? pool.filter((p) => p.assignment === "eligible" && !isDiscardedPlayer(p)) : [];
  const selectedPlayer = eligiblePlayers.find((p) => p.uniqueId === selectedId) ?? null;

  useEffect(() => {
    if (loading || !activeEventId) return;
    if (eligiblePlayers.length > 0 && !selectedPlayer) {
      setSelectedId(eligiblePlayers[0].uniqueId);
    }
  }, [activeEventId, eligiblePlayers, loading, selectedPlayer]);

  if (loading && activeEventId) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Evaluación"
        actionBar={
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Chip
              size="small"
              color={activeEventId ? "primary" : "warning"}
              label={selectedEvent ? (selectedEvent.name ?? selectedEvent.title ?? "Evento") : "Selecciona evento"}
            />
            <Chip size="small" label={`${eligiblePlayers.length} jugadores`} />
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/season-prep", { state: { teamId: routeState?.teamId, teamName: routeState?.teamName } })}>
              Volver
            </Button>
            <Button size="small" variant="outlined" color="success" disabled={saving || !activeEventId} onClick={handleSave}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button size="small" variant="outlined" startIcon={<AssessmentIcon />} onClick={() => setSummaryOpen(true)} disabled={!activeEventId || eligiblePlayers.length === 0}>
              Resumen
            </Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)} disabled={!activeEventId}>
              Añadir
            </Button>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={!activeEventId || eligiblePlayers.length === 0}>
              Excel
            </Button>
            <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={openFilePicker} disabled={!activeEventId}>
              Importar
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AssessmentIcon />}
              disabled={!activeEventId || eligiblePlayers.length === 0}
              onClick={() => navigate("/coach/season-prep/simulation", {
                state: {
                  players: eligiblePlayers,
                  teamId: routeState?.teamId,
                  teamName: routeState?.teamName,
                  sportEventId: selectedEvent?.id,
                  sportEventName: selectedEvent?.name ?? selectedEvent?.title,
                },
              })}
            >
              Ir a pruebas
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </Box>
        }
      >
        <SeasonPrepEventPicker
          teamId={teamId}
          teamName={teamName}
          value={selectedEvent}
          onChange={setSelectedEvent}
        />

        {!selectedEvent ? (
          <Typography sx={{ opacity: 0.5, mt: 3, textAlign: "center" }}>
            Selecciona o crea un evento para empezar.
          </Typography>
        ) : eligiblePlayers.length === 0 ? (
          <Typography sx={{ opacity: 0.5, mt: 3, textAlign: "center" }}>
            No hay jugadores en la lista de Elegidos para evaluar.
          </Typography>
        ) : (
          <div className={styles.splitLayout}>
            <div className={styles.leftPanel}>
              <PlayerListPanel
                players={eligiblePlayers}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>

            <div className={styles.rightPanel}>
              {selectedPlayer ? (
                <EvaluationPanel
                  key={selectedPlayer.uniqueId}
                  player={selectedPlayer}
                  positionOptions={positionOptions}
                  onRatingChange={(rating: PlayerRating) => handleRatingChange(selectedPlayer.uniqueId, rating)}
                  onPositionChange={(pos: string) => handlePositionChange(selectedPlayer.uniqueId, pos)}
                  onStatusChange={(status: RecruitmentStatus) => handleStatusChange(selectedPlayer.uniqueId, status)}
                />
              ) : (
                <Typography sx={{ opacity: 0.35, textAlign: "center", mt: 8 }}>
                  Selecciona un jugador para evaluar
                </Typography>
              )}
            </div>
          </div>
        )}

        <AddPlayerDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onConfirm={handleAddPlayerWithNotify}
          positionOptions={positionOptions}
          existingNames={eligiblePlayers.map((p) => p.name)}
        />

        <RecruitmentSummaryDialog
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          players={eligiblePlayers}
        />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </ContentLayout>
    </BaseLayout>
  );
}
