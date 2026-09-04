import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";
import newsService, { type NewsDetailDto, type NewsPayload } from "../../../services/newsService";
import { useCoverImageUrl } from "../../../hooks/useCoverImageUrl";
import { getSportEvents, type SportEventResponse } from "../../../services/sportEventService";
import { useUserTeams } from "../../Dashboard/hooks/useUserTeams";
import { normalizeDateStr } from "../../convocations/helpers/convocationUtils";
import styles from "./NewsFormDialog.module.css";

const MATCH_CATEGORY_LABEL: Record<string, string> = {
  League: "Liga",
  Friendly: "Amistoso",
  Tournament: "Torneo",
};

function isMatchEvent(event: SportEventResponse): boolean {
  if (event.matchCategory) return true;
  return (event.eventTypeId ?? 0) === 1 || (event.eventType ?? "").toLowerCase().includes("partido");
}

function matchOptionLabel(event: SportEventResponse): string {
  const category = event.matchCategory ? MATCH_CATEGORY_LABEL[event.matchCategory] : null;
  const dateStr = normalizeDateStr(event.eveDateTime ?? event.start ?? null);
  const date = dateStr ? new Date(dateStr).toLocaleDateString("es-ES", { dateStyle: "medium" }) : null;
  const rival = event.rivalName ?? event.rival ?? null;
  return [category, date, rival ? `vs ${rival}` : null].filter(Boolean).join(" · ") || `Evento ${event.id}`;
}

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
  const [linkType, setLinkType] = useState<"None" | "MatchConvocation" | "External">("None");
  const [linkedTeamId, setLinkedTeamId] = useState<string | null>(null);
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const { teams } = useUserTeams();
  const [sportEvents, setSportEvents] = useState<SportEventResponse[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const existingCoverImageSrc = useCoverImageUrl(!file ? coverImageUrl : null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialValue?.title ?? "");
    setSubtitle(initialValue?.subtitle ?? "");
    setBody(initialValue?.body ?? "");
    setNewsDate(toDateInputValue(initialValue?.newsDate));
    setCoverImageUrl(initialValue?.coverImageUrl ?? "");
    setFile(null);
    setErrors({});
    setLinkType(initialValue?.linkType ?? "None");
    setLinkedTeamId(initialValue?.linkedTeamId ?? null);
    setLinkedEventId(initialValue?.linkedEventId ?? null);
    setLinkUrl(initialValue?.linkUrl ?? null);
    setSportEvents([]);
  }, [open, initialValue]);

  useEffect(() => {
    if (linkType === "MatchConvocation" && linkedTeamId) {
      setLoadingEvents(true);
      getSportEvents(linkedTeamId, 1, 200)
        .then((paged) => setSportEvents(paged.items.filter(isMatchEvent)))
        .finally(() => setLoadingEvents(false));
    }
  }, [linkType, linkedTeamId]);

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

    if (linkType === "MatchConvocation") {
      if (!linkedTeamId) nextErrors.linkedTeamId = "Selecciona un equipo.";
      if (!linkedEventId) nextErrors.linkedEventId = "Selecciona un partido.";
    } else if (linkType === "External") {
      if (!linkUrl?.trim()) {
        nextErrors.linkUrl = "La URL es obligatoria.";
      } else {
        try {
          const url = new URL(linkUrl);
          if (!["http:", "https:"].includes(url.protocol)) {
            nextErrors.linkUrl = "La URL debe ser http(s).";
          }
        } catch {
          nextErrors.linkUrl = "La URL no es válida.";
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: NewsPayload = {
      title,
      subtitle,
      body,
      coverImageUrl,
      newsDate,
      linkType,
      linkedEventId,
      linkedTeamId,
      linkUrl,
    };
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
        <div className={styles.coverImageSection}>
          {existingCoverImageSrc && !file && (
            <img
              src={existingCoverImageSrc}
              alt="Portada actual"
              className={styles.coverPreview}
            />
          )}
          <FileImagePicker
            id="news-cover-image"
            label={existingCoverImageSrc ? "Cambiar imagen de portada" : "Imagen de portada"}
            file={file}
            onChange={handleFileChange}
            previewWidth={144}
            previewHeight={81}
            previewFit="contain"
          />
        </div>
        {uploading && <CircularProgress size={20} />}
        {errors.coverImageUrl && (
          <p className={styles.errorText}>{errors.coverImageUrl}</p>
        )}

        <FormControl fullWidth margin="normal">
          <InputLabel id="link-type-label">Enlace</InputLabel>
          <Select
            labelId="link-type-label"
            id="link-type"
            value={linkType}
            label="Enlace"
            onChange={(e) => {
              setLinkType(e.target.value as "None" | "MatchConvocation" | "External");
              if (e.target.value === "None") {
                setLinkedTeamId(null);
                setLinkedEventId(null);
                setLinkUrl(null);
              }
            }}
          >
            <MenuItem value="None">Ninguno</MenuItem>
            <MenuItem value="MatchConvocation">Convocatoria de partido</MenuItem>
            <MenuItem value="External">Enlace externo</MenuItem>
          </Select>
        </FormControl>

        {linkType === "MatchConvocation" && (
          <>
            <FormControl fullWidth margin="normal" error={!!errors.linkedTeamId}>
              <InputLabel id="team-label">Equipo</InputLabel>
              <Select
                labelId="team-label"
                id="team"
                value={linkedTeamId || ""}
                label="Equipo"
                onChange={(e) => {
                  setLinkedTeamId(e.target.value || null);
                  setLinkedEventId(null);
                  setSportEvents([]);
                }}
              >
                <MenuItem value="">Selecciona un equipo</MenuItem>
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.linkedTeamId && <p className={styles.errorText}>{errors.linkedTeamId}</p>}
            </FormControl>

            <FormControl fullWidth margin="normal" error={!!errors.linkedEventId} disabled={!linkedTeamId || loadingEvents}>
              <InputLabel id="event-label">Partido</InputLabel>
              <Select
                labelId="event-label"
                id="event"
                value={linkedEventId || ""}
                label="Partido"
                onChange={(e) => setLinkedEventId(e.target.value || null)}
              >
                <MenuItem value="">Selecciona un partido</MenuItem>
                {sportEvents.map((event) => (
                  <MenuItem key={event.id} value={event.id}>
                    {matchOptionLabel(event)}
                  </MenuItem>
                ))}
              </Select>
              {errors.linkedEventId && <p className={styles.errorText}>{errors.linkedEventId}</p>}
            </FormControl>
          </>
        )}

        {linkType === "External" && (
          <TextField
            id="link-url"
            label="URL"
            value={linkUrl || ""}
            onChange={(e) => setLinkUrl(e.target.value || null)}
            error={!!errors.linkUrl}
            helperText={errors.linkUrl}
            fullWidth
            margin="normal"
            placeholder="https://..."
          />
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
