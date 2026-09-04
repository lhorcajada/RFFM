import { useEffect, useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import {
  createTeamNote,
  deleteTeamNote,
  getTeamNotes,
  updateTeamNote,
} from "../../../services/teamNoteService";
import type { TeamNote } from "../../../services/teamNoteService";
import { coachAuthService } from "../../../services/authService";
import styles from "./TeamNotesEditor.module.css";

type Props = {
  teamId: string;
};

export default function TeamNotesEditor({ teamId }: Props) {
  const canEdit = coachAuthService.hasRole("Coach");

  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    setLoading(true);
    getTeamNotes(teamId)
      .then((data) => {
        if (mounted) setNotes(data);
      })
      .catch(() => {
        if (mounted) setError("Error al cargar las notas del equipo.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text || adding) return;
    setAdding(true);
    setError(null);
    try {
      const created = await createTeamNote(teamId, text);
      setNotes((prev) => [...prev, created]);
      setNewText("");
    } catch {
      setError("Error al añadir la nota. Inténtalo de nuevo.");
    } finally {
      setAdding(false);
    }
  };

  const startEditing = (note: TeamNote) => {
    setEditingId(note.id);
    setEditingText(note.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleSaveEdit = async () => {
    const text = editingText.trim();
    if (!editingId || !text || savingEdit) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await updateTeamNote(teamId, editingId, text);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      cancelEditing();
    } catch {
      setError("Error al guardar la nota. Inténtalo de nuevo.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    setError(null);
    try {
      await deleteTeamNote(teamId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      setError("Error al eliminar la nota. Inténtalo de nuevo.");
    }
  };

  return (
    <div className={styles.root}>
      {loading ? (
        <span className={styles.emptyText}>Cargando notas…</span>
      ) : notes.length === 0 ? (
        <span className={styles.emptyText}>Sin notas configuradas</span>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => (
            <li key={note.id} className={styles.noteRow}>
              {editingId === note.id ? (
                <div className={styles.editRow}>
                  <input
                    className={styles.editInput}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    maxLength={500}
                  />
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                  >
                    Guardar
                  </button>
                  <button type="button" className={styles.smallBtnGhost} onClick={cancelEditing}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <span className={styles.noteText}>{note.text}</span>
                  {canEdit && (
                    <div className={styles.noteActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="Editar nota"
                        onClick={() => startEditing(note)}
                      >
                        <EditIcon fontSize="small" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="Eliminar nota"
                        onClick={() => handleDelete(note.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {canEdit && (
        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            placeholder="Nueva nota…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            maxLength={500}
          />
          <button
            type="button"
            className={styles.smallBtn}
            onClick={handleAdd}
            disabled={adding || !newText.trim()}
          >
            Añadir
          </button>
        </div>
      )}
    </div>
  );
}
