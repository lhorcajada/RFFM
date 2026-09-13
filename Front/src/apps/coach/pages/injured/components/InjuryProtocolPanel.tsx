import { useEffect, useState } from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import TitleIcon from "@mui/icons-material/Title";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import {
  getInjuryProtocol,
  updateInjuryProtocol,
  deleteInjuryProtocol,
} from "../../../services/injuryProtocolService";
import styles from "./InjuryProtocolPanel.module.css";

type Props = {
  teamId: string;
  isCoach: boolean;
};

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(
    new CustomEvent("rffm.show_snackbar", { detail: { message, severity } })
  );
}

export default function InjuryProtocolPanel({ teamId, isCoach }: Props) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editable: isCoach,
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isCoach);
  }, [editor, isCoach]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getInjuryProtocol(teamId)
      .then((res) => {
        if (!mounted) return;
        setContent(res?.content ?? null);
        setUpdatedAt(res?.updatedAt ?? null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  useEffect(() => {
    if (!editor || loading) return;
    editor.commands.setContent(content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, loading, teamId]);

  async function handleSave() {
    if (!editor) return;
    const html = editor.getHTML();
    setSaving(true);
    try {
      const result = await updateInjuryProtocol(teamId, html);
      setContent(result.content);
      setUpdatedAt(result.updatedAt);
      notify("Protocolo guardado correctamente", "success");
    } catch {
      notify("No se ha podido guardar el protocolo", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      await deleteInjuryProtocol(teamId);
      setContent(null);
      setUpdatedAt(null);
      editor?.commands.setContent("");
      notify("Protocolo eliminado", "success");
    } catch {
      notify("No se ha podido eliminar el protocolo", "error");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  if (!isCoach && !content) {
    return (
      <EmptyState
        title="No hay ningún protocolo publicado"
        description="El entrenador todavía no ha publicado el protocolo de lesiones de este equipo."
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      {isCoach && (
        <div className={styles.toolbar}>
          <div className={styles.formatButtons}>
            <Button
              size="small"
              variant={editor?.isActive("bold") ? "contained" : "outlined"}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              aria-label="Negrita"
            >
              <FormatBoldIcon fontSize="small" />
            </Button>
            <Button
              size="small"
              variant={editor?.isActive("italic") ? "contained" : "outlined"}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              aria-label="Cursiva"
            >
              <FormatItalicIcon fontSize="small" />
            </Button>
            <Button
              size="small"
              variant={editor?.isActive("heading", { level: 2 }) ? "contained" : "outlined"}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-label="Título"
            >
              <TitleIcon fontSize="small" />
            </Button>
            <Button
              size="small"
              variant={editor?.isActive("bulletList") ? "contained" : "outlined"}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              aria-label="Lista"
            >
              <FormatListBulletedIcon fontSize="small" />
            </Button>
            <Button
              size="small"
              variant={editor?.isActive("orderedList") ? "contained" : "outlined"}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              aria-label="Lista numerada"
            >
              <FormatListNumberedIcon fontSize="small" />
            </Button>
          </div>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
              variant="outlined"
              color="error"
              size="small"
              disabled={!content}
            >
              Eliminar protocolo
            </Button>
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSave}
              variant="contained"
              size="small"
              disabled={saving}
            >
              Guardar
            </Button>
          </Stack>
        </div>
      )}

      <div className={isCoach ? styles.editorCard : styles.readonlyCard}>
        <EditorContent editor={editor} className={styles.editorContent} />
      </div>

      {updatedAt && (
        <Typography variant="caption" color="text.secondary" className={styles.updatedAt}>
          Última actualización: {new Date(updatedAt).toLocaleString("es-ES")}
        </Typography>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar protocolo"
        description="¿Seguro que quieres eliminar el contenido del protocolo? Los documentos adjuntos no se eliminarán."
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
