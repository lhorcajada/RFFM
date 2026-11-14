import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";

import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import PositionCandidateList from "./components/PositionCandidateList";
import PositionWeightsEditor from "./components/PositionWeightsEditor";
import RatingViewSwitcher from "./components/RatingViewSwitcher";
import { FIT_POSITION_LABELS, FIT_POSITIONS, type FitPosition } from "./ratingTraits";
import { squadSearchFrom, useRatingView } from "./ratingViews";
import { usePositionFit } from "./usePositionFit";

import styles from "./PositionFitPage.module.css";

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

/** «2026-11-09T00:00:00» → «9/11/2026», sin convertir de zona horaria. */
function formatWeek(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day}/${month}/${year}`;
}

export default function PositionFitPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useRatingView();
  const { roles } = usePermissions();
  const canRate = roles.includes("Coach") || roles.includes("Administrator");

  const fit = usePositionFit(searchParams.get("teamId"));
  const { loading, loadError, saving, positions, orderOf, isDirty, hasUnsavedChanges } = fit;

  const [selectedPosition, setSelectedPosition] = useState<FitPosition | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const firstWithCandidates = positions.find((p) => p.candidates.length > 0)?.position;
  const selected: FitPosition = selectedPosition ?? firstWithCandidates ?? FIT_POSITIONS[0];
  const current = positions.find((p) => p.position === selected);
  const label = FIT_POSITION_LABELS[selected];

  const candidatesInOrder = current
    ? orderOf(selected)
        .map((id) => current.candidates.find((c) => c.teamPlayerId === id))
        .filter((c): c is NonNullable<typeof c> => c != null)
    : [];

  function goBack() {
    navigate(`/coach/squad${squadSearchFrom(searchParams)}`);
  }

  async function handleSaveOrder() {
    try {
      await fit.save(selected);
      showSnackbar("Orden guardado", "success");
    } catch {
      showSnackbar("Error al guardar el orden", "error");
    }
  }

  async function handleSaveWeights(weights: Parameters<typeof fit.saveWeights>[1]) {
    try {
      await fit.saveWeights(selected, weights);
      showSnackbar("Pesos guardados", "success");
    } catch {
      showSnackbar("Error al guardar los pesos", "error");
    }
  }

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
        title="Valorar plantilla"
        actionBar={
          <div className={styles.actionBar}>
            <RatingViewSwitcher value={view} hasUnsavedChanges={hasUnsavedChanges} onChange={setView} />
            <div className={styles.actions}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => (hasUnsavedChanges ? setLeaveConfirmOpen(true) : goBack())}
              >
                Volver
              </Button>
              {canRate && (
                <>
                  {isDirty(selected) && (
                    <Button size="small" variant="outlined" onClick={() => fit.reset(selected)}>
                      Restablecer
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={!isDirty(selected) || saving}
                    onClick={handleSaveOrder}
                  >
                    Guardar orden
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        {loadError ? (
          <Alert severity="error">No se pudo cargar el encaje de los puestos.</Alert>
        ) : (
          <div className={styles.content}>
            <ToggleButtonGroup
              value={selected}
              exclusive
              size="small"
              aria-label="Puesto"
              className={styles.positions}
              onChange={(_, value: FitPosition | null) => { if (value) setSelectedPosition(value); }}
            >
              {FIT_POSITIONS.map((position) => (
                <ToggleButton key={position} value={position} className={styles.positionBtn}>
                  {FIT_POSITION_LABELS[position]}
                  <span className={styles.count}>
                    {positions.find((p) => p.position === position)?.candidates.length ?? 0}
                  </span>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {current && (
              <>
                <Typography variant="caption" className={styles.status}>
                  {current.confirmedWeekStart ? (
                    <>
                      <span>Orden confirmado de la semana del {formatWeek(current.confirmedWeekStart)}</span>
                      {current.isManual && <span> · corregido a mano</span>}
                    </>
                  ) : (
                    <span>Orden propuesto por encaje</span>
                  )}
                </Typography>

                {candidatesInOrder.length === 0 ? (
                  <Typography className={styles.emptyMessage}>No hay candidatos para este puesto.</Typography>
                ) : (
                  <>
                    {canRate && (
                      <Typography variant="caption" className={styles.hint}>
                        Ordena de mejor a peor encaje para el puesto. Arrastra o usa las flechas; el orden guardado es el que usa la propuesta de desconvocatoria.
                      </Typography>
                    )}
                    <PositionCandidateList
                      label={label}
                      candidates={candidatesInOrder}
                      readOnly={!canRate}
                      onMove={(id, direction) => fit.move(selected, id, direction)}
                      onDrop={(activeId, overId) => fit.moveTo(selected, activeId, overId)}
                    />
                  </>
                )}

                <PositionWeightsEditor
                  key={`${selected}:${JSON.stringify(current.weights)}`}
                  weights={current.weights}
                  readOnly={!canRate}
                  saving={saving}
                  onSave={handleSaveWeights}
                />
              </>
            )}
          </div>
        )}
      </ContentLayout>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Salir sin guardar"
        description="Hay cambios sin guardar. Si sales ahora, se perderán."
        confirmText="Salir"
        onCancel={() => setLeaveConfirmOpen(false)}
        onConfirm={goBack}
      />
    </BaseLayout>
  );
}
