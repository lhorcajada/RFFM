import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
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

  const hasContent = !!content;
  const formatButtons: { label: string; active: boolean; run: () => void; icon: ReactNode }[] = [
    {
      label: "Negrita",
      active: !!editor?.isActive("bold"),
      run: () => editor?.chain().focus().toggleBold().run(),
      icon: <FormatBoldIcon fontSize="small" />,
    },
    {
      label: "Cursiva",
      active: !!editor?.isActive("italic"),
      run: () => editor?.chain().focus().toggleItalic().run(),
      icon: <FormatItalicIcon fontSize="small" />,
    },
    {
      label: "Título",
      active: !!editor?.isActive("heading", { level: 2 }),
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      icon: <TitleIcon fontSize="small" />,
    },
    {
      label: "Lista",
      active: !!editor?.isActive("bulletList"),
      run: () => editor?.chain().focus().toggleBulletList().run(),
      icon: <FormatListBulletedIcon fontSize="small" />,
    },
    {
      label: "Lista numerada",
      active: !!editor?.isActive("orderedList"),
      run: () => editor?.chain().focus().toggleOrderedList().run(),
      icon: <FormatListNumberedIcon fontSize="small" />,
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleRow}>
        <Typography component="h2" className={styles.title}>
          Protocolo de lesiones
        </Typography>
        {hasContent && <Chip label="Publicado" size="small" className={styles.publishedChip} />}
      </div>

      {isCoach && (
        <div className={styles.formatButtons}>
          {formatButtons.map((b) => (
            <Button
              key={b.label}
              variant={b.active ? "contained" : "outlined"}
              onClick={b.run}
              aria-label={b.label}
              className={styles.formatButton}
            >
              {b.icon}
            </Button>
          ))}
        </div>
      )}

      <div className={styles.editorArea}>
        <EditorContent editor={editor} className={styles.editorContent} />
      </div>

      {updatedAt && (
        <Typography variant="caption" className={styles.updatedAt}>
          Última actualización: {new Date(updatedAt).toLocaleString("es-ES")}
        </Typography>
      )}

      {isCoach && (
        <div className={styles.actions}>
          <Button
            onClick={() => setDeleteOpen(true)}
            variant="outlined"
            color="error"
            disabled={!content}
            aria-label="Eliminar protocolo"
            className={styles.deleteButton}
          >
            Eliminar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            className={styles.saveButton}
          >
            Guardar protocolo
          </Button>
        </div>
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
