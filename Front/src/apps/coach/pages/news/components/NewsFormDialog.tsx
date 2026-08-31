import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from "@mui/material";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";
import newsService, { type NewsDetailDto, type NewsPayload } from "../../../services/newsService";
import styles from "./NewsFormDialog.module.css";

interface Props {
  open: boolean;
  initialValue?: NewsDetailDto | null;
  onClose: () => void;
  onSaved: () => void;
}

type FieldErrors = Partial<Record<keyof NewsPayload, string>>;

function toDateInputValue(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function NewsFormDialog({ open, initialValue, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [newsDate, setNewsDate] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setTitle(initialValue?.title ?? "");
    setSubtitle(initialValue?.subtitle ?? "");
    setBody(initialValue?.body ?? "");
    setNewsDate(toDateInputValue(initialValue?.newsDate));
    setCoverImageUrl(initialValue?.coverImageUrl ?? "");
    setFile(null);
    setErrors({});
  }, [open, initialValue]);

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    if (!selected) return;
    setUploading(true);
    try {
      const url = await newsService.uploadNewsImage(selected);
      setCoverImageUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = "El título es obligatorio.";
    if (!subtitle.trim()) nextErrors.subtitle = "El subtítulo es obligatorio.";
    if (!body.trim()) nextErrors.body = "El cuerpo es obligatorio.";
    if (!coverImageUrl.trim()) nextErrors.coverImageUrl = "La imagen de portada es obligatoria.";
    if (!newsDate.trim()) nextErrors.newsDate = "La fecha es obligatoria.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: NewsPayload = { title, subtitle, body, coverImageUrl, newsDate };
    setSaving(true);
    try {
      if (initialValue) {
        await newsService.updateNews(initialValue.id, payload);
      } else {
        await newsService.createNews({ ...payload, status: "Draft" });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialValue ? "Editar noticia" : "Nueva noticia"}</DialogTitle>
      <DialogContent className={styles.content}>
        <TextField
          id="news-title"
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={!!errors.title}
          helperText={errors.title}
          fullWidth
          margin="normal"
        />
        <TextField
          id="news-subtitle"
          label="Subtítulo"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          error={!!errors.subtitle}
          helperText={errors.subtitle}
          fullWidth
          margin="normal"
        />
        <TextField
          id="news-body"
          label="Cuerpo"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={!!errors.body}
          helperText={errors.body}
          fullWidth
          multiline
          minRows={4}
          margin="normal"
        />
        <TextField
          id="news-date"
          label="Fecha"
          type="date"
          value={newsDate}
          onChange={(e) => setNewsDate(e.target.value)}
          error={!!errors.newsDate}
          helperText={errors.newsDate}
          fullWidth
          margin="normal"
          InputLabelProps={{ shrink: true }}
        />
        <FileImagePicker
          id="news-cover-image"
          label="Imagen de portada"
          file={file}
          onChange={handleFileChange}
        />
        {uploading && <CircularProgress size={20} />}
        {errors.coverImageUrl && (
          <p className={styles.errorText}>{errors.coverImageUrl}</p>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || uploading}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
