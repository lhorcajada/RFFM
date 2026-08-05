import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import teamRulesService, {
  type SaveTeamRuleRequest,
  type SaveTeamRulesCommand,
} from "../../services/teamRulesService";
import styles from "./TeamRulesEdit.module.css";

interface RuleDraft {
  key: number;
  id?: string | null;
  shortTitle: string;
  highlight: string;
  violationSummary: string;
  consequenceSummary: string;
  longDescription: string;
  bulletPoints: string;
  consequenceDetail: string;
}

let _keyCounter = -1;
const nextKey = () => _keyCounter--;

function emptyRuleDraft(): RuleDraft {
  return {
    key: nextKey(),
    shortTitle: "",
    highlight: "",
    violationSummary: "",
    consequenceSummary: "",
    longDescription: "",
    bulletPoints: "",
    consequenceDetail: "",
  };
}

function toRuleRequest(draft: RuleDraft): SaveTeamRuleRequest {
  return {
    id: draft.id ?? undefined,
    shortTitle: draft.shortTitle.trim(),
    highlight: draft.highlight.trim() || null,
    violationSummary: draft.violationSummary.trim(),
    consequenceSummary: draft.consequenceSummary.trim(),
    longDescription: draft.longDescription.trim() || null,
    bulletPoints: draft.bulletPoints.trim()
      ? draft.bulletPoints.split("\n").map((b) => b.trim()).filter(Boolean)
      : null,
    consequenceDetail: draft.consequenceDetail.trim() || null,
  };
}

