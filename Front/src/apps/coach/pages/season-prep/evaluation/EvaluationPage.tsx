import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import type { PoolPlayer } from "../SeasonPrep";
import type { ImportResult } from "./evaluationExcel";
import { useEvaluationPool } from "./hooks/useEvaluationPool";
import { useEvaluationPersistence } from "./hooks/useEvaluationPersistence";
import { useEvaluationExcel } from "./hooks/useEvaluationExcel";
import { usePositionOptions } from "./hooks/usePositionOptions";
import { usePlayerGroups } from "./hooks/usePlayerGroups";
import { PlayerRow } from "./components/PlayerRow";
import { AddPlayerDialog } from "./components/AddPlayerDialog";
import { RecruitmentSummaryDialog } from "./components/RecruitmentSummaryDialog";

import styles from "./EvaluationPage.module.css";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  const navigate = useNavigate();

  // Data hooks — each owns a single concern
  const { pool, setPool, fedSeason, loading, handleEvalChange, handlePositionChange, handleStatusChange, handleAddPlayer } =
    useEvaluationPool();
  const { saving, saveNow } = useEvaluationPersistence(pool, fedSeason, loading);
  const positionOptions = usePositionOptions();

  // UI-only state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false, message: "", severity: "info",
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

  const eligiblePlayers = pool.filter((p) => p.assignment === "eligible");
  const groups = usePlayerGroups(eligiblePlayers);

  if (loading) {
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
        title="Evaluación de jugadores"
        actionBar={
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              size="small"
              label={`${eligiblePlayers.length} jugadores`}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/season-prep")}
            >
              Volver
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="success"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AssessmentIcon />}
              onClick={() => setSummaryOpen(true)}
              disabled={eligiblePlayers.length === 0}
            >
              Resumen
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Añadir jugador
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={eligiblePlayers.length === 0}
            >
              Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={openFilePicker}
            >
              Importar
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
        <div className={styles.container}>
          {eligiblePlayers.length === 0 ? (
            <Typography sx={{ opacity: 0.5, mt: 3, textAlign: "center" }}>
              No hay jugadores en la lista de Elegidos para evaluar.
            </Typography>
          ) : (
            groups.map(({ team, positions }) => (
              <div key={team} className={styles.teamGroup}>
                <div className={styles.teamGroupHeader}>{team}</div>
                {positions.map(({ label, players }) => (
                  <div key={label}>
                    <div className={styles.posLabel}>{label}</div>
                    {players.map((player) => (
                      <PlayerRow
                        key={player.uniqueId}
                        player={player}
                        expanded={expandedId === player.uniqueId}
                        onToggle={() =>
                          setExpandedId((prev) =>
                            prev === player.uniqueId ? null : player.uniqueId
                          )
                        }
                        onEvalChange={(key, val) =>
                          handleEvalChange(player.uniqueId, key, val)
                        }
                        onPositionChange={(pos) =>
                          handlePositionChange(player.uniqueId, pos)
                        }
                        onStatusChange={(status) =>
                          handleStatusChange(player.uniqueId, status)
                        }
                        positionOptions={positionOptions}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}


        </div>

        <AddPlayerDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onConfirm={handleAddPlayerWithNotify}
          positionOptions={positionOptions}
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
