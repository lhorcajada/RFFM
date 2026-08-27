import { useEffect, useState } from "react";
import { Autocomplete, Box, Button, IconButton, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useNavigate } from "react-router-dom";
import trainingService from "../../../../services/trainingService";
import type { SessionBlockRequest } from "../../../../types/training";
import styles from "./SessionBlockEditor.module.css";

interface ExerciseOption {
  id: string;
  label: string;
}

function useExerciseOptions(clubId?: string): ExerciseOption[] {
  const [options, setOptions] = useState<ExerciseOption[]>([]);

  useEffect(() => {
    if (!clubId) {
      setOptions([]);
      return;
    }
    let cancelled = false;

    trainingService
      .getExercises(clubId)
      .then((exercises) => {
        if (!cancelled) setOptions(exercises.map((e) => ({ id: e.id, label: e.name })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return options;
}

/** renumbers block `order` 1..N contiguously, preserving array order — same pattern as
 * NivelesEditor.renumberNiveles. */
function renumberBlocks(blocks: SessionBlockRequest[]): SessionBlockRequest[] {
  return blocks.map((b, index) => ({ ...b, order: index + 1 }));
}

interface SessionBlockEditorProps {
  blocks: SessionBlockRequest[];
  onChange: (blocks: SessionBlockRequest[]) => void;
  clubId?: string;
  /** Key used to persist the in-progress session draft to sessionStorage before navigating
   * away to create a new exercise inline (design.md Frontend §6.1). Optional — omit to
   * disable the inline-create flow (e.g. in isolated tests). */
  sessionDraftKey?: string;
  onRequestInlineExercise?: (blockIndex: number) => void;
}

export default function SessionBlockEditor({
  blocks,
  onChange,
  clubId,
  onRequestInlineExercise,
}: SessionBlockEditorProps) {
  const navigate = useNavigate();
  const exerciseOptions = useExerciseOptions(clubId);
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);

  const updateBlock = (index: number, changes: Partial<SessionBlockRequest>) => {
    onChange(sortedBlocks.map((b, i) => (i === index ? { ...b, ...changes } : b)));
  };

  const addBlock = () => {
    const newBlock: SessionBlockRequest = {
      order: sortedBlocks.length + 1,
      nombre: `Bloque ${sortedBlocks.length + 1}`,
      comoConectaConAnterior: "",
      rotacionEntreEjercicios: null,
      exercises: [],
    };
    onChange([...sortedBlocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    onChange(renumberBlocks(sortedBlocks.filter((_, i) => i !== index)));
  };

  const addExistingExercise = (blockIndex: number, exerciseId: string) => {
    const block = sortedBlocks[blockIndex];
    const nextPosition = block.exercises.length + 1;
    updateBlock(blockIndex, { exercises: [...block.exercises, { exerciseId, position: nextPosition }] });
  };

  const removeExercise = (blockIndex: number, exerciseIndex: number) => {
    const block = sortedBlocks[blockIndex];
    updateBlock(blockIndex, { exercises: block.exercises.filter((_, i) => i !== exerciseIndex) });
  };

  const handleCreateInline = (blockIndex: number) => {
    if (onRequestInlineExercise) {
      onRequestInlineExercise(blockIndex);
      return;
    }
    void navigate; // no-op fallback when the parent doesn't wire the inline-create flow
  };

  return (
    <Box className={styles.root}>
      {sortedBlocks.map((block, blockIndex) => (
        <Box key={blockIndex} className={styles.blockCard}>
          <Box className={styles.blockHeader}>
            <TextField
              label="Nombre del bloque"
              value={block.nombre}
              onChange={(e) => updateBlock(blockIndex, { nombre: e.target.value })}
              size="small"
              className={styles.blockNameField}
            />
            <IconButton size="small" aria-label="Eliminar bloque" onClick={() => removeBlock(blockIndex)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>

          <TextField
            label="Cómo conecta con el anterior"
            value={block.comoConectaConAnterior}
            onChange={(e) => updateBlock(blockIndex, { comoConectaConAnterior: e.target.value })}
            fullWidth
            multiline
            minRows={1}
            size="small"
            className={styles.field}
          />

          {block.exercises.length >= 2 && (
            <TextField
              label="Rotación entre ejercicios"
              value={block.rotacionEntreEjercicios ?? ""}
              onChange={(e) => updateBlock(blockIndex, { rotacionEntreEjercicios: e.target.value || null })}
              fullWidth
              multiline
              minRows={1}
              size="small"
              className={styles.field}
            />
          )}

          <Box className={styles.exercisesRow}>
            {block.exercises.map((ex, exIndex) => {
              const label = exerciseOptions.find((o) => o.id === ex.exerciseId)?.label ?? ex.exerciseId;
              return (
                <Box key={exIndex} className={styles.exerciseCard}>
                  <Typography className={styles.exerciseCardLabel}>{label}</Typography>
                  <IconButton
                    size="small"
                    aria-label="Quitar ejercicio del bloque"
                    onClick={() => removeExercise(blockIndex, exIndex)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Box>

          <Box className={styles.addExerciseRow}>
            <Autocomplete<ExerciseOption, false>
              size="small"
              options={exerciseOptions}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={null}
              onChange={(_, value) => value && addExistingExercise(blockIndex, value.id)}
              renderInput={(params) => <TextField {...params} label="Añadir ejercicio existente" />}
              className={styles.exercisePicker}
            />
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleCreateInline(blockIndex)}
              className={styles.createInlineBtn}
            >
              Crear ejercicio nuevo
            </Button>
          </Box>
        </Box>
      ))}

      <Button size="small" startIcon={<AddIcon />} onClick={addBlock} className={styles.addBlockBtn}>
        Añadir bloque
      </Button>
    </Box>
  );
}
