import { useEffect, useState, useRef } from "react";
import {
  Box,
  Tab,
  Tabs,
  Typography,
  CircularProgress,
  Button,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import gameModelService from "../../services/gameModelService";
import type { GameModel } from "../../types/gameModel";
import {
  GameModelDraftProvider,
  useGameModelDraft,
} from "../../context/GameModelDraftContext";
import ScenarioFormAccordion from "./components/ScenarioFormAccordion";
import MobileSaveCancelBar from "./components/MobileSaveCancelBar";
import styles from "./GameModelCreate.module.css";

// ─── Validation ──────────────────────────────────────────────────────

interface ValidationError {
  path: string;   // e.g. "Defensa Organizada > Zona de Iniciación > Escenario 1"
  message: string;
}

function validateDraft(draft: GameModel): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!draft.name.trim()) {
    errors.push({ path: "Cabecera", message: "El nombre del modelo es obligatorio." });
  }

  let totalScenarios = 0;

  for (const moment of draft.gameMoments) {
    for (const zone of moment.zones) {
      for (let pi = 0; pi < zone.principles.length; pi++) {
        const principle = zone.principles[pi];
        const pPath = `${moment.name} › ${zone.name} › Principio ${pi + 1}`;

        if (!principle.title.trim()) {
          errors.push({ path: pPath, message: "El título del principio es obligatorio." });
        }

        for (let si = 0; si < principle.scenarios.length; si++) {
          totalScenarios++;
          const s = principle.scenarios[si];
          const sPath = `${pPath} › Escenario ${si + 1}`;

          if (!s.name.trim()) {
            errors.push({ path: sPath, message: "El nombre del escenario es obligatorio." });
          }

          for (let spi = 0; spi < s.subPrinciples.length; spi++) {
            const sp = s.subPrinciples[spi];
            const spPath = `${sPath} › Subprincipio ${sp.label}`;

            if (!sp.name.trim()) {
              errors.push({ path: spPath, message: "El nombre del subprincipio es obligatorio." });
            }

            for (let qi = 0; qi < sp.subSubPrinciples.length; qi++) {
              const ssp = sp.subSubPrinciples[qi];
              const sspPath = `${spPath} › Sub-subprincipio ${qi + 1}`;

              if (!ssp.name.trim()) {
                errors.push({ path: sspPath, message: "El nombre del sub-subprincipio es obligatorio." });
              }
              if (!ssp.action.trim()) {
                errors.push({ path: sspPath, message: "La acción del sub-subprincipio es obligatoria." });
              }

              for (let ki = 0; ki < ssp.essentialSkills.length; ki++) {
                const sk = ssp.essentialSkills[ki];
                if (!sk.name.trim()) {
                  errors.push({
                    path: `${sspPath} › Habilidad ${ki + 1}`,
                    message: "El nombre de la habilidad es obligatorio.",
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  if (totalScenarios === 0) {
    errors.push({ path: "General", message: "El modelo debe tener al menos un escenario." });
  }

  return errors;
}

// ─── Zone content editor ─────────────────────────────────────────────

function ZoneFormContent({
  mi,
  zi,
}: {
  mi: number;
  zi: number;
}) {
  const { draft } = useGameModelDraft();
  const zone = draft.gameMoments[mi]?.zones[zi];
  if (!zone) return null;

  return (
    <Box className={styles.zoneContent}>
      <ScenarioFormAccordion mi={mi} zi={zi} principles={zone.principles} />
    </Box>
  );
}

// ─── Form editor (needs context) ─────────────────────────────────────

function GameModelFormEditor({ onSave, onCancel, isEdit, saveRef }: {
  onSave: (draft: GameModel) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
  saveRef: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
  const { draft, dispatch } = useGameModelDraft();
  const [momentTab, setMomentTab] = useState(0);
  const [zoneTab, setZoneTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const handleMomentChange = (_: React.SyntheticEvent, v: number) => {
    setMomentTab(v);
    setZoneTab(0);
  };

  const handleSave = async () => {
    const errors = validateDraft(draft);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  // Expose handleSave to parent via ref
  saveRef.current = handleSave;

  const currentMoment = draft.gameMoments[momentTab];

  return (
    <Box className={styles.editor}>
      {/* Model name field */}
      <Box className={styles.modelHeader}>
        <TextField
          value={draft.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: "SET_NAME", value: e.target.value })}
          label="Nombre del modelo"
          size="small"
          className={styles.nameField}
          placeholder="Nombre del modelo de juego"
        />
      </Box>

      {/* Moment tabs */}
      <Box className={styles.momentTabsWrap}>
        <Tabs
          value={momentTab}
          onChange={handleMomentChange}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ className: styles.tabIndicator }}
          className={styles.momentTabs}
        >
          {draft.gameMoments.map((m) => (
            <Tab
              key={m.id}
              label={m.name}
              className={styles.momentTab}
            />
          ))}
        </Tabs>
      </Box>

      {/* Moment content */}
      {currentMoment && (
        <Box className={styles.momentContent}>
          {/* Zone tabs */}
          <Box className={styles.zoneTabsWrap}>
            <Tabs
              value={zoneTab}
              onChange={(_, v) => setZoneTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              TabIndicatorProps={{ className: styles.zoneTabIndicator }}
              className={styles.zoneTabs}
            >
              {currentMoment.zones.map((z, zi) => {
                const principleCount = z.principles.length;
                return (
                <Tab
                  key={z.id}
                  className={styles.zoneTab}
                  label={
                    <Box className={styles.zoneTabLabel}>
                      <span>{z.name}</span>
                      {principleCount > 0 && (
                        <Chip
                          label={principleCount}
                          size="small"
                          className={styles.zoneChip}
                        />
                      )}
                    </Box>
                  }
                  value={zi}
                />
                );
              })}
            </Tabs>
          </Box>

          {/* Zone form content */}
          <ZoneFormContent mi={momentTab} zi={zoneTab} />
        </Box>
      )}

      {/* Validation error dialog */}
      <Dialog
        open={validationErrors.length > 0}
        onClose={() => setValidationErrors([])}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Errores de validación</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Corrige los siguientes errores antes de guardar:
          </Alert>
          <List dense disablePadding>
            {validationErrors.map((e, i) => (
              <ListItem key={i} disableGutters>
                <ListItemText
                  primary={e.message}
                  secondary={e.path}
                  secondaryTypographyProps={{ sx: { fontSize: "0.75rem", color: "text.disabled" } }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationErrors([])} variant="contained" size="small">
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <MobileSaveCancelBar
        onSave={handleSave}
        onCancel={onCancel}
        saving={saving}
        saveLabel={isEdit ? "Guardar cambios" : "Guardar Modelo"}
      />
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function GameModelCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { season?: string; teamId?: string } | null;
  const seasonFromState = locationState?.season ?? "";
  const teamIdFromUrl = new URLSearchParams(location.search).get("teamId") ?? "";
  const teamIdFromState = locationState?.teamId ?? "";
  const resolvedTeamId = teamIdFromUrl || teamIdFromState;
  const isEdit = location.pathname.endsWith("/edit");

  const { team, teamTitleNode } = useTeamAndClub();

  const [draft, setDraft] = useState<GameModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const saveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const teamId = team?.id || resolvedTeamId;
    if (!teamId || !seasonFromState) {
      return;
    }
    setLoading(true);
    let mounted = true;
    async function init() {
      let initialDraft: GameModel;
      if (isEdit && seasonFromState) {
        const existing = await gameModelService.getByTeamIdAndSeason(teamId, seasonFromState);
        initialDraft = existing ?? (await gameModelService.getEmptyDraft(teamId, seasonFromState));
      } else {
        initialDraft = await gameModelService.getEmptyDraft(teamId, seasonFromState);
      }

      if (mounted) {
        setDraft(initialDraft);
        setLoading(false);
      }
    }
    init().catch((err) => {
      if (mounted) {
        setLoading(false);
        setInitError(err?.message ?? "Error al cargar el formulario");
      }
    });
    return () => { mounted = false; };
  }, [team, resolvedTeamId, isEdit, seasonFromState]);

  const handleSave = async (currentDraft: GameModel) => {
    setSaving(true);
    try {
      if (isEdit) {
        await gameModelService.update(currentDraft);
      } else {
        await gameModelService.create(currentDraft);
      }
      navigate(`/coach/game-model${location.search}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSave = () => {
    saveRef.current?.();
  };

  const handleCancel = () => {
    navigate(`/coach/game-model${location.search}`);
  };

  const pageTitle = isEdit
    ? `Editar Modelo · ${seasonFromState}`
    : `Nuevo Modelo · ${seasonFromState}`;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={pageTitle}
        subtitle={teamTitleNode}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleCancel}
              variant="outlined"
              size="small"
            >
              Cancelar
            </Button>
            <Button
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              onClick={handleTriggerSave}
              variant="contained"
              size="small"
              color="primary"
              disabled={saving || !draft}
            >
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar Modelo"}
            </Button>
          </>
        }
      >
        {loading || (!draft && !initError) ? (
          <Box className={styles.loadingBox}>
            <CircularProgress color="primary" />
          </Box>
        ) : initError ? (
          <Box className={styles.loadingBox}>
            <Typography color="error" sx={{ mb: 2 }}>{initError}</Typography>
            <Button variant="outlined" size="small" onClick={handleCancel}>Volver</Button>
          </Box>
        ) : draft ? (
          <GameModelDraftProvider initialDraft={draft}>
            <GameModelFormEditor onSave={handleSave} onCancel={handleCancel} isEdit={isEdit} saveRef={saveRef} />
          </GameModelDraftProvider>
        ) : null}
      </ContentLayout>
    </BaseLayout>
  );
}
