import React from "react";
import { Button, Card, CardActions, CardContent, Chip, Typography } from "@mui/material";
import type { AiProvider } from "../../../services/aiProviderService";
import { findAiProviderTemplate } from "../aiProviderTemplates";
import styles from "./AiProviderCard.module.css";

type Props = {
  provider: AiProvider;
  busy: boolean;
  onActivate: (provider: AiProvider) => void;
  onTest: (provider: AiProvider) => void;
  onEdit: (provider: AiProvider) => void;
  onDelete: (provider: AiProvider) => void;
};

export default function AiProviderCard({ provider, busy, onActivate, onTest, onEdit, onDelete }: Props) {
  const label = findAiProviderTemplate(provider.template).label;

  return (
    <Card className={`${styles.card} ${provider.isActive ? styles.active : ""}`.trim()} component="article" aria-label={label}>
      <CardContent className={styles.content}>
        <div className={styles.header}>
          <Typography variant="h6" component="h2">
            {label}
          </Typography>
          {provider.isActive && <Chip label="Activo" size="small" color="primary" />}
        </div>
        <Typography variant="body2">Modelo: {provider.model}</Typography>
        <Typography variant="body2" className={styles.url}>
          URL: {provider.baseUrl}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Clave: {provider.maskedApiKey}
        </Typography>
      </CardContent>
      <CardActions className={styles.actions}>
        {!provider.isActive && (
          <Button size="small" variant="contained" disabled={busy} onClick={() => onActivate(provider)}>
            Activar
          </Button>
        )}
        <Button size="small" disabled={busy} onClick={() => onTest(provider)}>
          Probar conexión
        </Button>
        <Button size="small" disabled={busy} onClick={() => onEdit(provider)}>
          Editar
        </Button>
        <Button size="small" color="error" disabled={busy} onClick={() => onDelete(provider)}>
          Eliminar
        </Button>
      </CardActions>
    </Card>
  );
}
