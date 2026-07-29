import { useRef, useState } from "react";
import { Box, Button, IconButton, Typography, CircularProgress } from "@mui/material";
import gameModelService from "../../../services/gameModelService";
import { resolveMediaUrl } from "./resolveMediaUrl";
import styles from "./ScenarioMediaField.module.css";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_DURATION_SECONDS = 10;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

export function validateVideoConstraints(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.style.display = "none";
    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };
    video.onloadedmetadata = () => {
      if (video.duration > MAX_DURATION_SECONDS) {
        cleanup();
        resolve("El vídeo no puede durar más de 10 segundos.");
        return;
      }
      if (video.videoWidth > MAX_WIDTH || video.videoHeight > MAX_HEIGHT) {
        cleanup();
        resolve("El vídeo no puede superar 1920x1080.");
        return;
      }
      cleanup();
      resolve(null);
    };
    video.onerror = () => {
      cleanup();
      resolve("No se pudo leer el vídeo.");
    };
    video.src = URL.createObjectURL(file);
    document.body.appendChild(video);
  });
}

interface ScenarioMediaFieldProps {
  scenarioApiId: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  onChange: (mediaUrl: string | null, mediaType: "image" | "video" | null) => void;
}

export default function ScenarioMediaField({
  scenarioApiId,
  mediaUrl,
  mediaType,
  onChange,
}: ScenarioMediaFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("El archivo supera el límite de 20 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.type.startsWith("video/")) {
      const videoError = await validateVideoConstraints(file);
      if (videoError) {
        setError(videoError);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setUploading(true);
    try {
      const result = await gameModelService.uploadScenarioMedia(scenarioApiId, file);
      onChange(result.url, result.mediaType);
    } catch {
      setError("No se pudo subir el archivo. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setError(null);
    setUploading(true);
    try {
      await gameModelService.deleteScenarioMedia(scenarioApiId);
      onChange(null, null);
    } catch {
      setError("No se pudo eliminar el archivo. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const inputId = `scenario-media-input-${scenarioApiId}`;

  return (
    <Box className={styles.mediaSection}>
      <Typography className={styles.sectionLabel}>Imagen / Vídeo</Typography>

      {mediaUrl && (
        <Box className={styles.mediaPreviewWrap}>
          {mediaType === "video" ? (
            <video src={resolveMediaUrl(mediaUrl)} controls className={styles.mediaPreview} />
          ) : (
            <img src={resolveMediaUrl(mediaUrl)} alt="Vista previa" className={styles.mediaPreview} />
          )}
          <IconButton
            size="small"
            onClick={handleRemove}
            className={styles.mediaRemoveBtn}
            title="Quitar"
            aria-label="Quitar"
            disabled={uploading}
          >
            ✕
          </IconButton>
        </Box>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        className={styles.hiddenInput}
        onChange={handleFileChange}
        id={inputId}
        disabled={uploading}
      />
      <label htmlFor={inputId}>
        <Button
          component="span"
          size="small"
          variant="outlined"
          className={styles.uploadBtn}
          disabled={uploading}
        >
          {uploading ? (
            <CircularProgress size={16} />
          ) : mediaUrl ? (
            "Cambiar archivo"
          ) : (
            "Subir imagen / vídeo"
          )}
        </Button>
      </label>

      {error && (
        <Typography color="error" className={styles.error}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
