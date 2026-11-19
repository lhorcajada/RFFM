import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  createAiProvider,
  testAiProviderConnection,
  updateAiProvider,
  type AiProvider,
  type AiProviderRequest,
  type AiProviderTemplateId,
} from "../../../services/aiProviderService";
import { mapApiErrorToMessage } from "../../../../../shared/utils/errorMessages";
import { notify } from "../../../../../shared/pages/Profile/notify";
import { AI_PROVIDER_TEMPLATES, findAiProviderTemplate } from "../aiProviderTemplates";
import styles from "./AiProviderFormDialog.module.css";

type Props = {
  open: boolean;
  provider: AiProvider | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  template: AiProviderTemplateId | "";
  baseUrl: string;
  apiKey: string;
  model: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type TestOutcome = { success: boolean; message: string };

const EMPTY_FORM: FormState = { template: "", baseUrl: "", apiKey: "", model: "" };

function toForm(provider: AiProvider | null): FormState {
  if (!provider) return EMPTY_FORM;
  return { template: provider.template, baseUrl: provider.baseUrl, apiKey: "", model: provider.model };
}

export default function AiProviderFormDialog({ open, provider, onClose, onSaved }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [form, setForm] = useState<FormState>(() => toForm(provider));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(provider));
    setErrors({});
    setTestOutcome(null);
  }, [open, provider]);

  const isEditing = provider !== null;
  const selectedTemplate = form.template ? findAiProviderTemplate(form.template) : null;

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setTestOutcome(null);
  };

  const handleTemplateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const template = findAiProviderTemplate(event.target.value as AiProviderTemplateId);
    setForm((prev) => ({
      ...prev,
      template: template.id,
      baseUrl: template.baseUrl || prev.baseUrl,
      model: template.model || prev.model,
    }));
    setErrors({});
    setTestOutcome(null);
  };

  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    const baseUrl = form.baseUrl.trim();
    if (!form.template) found.template = "La plantilla o el tipo de proveedor es obligatorio.";
    if (!baseUrl) found.baseUrl = "La URL base es obligatoria.";
    else if (!/^https:\/\//i.test(baseUrl)) found.baseUrl = "La URL base debe ser una dirección https válida.";
    if (!form.apiKey.trim() && !isEditing) found.apiKey = "La clave de API es obligatoria.";
    if (!form.model.trim()) found.model = "El modelo es obligatorio.";
    return found;
  };

  const buildRequest = (template: AiProviderTemplateId): AiProviderRequest => ({
    template,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim() || null,
    model: form.model.trim(),
  });

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !form.template) return;

    setSaving(true);
    try {
      const request = buildRequest(form.template);
      if (provider) await updateAiProvider(provider.id, request);
      else await createAiProvider(request);
      notify("Proveedor de IA guardado.", "success");
      onSaved();
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !form.template) return;

    setTesting(true);
    setTestOutcome(null);
    try {
      const result = await testAiProviderConnection({ ...buildRequest(form.template), id: provider?.id ?? null });
      setTestOutcome({ success: result.success, message: result.message });
    } catch (error) {
      setTestOutcome({ success: false, message: mapApiErrorToMessage(error) });
    } finally {
      setTesting(false);
    }
  };

  const busy = saving || testing;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{isEditing ? "Editar proveedor de IA" : "Añadir proveedor de IA"}</DialogTitle>
      <form onSubmit={handleSave} noValidate>
        <DialogContent>
          <div className={styles.form}>
            <TextField
              select
              label="Proveedor"
              value={form.template}
              onChange={handleTemplateChange}
              error={Boolean(errors.template)}
              helperText={errors.template ?? selectedTemplate?.hint ?? " "}
              fullWidth
              size="small"
              required
            >
              {AI_PROVIDER_TEMPLATES.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="URL base"
              value={form.baseUrl}
              onChange={(event) => updateField("baseUrl", event.target.value)}
              error={Boolean(errors.baseUrl)}
              helperText={errors.baseUrl ?? " "}
              fullWidth
              size="small"
              required
              inputProps={{ maxLength: 500 }}
            />
            <TextField
              label="Clave de API"
              type="password"
              autoComplete="new-password"
              value={form.apiKey}
              onChange={(event) => updateField("apiKey", event.target.value)}
              error={Boolean(errors.apiKey)}
              helperText={
                errors.apiKey ??
                (provider
                  ? `Clave guardada: ${provider.maskedApiKey}. Déjala vacía para conservarla.`
                  : "Se guarda cifrada en el servidor y no se vuelve a mostrar.")
              }
              fullWidth
              size="small"
              required={!isEditing}
              inputProps={{ maxLength: 500 }}
            />
            <TextField
              label="Modelo"
              value={form.model}
              onChange={(event) => updateField("model", event.target.value)}
              error={Boolean(errors.model)}
              helperText={errors.model ?? " "}
              fullWidth
              size="small"
              required
              inputProps={{ maxLength: 200 }}
            />
            {testOutcome && <Alert severity={testOutcome.success ? "success" : "error"}>{testOutcome.message}</Alert>}
          </div>
        </DialogContent>
        <DialogActions className={styles.actions}>
          <Button
            onClick={() => void handleTest()}
            disabled={busy}
            startIcon={testing ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Probar conexión
          </Button>
          <span className={styles.spacer} />
          <Button onClick={onClose} color="inherit" disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
