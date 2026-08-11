import { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Button,
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
import type { GameModel, GameMomentCatalogItem } from "../../types/gameModel";
import { GameModelDraftProvider, useGameModelDraft } from "../../context/GameModelDraftContext";
import GameModelFormEditor from "./components/GameModelFormEditor";
import MobileSaveCancelBar from "./components/MobileSaveCancelBar";
import styles from "./GameModelCreate.module.css";

// ─── Validation ──────────────────────────────────────────────────────

interface ValidationError {
  path: string;
  message: string;
}

function validateDraft(draft: GameModel): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!draft.name.trim()) {
    errors.push({ path: "Cabecera", message: "El nombre del modelo es obligatorio." });
  }

  let totalPrinciples = 0;

  for (let pi = 0; pi < draft.principles.length; pi++) {
    totalPrinciples++;
    const principle = draft.principles[pi];
    const pPath = `Principio ${pi + 1}`;

    if (!principle.titulo.trim()) {
      errors.push({ path: pPath, message: "El título del principio es obligatorio." });
    }

    for (let spi = 0; spi < principle.subprincipios.length; spi++) {
      const sp = principle.subprincipios[spi];
      const spPath = `${pPath} › Subprincipio ${sp.numero || spi + 1}`;

      if (!sp.titulo.trim()) {
        errors.push({ path: spPath, message: "El título del subprincipio es obligatorio." });
      }
      if (sp.zonas.length > 0 && sp.subSubPrincipios.length > 0) {
        errors.push({
          path: spPath,
          message: "Un subprincipio no puede tener Zonas y sub-subprincipios directos a la vez.",
        });
      }

      const validateSsp = (sspPath: string, numero: string, rol: string, habilidades: { nombre: string }[]) => {
        if (!rol.trim()) {
          errors.push({ path: sspPath, message: "El rol del sub-subprincipio es obligatorio." });
        }
        habilidades.forEach((h, hi) => {
          if (!h.nombre.trim()) {
            errors.push({ path: `${sspPath} › Habilidad ${hi + 1}`, message: "El nombre de la habilidad es obligatorio." });
          }
        });
      };

      sp.zonas.forEach((zona, zi) => {
        const zPath = `${spPath} › Zona ${zi + 1}`;
        if (zona.zoneKeys.length === 0) {
          errors.push({ path: zPath, message: "La zona debe tener al menos un zoneKey." });
        }
        zona.subSubPrincipios.forEach((ssp, sspi) =>
          validateSsp(`${zPath} › Sub-subprincipio ${sspi + 1}`, ssp.numero, ssp.rol, ssp.habilidades)
        );
      });

      sp.subSubPrincipios.forEach((ssp, sspi) =>
        validateSsp(`${spPath} › Sub-subprincipio ${sspi + 1}`, ssp.numero, ssp.rol, ssp.habilidades)
      );
    }
  }

  if (totalPrinciples === 0 && draft.setPieceRules.length === 0) {
    errors.push({ path: "General", message: "El modelo debe tener al menos un principio o una regla de balón parado." });
  }

  return errors;
}

// ─── Form editor wrapper (needs context) ─────────────────────────────

function GameModelFormEditorWithActions({
  moments,
  onSave,
  onCancel,
  isEdit,
  saveRef,
}: {
  moments: GameMomentCatalogItem[];
  onSave: (draft: GameModel) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
  saveRef: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
  const { draft } = useGameModelDraft();
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

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

  saveRef.current = handleSave;

  return (
    <Box className={styles.editor}>
      <GameModelFormEditor moments={moments} />

      <Dialog open={validationErrors.length > 0} onClose={() => setValidationErrors([])} maxWidth="sm" fullWidth>
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
  const [moments, setMoments] = useState<GameMomentCatalogItem[]>([]);
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
      const momentsList = await gameModelService.getMoments();
      let initialDraft: GameModel;
      if (isEdit && seasonFromState) {
        const existing = await gameModelService.getByTeamIdAndSeason(teamId, seasonFromState);
        initialDraft = existing ?? (await gameModelService.getEmptyDraft(teamId, seasonFromState));
      } else {
        initialDraft = await gameModelService.getEmptyDraft(teamId, seasonFromState);
      }

      if (mounted) {
        setMoments(momentsList);
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
    return () => {
      mounted = false;
    };
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

  const pageTitle = isEdit ? `Editar Modelo · ${seasonFromState}` : `Nuevo Modelo · ${seasonFromState}`;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={pageTitle}
        subtitle={teamTitleNode}
        actionBar={
          <>
            <Button startIcon={<ArrowBackIcon />} onClick={handleCancel} variant="outlined" size="small">
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
            <Typography color="error" sx={{ mb: 2 }}>
              {initError}
            </Typography>
            <Button variant="outlined" size="small" onClick={handleCancel}>
              Volver
            </Button>
          </Box>
        ) : draft ? (
          <GameModelDraftProvider initialDraft={draft}>
            <GameModelFormEditorWithActions
              moments={moments}
              onSave={handleSave}
              onCancel={handleCancel}
              isEdit={isEdit}
              saveRef={saveRef}
            />
          </GameModelDraftProvider>
        ) : null}
      </ContentLayout>
    </BaseLayout>
  );
}