export default function TeamRulesEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { team, teamTitleNode } = useTeamAndClub();
  const teamIdFromUrl = new URLSearchParams(location.search).get("teamId") ?? "";
  const resolvedTeamId = team?.id || teamIdFromUrl;

  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [introNote, setIntroNote] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!resolvedTeamId) return;
    let mounted = true;
    setLoading(true);
    teamRulesService
      .getTeamRules(resolvedTeamId)
      .then((existing) => {
        if (!mounted) return;
        if (existing) {
          setIsEdit(true);
          setTitle(existing.title);
          setSubtitle(existing.subtitle);
          setIntroNote(existing.introNote);
          setClosingNote(existing.closingNote ?? "");
          setApplicationNote(existing.applicationNote ?? "");
          setRules(
            existing.rules
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((r) => ({
                key: nextKey(),
                id: r.id,
                shortTitle: r.shortTitle,
                highlight: r.highlight ?? "",
                violationSummary: r.violationSummary,
                consequenceSummary: r.consequenceSummary,
                longDescription: r.longDescription ?? "",
                bulletPoints: r.bulletPoints?.join("\n") ?? "",
                consequenceDetail: r.consequenceDetail ?? "",
              }))
          );
        } else {
          setIsEdit(false);
          setRules([emptyRuleDraft()]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [resolvedTeamId]);

  const updateRule = (key: number, patch: Partial<RuleDraft>) => {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRule = () => {
    setRules((prev) => [...prev, emptyRuleDraft()]);
  };

  const removeRule = (key: number) => {
    setRules((prev) => prev.filter((r) => r.key !== key));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    setRules((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const validate = (): string[] => {
    const validationErrors: string[] = [];
    if (!title.trim()) validationErrors.push("El título es obligatorio.");
    if (!subtitle.trim()) validationErrors.push("El subtítulo es obligatorio.");
    if (!introNote.trim()) validationErrors.push("La nota inicial es obligatoria.");
    if (rules.length === 0) validationErrors.push("Debe existir al menos una norma.");
    rules.forEach((r, i) => {
      if (!r.shortTitle.trim()) validationErrors.push(`La norma ${i + 1}: el título corto es obligatorio.`);
      if (!r.violationSummary.trim()) validationErrors.push(`La norma ${i + 1}: el incumplimiento es obligatorio.`);
      if (!r.consequenceSummary.trim()) validationErrors.push(`La norma ${i + 1}: la consecuencia es obligatoria.`);
    });
    return validationErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!resolvedTeamId) return;

    setErrors([]);
    setSaving(true);
    try {
      const command: SaveTeamRulesCommand = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        introNote: introNote.trim(),
        closingNote: closingNote.trim() || null,
        applicationNote: applicationNote.trim() || null,
        rules: rules.map(toRuleRequest),
      };
      await teamRulesService.saveTeamRules(resolvedTeamId, command);
      navigate(`/coach/team-rules${location.search}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/coach/team-rules${location.search}`);
  };

  const handleDelete = async () => {
    if (!resolvedTeamId) return;
    setDeleting(true);
    try {
      await teamRulesService.deleteTeamRules(resolvedTeamId);
      setDeleteDialogOpen(false);
      navigate(`/coach/team-rules${location.search}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={isEdit ? "Editar Normas del Equipo" : "Nuevas Normas del Equipo"}
        subtitle={teamTitleNode}
        actionBar={
          <>
            <Button startIcon={<ArrowBackIcon />} onClick={handleCancel} variant="outlined" size="small">
              Cancelar
            </Button>
            {isEdit && (
              <Button
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                variant="outlined"
                size="small"
                color="error"
              >
                Eliminar Normas
              </Button>
            )}
            <Button
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              variant="contained"
              size="small"
              color="primary"
              disabled={saving || loading}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {loading ? (
          <Box className={styles.loadingBox}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <Box className={styles.form}>
            {errors.length > 0 && (
              <Box className={styles.errorsBox}>
                {errors.map((e, i) => (
                  <Typography key={i} className={styles.errorText}>
                    {e}
                  </Typography>
                ))}
              </Box>
            )}

            <Box className={styles.metadataSection}>
              <TextField
                label="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="small"
                fullWidth
                className={styles.field}
              />
              <TextField
                label="Subtítulo"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                size="small"
                fullWidth
                className={styles.field}
              />
              <TextField
                label="Nota inicial"
                value={introNote}
                onChange={(e) => setIntroNote(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
                className={styles.field}
              />
              <TextField
                label="Nota de cierre (opcional)"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
                className={styles.field}
              />
              <TextField
                label="Nota de aplicación (opcional)"
                value={applicationNote}
                onChange={(e) => setApplicationNote(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
                className={styles.field}
              />
            </Box>

            <Box className={styles.rulesSection}>
              <Box className={styles.rulesSectionHeader}>
                <Typography className={styles.rulesSectionTitle}>Normas</Typography>
                <Button
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={addRule}
                  size="small"
                  variant="outlined"
                >
                  Añadir norma
                </Button>
              </Box>

              {rules.map((rule, index) => (
                <Card key={rule.key} variant="outlined" className={styles.ruleCard}>
                  <CardContent>
                    <Box className={styles.ruleCardHeader}>
                      <Typography className={styles.ruleCardIndex}>Norma {index + 1}</Typography>
                      <Box className={styles.ruleCardActions}>
                        <IconButton
                          aria-label="Mover arriba"
                          size="small"
                          disabled={index === 0}
                          onClick={() => moveRule(index, -1)}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Mover abajo"
                          size="small"
                          disabled={index === rules.length - 1}
                          onClick={() => moveRule(index, 1)}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Quitar norma"
                          size="small"
                          color="error"
                          onClick={() => removeRule(rule.key)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <TextField
                      label="Título corto"
                      value={rule.shortTitle}
                      onChange={(e) => updateRule(rule.key, { shortTitle: e.target.value })}
                      size="small"
                      fullWidth
                      className={styles.field}
                    />
                    <TextField
                      label="Frase destacada (opcional)"
                      value={rule.highlight}
                      onChange={(e) => updateRule(rule.key, { highlight: e.target.value })}
                      size="small"
                      fullWidth
                      className={styles.field}
                    />
                    <TextField
                      label="Incumplimiento"
                      value={rule.violationSummary}
                      onChange={(e) => updateRule(rule.key, { violationSummary: e.target.value })}
                      size="small"
                      fullWidth
                      className={styles.field}
                    />
                    <TextField
                      label="Consecuencia"
                      value={rule.consequenceSummary}
                      onChange={(e) => updateRule(rule.key, { consequenceSummary: e.target.value })}
                      size="small"
                      fullWidth
                      className={styles.field}
                    />
                    <TextField
                      label="Descripción larga (opcional)"
                      value={rule.longDescription}
                      onChange={(e) => updateRule(rule.key, { longDescription: e.target.value })}
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      className={styles.field}
                    />
                    <TextField
                      label="Puntos (uno por línea, opcional)"
                      value={rule.bulletPoints}
                      onChange={(e) => updateRule(rule.key, { bulletPoints: e.target.value })}
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      className={styles.field}
                    />
                    <TextField
                      label="Detalle de la consecuencia (opcional)"
                      value={rule.consequenceDetail}
                      onChange={(e) => updateRule(rule.key, { consequenceDetail: e.target.value })}
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      className={styles.field}
                    />
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}
      </ContentLayout>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar normas del equipo</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que quieres eliminar las normas del equipo? Esta acción no se puede deshacer.
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
