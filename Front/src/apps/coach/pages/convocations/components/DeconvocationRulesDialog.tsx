import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { resetDeconvocationRules, saveDeconvocationRules } from "../../../services/deconvocationRulesService";
import { DEFAULT_RULES } from "../utils/rules/defaultRules";
import {
  RULE_CATALOG,
  buildDefaultRule,
  unusedConditions,
  type DeconvocationRuleConfig,
  type NumberField,
  type RuleCondition,
} from "../utils/rules/ruleCatalog";
import styles from "./DeconvocationRulesDialog.module.css";

type Props = {
  open: boolean;
  teamId: string;
  /** Rules currently applied to the team (the default set when none is saved). */
  rules: DeconvocationRuleConfig[];
  onClose: () => void;
  /** Called after the configuration was saved or restored, so the proposal can be regenerated. */
  onSaved: () => void;
};

type NumberGroup = "points" | "weights";

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function withDefaults(rules: DeconvocationRuleConfig[]): DeconvocationRuleConfig[] {
  return rules.map((rule) => {
    const base = buildDefaultRule(rule.condition);
    return { ...rule, points: { ...base.points, ...rule.points }, weights: { ...base.weights, ...rule.weights } };
  });
}

export default function DeconvocationRulesDialog({ open, teamId, rules, onClose, onSaved }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [draft, setDraft] = useState<DeconvocationRuleConfig[]>(() => withDefaults(rules));
  const [newCondition, setNewCondition] = useState<RuleCondition | "">("");
  const [deleteTarget, setDeleteTarget] = useState<RuleCondition | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) setDraft(withDefaults(rules));
  }, [open, rules]);

  const available = unusedConditions(draft);
  const hasEmptyText = draft.some((rule) => !rule.text.trim());

  function updateRule(condition: RuleCondition, patch: Partial<DeconvocationRuleConfig>) {
    setDraft((current) => current.map((rule) => (rule.condition === condition ? { ...rule, ...patch } : rule)));
  }

  function updateNumber(condition: RuleCondition, group: NumberGroup, key: string, raw: string) {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) return;
    setDraft((current) =>
      current.map((rule) =>
        rule.condition === condition ? { ...rule, [group]: { ...rule[group], [key]: value } } : rule,
      ),
    );
  }

  function addRule() {
    if (!newCondition) return;
    setDraft((current) => [...current, buildDefaultRule(newCondition)]);
    setNewCondition("");
  }

  async function handleSave() {
    setProcessing(true);
    try {
      await saveDeconvocationRules(teamId, draft);
      notify("Reglas de desconvocatoria guardadas", "success");
      onSaved();
      onClose();
    } catch {
      notify("No se pudieron guardar las reglas", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleReset() {
    setProcessing(true);
    try {
      await resetDeconvocationRules(teamId);
      setDraft(DEFAULT_RULES);
      notify("Reglas restablecidas a los valores por defecto", "success");
      setResetOpen(false);
      onSaved();
      onClose();
    } catch {
      notify("No se pudieron restablecer las reglas", "error");
    } finally {
      setProcessing(false);
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDraft((current) => current.filter((rule) => rule.condition !== deleteTarget));
    setDeleteTarget(null);
  }

  function renderFields(rule: DeconvocationRuleConfig, group: NumberGroup, fields: NumberField[]) {
    if (fields.length === 0) return null;
    return (
      <section className={styles.fieldGroup}>
        <h4 className={styles.groupTitle}>{group === "points" ? "Ajustes" : "Pesos"}</h4>
        <div className={styles.fields}>
          {fields.map((field) => (
            <TextField
              key={field.key}
              type="number"
              size="small"
              label={field.label}
              value={rule[group][field.key] ?? field.default}
              onChange={(e) => updateNumber(rule.condition, group, field.key, e.target.value)}
              inputProps={{ min: field.min, max: field.max, step: "any" }}
            />
          ))}
        </div>
      </section>
    );
  }

  const deleteTitle = deleteTarget ? RULE_CATALOG[deleteTarget].title : "";
  const deleteIsMandatory = deleteTarget ? !!RULE_CATALOG[deleteTarget].mandatory : false;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
        <DialogTitle>Reglas de la propuesta de desconvocatoria</DialogTitle>
        <DialogContent dividers>
          <p className={styles.intro}>
            Los puntos y los pesos de cada regla se suman a la puntuación de protección de cada jugador: los que menos
            puntúan son los candidatos a desconvocar. Los cambios se aplican a las propuestas nuevas.
          </p>
          <div className={styles.cards}>
            {draft.map((rule) => {
              const def = RULE_CATALOG[rule.condition];
              return (
                <article key={rule.condition} role="group" aria-label={def.title} className={styles.card}>
                  <header className={styles.cardHeader}>
                    <div className={styles.cardTitleBlock}>
                      <h3 className={styles.cardTitle}>{def.title}</h3>
                      {def.mandatory && <Chip size="small" color="warning" label="Obligatoria" />}
                    </div>
                    <IconButton
                      size="small"
                      aria-label={`Eliminar regla ${def.title}`}
                      onClick={() => setDeleteTarget(rule.condition)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </header>
                  <p className={styles.cardDescription}>{def.description}</p>
                  <TextField
                    size="small"
                    fullWidth
                    label="Texto"
                    value={rule.text}
                    error={!rule.text.trim()}
                    helperText={
                      !rule.text.trim()
                        ? "El texto no puede estar vacío"
                        : def.placeholders
                          ? `Puedes usar: ${def.placeholders.join(", ")}`
                          : undefined
                    }
                    onChange={(e) => updateRule(rule.condition, { text: e.target.value })}
                    inputProps={{ maxLength: 200 }}
                  />
                  {renderFields(rule, "points", def.points)}
                  {renderFields(rule, "weights", def.weights)}
                </article>
              );
            })}
          </div>

          {available.length > 0 && (
            <div className={styles.addRow}>
              <TextField
                select
                size="small"
                label="Condición de la nueva regla"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value as RuleCondition)}
                className={styles.addSelect}
              >
                {available.map((condition) => (
                  <MenuItem key={condition} value={condition}>
                    {RULE_CATALOG[condition].title}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" size="small" disabled={!newCondition} onClick={addRule}>
                Añadir regla
              </Button>
            </div>
          )}
        </DialogContent>
        <DialogActions className={styles.actions}>
          <Button color="inherit" size="small" disabled={processing} onClick={() => setResetOpen(true)}>
            Restablecer valores por defecto
          </Button>
          <span className={styles.spacer} />
          <Button color="inherit" size="small" disabled={processing} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={processing || hasEmptyText}
            onClick={handleSave}
            startIcon={processing ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Eliminar la regla «${deleteTitle}»`}
        description={
          deleteIsMandatory
            ? "Es una regla obligatoria: si la eliminas, ya no forzará la desconvocatoria de los jugadores afectados. ¿Quieres eliminarla?"
            : "La regla dejará de puntuar en la propuesta. ¿Quieres eliminarla?"
        }
        confirmText="Eliminar"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={resetOpen}
        title="Restablecer valores por defecto"
        description="Se descartará la configuración guardada del equipo y se usarán las reglas por defecto. ¿Quieres continuar?"
        confirmText="Restablecer"
        processing={processing}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleReset}
      />
    </>
  );
}
