import { useEffect, useState } from "react";
import { Autocomplete, Box, Button, Chip, IconButton, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import trainingService from "../../../../services/trainingService";
import type { Exercise, SessionBlockRequest } from "../../../../types/training";
import { TIPO_LABELS } from "../../exerciseTypeLabels";
import styles from "./SessionBlockEditor.module.css";

function useClubExercises(clubId?: string): Exercise[] {
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    if (!clubId) {
      setExercises([]);
      return;
    }
    let cancelled = false;

    trainingService
      .getExercises(clubId)
      .then((result) => {
        if (!cancelled) setExercises(result);
      })
      .catch(() => {
        if (!cancelled) setExercises([]);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return exercises;
}

/** renumbers block `order` 1..N contiguously, preserving array order — same pattern as
 * NivelesEditor.renumberNiveles. */
function renumberBlocks(blocks: SessionBlockRequest[]): SessionBlockRequest[] {
  return blocks.map((b, index) => ({ ...b, order: index + 1 }));
}

function moveBlock(blocks: SessionBlockRequest[], from: number, to: number): SessionBlockRequest[] {
  const reordered = [...blocks];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return renumberBlocks(reordered);
}

const blockDndId = (index: number) => `session-block-${index}`;
const blockIndexFromDndId = (id: string | number) => Number(String(id).replace("session-block-", ""));

interface ExerciseInfoCardProps {
  exerciseId: string;
  exercise?: Exercise;
  onRemove: () => void;
}

function ExerciseInfoCard({ exerciseId, exercise, onRemove }: ExerciseInfoCardProps) {
  const name = exercise?.name ?? exerciseId;
  const sections = exercise
    ? [
        { label: "Objetivo", text: exercise.objetivo },
        { label: "Descripción", text: exercise.descripcion },
        { label: "Logística", text: exercise.logistica },
      ].filter((s) => s.text?.trim())
    : [];

  return (
    <Box component="article" aria-label={name} className={styles.exerciseCard}>
      <Box className={styles.exerciseCardHeader}>
        <Typography className={styles.exerciseCardLabel}>{name}</Typography>
        <IconButton size="small" aria-label="Quitar ejercicio del bloque" onClick={onRemove}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>

      {exercise && (
        <Box className={styles.exerciseMeta}>
          <Chip size="small" label={TIPO_LABELS[exercise.tipo] ?? exercise.tipo} className={styles.exerciseChip} />
          {exercise.durationMinutes != null && (
            <Chip size="small" label={`${exercise.durationMinutes} min`} className={styles.exerciseChip} />
          )}
        </Box>
      )}

      {exercise?.urlImage && (
        <img src={exercise.urlImage} alt={`Dibujo de ${name}`} className={styles.exerciseImage} loading="lazy" />
      )}

      {sections.map((section) => (
        <Box key={section.label} className={styles.exerciseSection}>
          <Typography className={styles.exerciseSectionLabel}>{section.label}</Typography>
          <Typography className={styles.exerciseSectionText}>{section.text}</Typography>
        </Box>
      ))}
    </Box>
  );
}

interface DraggableBlockCardProps {
  index: number;
  isDragging: boolean;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}

function DraggableBlockCard({ index, isDragging, children }: DraggableBlockCardProps) {
  const id = blockDndId(index);
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });

  const className = [styles.blockCard, isDragging ? styles.blockCardDragging : "", isOver && !isDragging ? styles.blockCardOver : ""]
    .filter(Boolean)
    .join(" ");

  const dragHandle = (
    <IconButton
      ref={setDragRef}
      size="small"
      {...attributes}
      {...listeners}
      aria-label={`Arrastrar bloque ${index + 1}`}
      className={styles.dragHandle}
    >
      <DragIndicatorIcon fontSize="small" />
    </IconButton>
  );

  return (
    <Box ref={setDropRef} className={className}>
      {children(dragHandle)}
    </Box>
  );
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

export default function SessionBlockEditor({ blocks, onChange, clubId, onRequestInlineExercise }: SessionBlockEditorProps) {
  const exercises = useClubExercises(clubId);
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const updateBlock = (index: number, changes: Partial<SessionBlockRequest>) => {
    onChange(sortedBlocks.map((b, i) => (i === index ? { ...b, ...changes } : b)));
  };

  const addBlock = () => {
    const newBlock: SessionBlockRequest = {
      order: sortedBlocks.length + 1,
      nombre: `Bloque ${sortedBlocks.length + 1}`,
      rotacionEntreEjercicios: null,
      exercises: [],
    };
    onChange([...sortedBlocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    onChange(renumberBlocks(sortedBlocks.filter((_, i) => i !== index)));
  };

  const reorderBlock = (from: number, to: number) => {
    if (from === to || to < 0 || to >= sortedBlocks.length) return;
    onChange(moveBlock(sortedBlocks, from, to));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingIndex(blockIndexFromDndId(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingIndex(null);
    if (!event.over) return;
    reorderBlock(blockIndexFromDndId(event.active.id), blockIndexFromDndId(event.over.id));
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

  const draggingBlock = draggingIndex != null ? sortedBlocks[draggingIndex] : null;

  return (
    <Box className={styles.root}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingIndex(null)}
      >
        {sortedBlocks.map((block, blockIndex) => (
          <DraggableBlockCard key={blockIndex} index={blockIndex} isDragging={draggingIndex === blockIndex}>
            {(dragHandle) => (
              <>
                <Box className={styles.blockHeader}>
                  {dragHandle}
                  <TextField
                    label="Nombre del bloque"
                    value={block.nombre}
                    onChange={(e) => updateBlock(blockIndex, { nombre: e.target.value })}
                    size="small"
                    className={styles.blockNameField}
                  />
                  <Box className={styles.blockActions}>
                    <IconButton
                      size="small"
                      aria-label="Subir bloque"
                      disabled={blockIndex === 0}
                      onClick={() => reorderBlock(blockIndex, blockIndex - 1)}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Bajar bloque"
                      disabled={blockIndex === sortedBlocks.length - 1}
                      onClick={() => reorderBlock(blockIndex, blockIndex + 1)}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Eliminar bloque" onClick={() => removeBlock(blockIndex)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

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
                  {block.exercises.map((ex, exIndex) => (
                    <ExerciseInfoCard
                      key={exIndex}
                      exerciseId={ex.exerciseId}
                      exercise={exercises.find((e) => e.id === ex.exerciseId)}
                      onRemove={() => removeExercise(blockIndex, exIndex)}
                    />
                  ))}
                </Box>

                <Box className={styles.addExerciseRow}>
                  <Autocomplete<Exercise, false>
                    size="small"
                    options={exercises}
                    getOptionLabel={(o) => o.name}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    value={null}
                    onChange={(_, value) => value && addExistingExercise(blockIndex, value.id)}
                    renderInput={(params) => <TextField {...params} label="Añadir ejercicio existente" />}
                    className={styles.exercisePicker}
                  />
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => onRequestInlineExercise?.(blockIndex)}
                    className={styles.createInlineBtn}
                  >
                    Crear ejercicio nuevo
                  </Button>
                </Box>
              </>
            )}
          </DraggableBlockCard>
        ))}

        <DragOverlay>
          {draggingBlock ? (
            <Box className={styles.dragOverlay}>
              <DragIndicatorIcon fontSize="small" />
              <Typography className={styles.dragOverlayLabel}>{draggingBlock.nombre}</Typography>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Button size="small" startIcon={<AddIcon />} onClick={addBlock} className={styles.addBlockBtn}>
        Añadir bloque
      </Button>
    </Box>
  );
}
