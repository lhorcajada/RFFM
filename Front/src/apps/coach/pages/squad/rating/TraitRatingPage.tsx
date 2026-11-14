import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";

import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import RatingViewSwitcher from "./components/RatingViewSwitcher";
import TraitBoardView from "./components/TraitBoardView";
import TraitPlayerCard from "./components/TraitPlayerCard";
import { squadSearchFrom, useRatingView } from "./ratingViews";
import { useTraitRating } from "./useTraitRating";

import styles from "./TraitRatingPage.module.css";

type GroupBy = "trait" | "player";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "trait", label: "Por rasgo" },
  { value: "player", label: "Por jugador" },
];

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

export default function TraitRatingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useRatingView();
  const { roles } = usePermissions();
  const canRate = roles.includes("Coach") || roles.includes("Administrator");

  const { loading, loadError, saving, players, draft, previousLevels, plan, hasUnsavedChanges, setLevel, setTrend, save } =
    useTraitRating(searchParams.get("teamId"), searchParams.get("seasonId"));

  const [groupBy, setGroupBy] = useState<GroupBy>("trait");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ratedAt, setRatedAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  function goBack() {
    navigate(`/coach/squad${squadSearchFrom(searchParams)}`);
  }

  async function handleSave() {
    try {
      const savedCount = await save(ratedAt);
      showSnackbar(savedCount === 1 ? "Valoración guardada" : `${savedCount} valoraciones guardadas`, "success");
    } catch {
      showSnackbar("Error al guardar las valoraciones", "error");
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
              {canRate && (
                <TextField
                  label="Fecha de valoración"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={ratedAt}
                  onChange={(e) => setRatedAt(e.target.value)}
                  className={styles.dateField}
                />
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => (hasUnsavedChanges ? setLeaveConfirmOpen(true) : goBack())}
              >
                Volver
              </Button>
              {canRate && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={plan.items.length === 0 || saving}
                  onClick={handleSave}
                >
                  {saving ? "Guardando…" : plan.items.length > 0 ? `Guardar (${plan.items.length})` : "Guardar"}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {loadError ? (
          <Alert severity="error">No se pudieron cargar los jugadores y sus valoraciones.</Alert>
        ) : players.length === 0 ? (
          <Typography className={styles.emptyMessage}>No hay jugadores de campo en la plantilla.</Typography>
        ) : (
          <div className={styles.content}>
            <ToggleButtonGroup
              value={groupBy}
              exclusive
              size="small"
              aria-label="Cómo mostrar la valoración"
              onChange={(_, value: GroupBy | null) => { if (value) setGroupBy(value); }}
            >
              {GROUP_OPTIONS.map(({ value, label }) => (
                <ToggleButton key={value} value={value} className={styles.toggleBtn}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {groupBy === "trait" ? (
              <TraitBoardView
                players={players}
                draft={draft}
                readOnly={!canRate}
                onPlace={(playerIds, traitKey, level) => playerIds.forEach((id) => setLevel(id, traitKey, level))}
              />
            ) : (
              <div className={styles.list}>
                {canRate && (
                  <Typography variant="caption" className={styles.hint}>
                    Abre un jugador y ajusta solo lo que ha cambiado: parte de su última valoración. El borde discontinuo marca el nivel anterior.
                  </Typography>
                )}
                {players.map((player) => (
                  <TraitPlayerCard
                    key={player.id}
                    player={player}
                    draft={draft[player.id] ?? { levels: {}, trend: "same" }}
                    previousLevels={previousLevels[player.id] ?? {}}
                    readOnly={!canRate}
                    expanded={expandedId === player.id}
                    onToggle={() => setExpandedId((current) => (current === player.id ? null : player.id))}
                    onLevel={(traitKey, level) => setLevel(player.id, traitKey, level)}
                    onTrend={(trend) => setTrend(player.id, trend)}
                  />
                ))}
              </div>
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
