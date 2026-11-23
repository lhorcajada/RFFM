import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { mapApiErrorToMessage } from "../../../../shared/utils/errorMessages";
import { notify } from "../../../../shared/pages/Profile/notify";
import {
  activateAiProvider,
  deleteAiProvider,
  getAiProviders,
  testAiProviderConnection,
  type AiProvider,
} from "../../services/aiProviderService";
import AiProviderCard from "./components/AiProviderCard";
import AiProviderFormDialog from "./components/AiProviderFormDialog";
import styles from "./AiSettings.module.css";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; providers: AiProvider[] };

const AiSettings: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiProvider | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", providers: await getAiProviders() });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (provider: AiProvider) => {
    setEditing(provider);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    void load();
  };

  const handleActivate = async (provider: AiProvider) => {
    setProcessing(true);
    try {
      await activateAiProvider(provider.id);
      await load();
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleTest = async (provider: AiProvider) => {
    setProcessing(true);
    try {
      const result = await testAiProviderConnection({
        id: provider.id,
        template: provider.template,
        baseUrl: provider.baseUrl,
        apiKey: null,
        model: provider.model,
      });
      notify(result.message, result.success ? "success" : "error");
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setProcessing(true);
    try {
      await deleteAiProvider(deleteTarget.id);
      setDeleteTarget(null);
      notify("Proveedor de IA eliminado.", "success");
      await load();
    } catch (error) {
      setDeleteTarget(null);
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Ajustes de IA"
        subtitle="Tus proveedores"
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="outlined" size="small">
              Volver
            </Button>
            <Button startIcon={<AddIcon />} onClick={openCreate} variant="contained" size="small">
              Añadir proveedor
            </Button>
          </Stack>
        }
      >
        <Box className={styles.container}>
          <Alert severity="info" className={styles.notice}>
            Cada usuario usa su propia clave de API. La clave se guarda cifrada en el servidor y nunca se vuelve a mostrar.
          </Alert>

          <Alert
            severity="info"
            className={styles.notice}
            role="note"
            aria-label="Datos que recibe el proveedor de IA"
          >
            Cuando usas el asistente del modelo de juego, tu proveedor recibe el modelo de juego, los objetivos de temporada,
            las sesiones cercanas y las previsiones de la liga. De cada jugador recibe su alias, sus lesiones (tipo y fechas) y su
            condición física. No se envían datos personales identificativos (nombre, DNI, teléfono ni correo).
          </Alert>

          {state.status === "loading" && (
            <Box className={styles.centered}>
              <CircularProgress />
            </Box>
          )}

          {state.status === "error" && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void load()}>
                  Reintentar
                </Button>
              }
            >
              No se pudieron cargar los proveedores de IA.
            </Alert>
          )}

          {state.status === "ready" && state.providers.length === 0 && (
            <Typography>Todavía no has añadido ningún proveedor de IA.</Typography>
          )}

          {state.status === "ready" && state.providers.length > 0 && (
            <Box className={styles.cardsList}>
              {state.providers.map((provider) => (
                <AiProviderCard
                  key={provider.id}
                  provider={provider}
                  busy={processing}
                  onActivate={(target) => void handleActivate(target)}
                  onTest={(target) => void handleTest(target)}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </Box>
          )}
        </Box>

        <AiProviderFormDialog
          open={formOpen}
          provider={editing}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />

        <ConfirmDialog
          open={deleteTarget !== null}
          title="Eliminar proveedor de IA"
          description="¿Eliminar este proveedor y su clave guardada? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          processing={processing}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDeleteConfirmed()}
        />
      </ContentLayout>
    </BaseLayout>
  );
};

export default AiSettings;
