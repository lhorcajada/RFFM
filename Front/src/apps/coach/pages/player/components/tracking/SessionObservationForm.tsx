import { useState } from "react";
import { Alert, Button, TextField } from "@mui/material";
import { format, parseISO } from "date-fns";
import type { CreatePlayerObservationRequest, ObservationAssessment } from "../../../../services/playerTrackingService";
import type { SessionTargetDetail, TrainingSession } from "../../../../types/training";
import { useSessionDetail } from "../../hooks/useSessionDetail";
import {
  isAbsent,
  usePlayerSessionAttendance,
  type SessionAttendance,
} from "../../hooks/usePlayerSessionAttendance";
import AssessmentButtons from "./AssessmentButtons";
import SessionContent from "./SessionContent";
import styles from "./SessionObservationForm.module.css";

const COMMENT_MAX_LENGTH = 500;
const ABSENT_COMMENT_REQUIRED = "Indica por qué: no asistió al entrenamiento";

type SubprincipioBlock = {
  subprincipioId: string;
  titulo: string;
  context: string;
  targets: SessionTargetDetail[];
};

type Draft = { assessment: ObservationAssessment | null; comment: string };

const EMPTY_DRAFT: Draft = { assessment: null, comment: "" };

function groupBySubprincipio(targets: SessionTargetDetail[]): SubprincipioBlock[] {
  const blocks = new Map<string, SubprincipioBlock>();
  for (const t of targets) {
    const block = blocks.get(t.subprincipioId) ?? {
      subprincipioId: t.subprincipioId,
      titulo: t.subprincipioTitulo,
      context: `${t.gameMomentName} · ${t.principioTitulo}`,
      targets: [],
    };
    block.targets.push(t);
    blocks.set(t.subprincipioId, block);
  }
  return [...blocks.values()];
}

function targetLine(t: SessionTargetDetail): string {
  const base = `${t.numero} ${t.rol}`;
  return t.zonaLabel ? `${base} · ${t.zonaLabel}` : base;
}

function AttendanceNotice({ attendance }: { attendance: SessionAttendance }) {
  switch (attendance) {
    case "absent-excused":
    case "absent-unexcused":
      return (
        <Alert severity="warning">
          El jugador no asistió a este entrenamiento ({attendance === "absent-excused" ? "con excusa" : "sin excusa"}).
          Si valoras algún subprincipio, explica en el comentario por qué.
        </Alert>
      );
    case "late":
      return <Alert severity="info">El jugador llegó tarde a este entrenamiento.</Alert>;
    case "unknown":
      return <Alert severity="info">No hay asistencia registrada para este jugador en esta sesión.</Alert>;
    case "no-event":
      return (
        <Alert severity="info">
          La sesión no está vinculada a un evento del calendario; no se puede comprobar la asistencia.
        </Alert>
      );
    default:
      return null;
  }
}

type Props = {
  session: TrainingSession;
  teamPlayerId: string;
  saving: boolean;
  /** Crea las observaciones y devuelve los índices de las requests que fallaron. */
  onSubmit: (requests: CreatePlayerObservationRequest[]) => Promise<number[]>;
};

export default function SessionObservationForm({ session, teamPlayerId, saving, onSubmit }: Props) {
  const { detail, loading: loadingDetail } = useSessionDetail(session.id);
  const { attendance } = usePlayerSessionAttendance(session.sportEventId, teamPlayerId);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const blocks = groupBySubprincipio(session.targets);
  const commentRequired = isAbsent(attendance);
  const date = (session.date ?? "").slice(0, 10);

  const draftOf = (id: string): Draft => drafts[id] ?? EMPTY_DRAFT;
  const updateDraft = (id: string, change: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? EMPTY_DRAFT), ...change } }));
  const missingComment = (id: string) => {
    const draft = draftOf(id);
    return commentRequired && !!draft.assessment && !draft.comment.trim();
  };

  const rated = blocks.filter((b) => !!draftOf(b.subprincipioId).assessment);
  const canSave = rated.length > 0 && !rated.some((b) => missingComment(b.subprincipioId)) && !saving;

  const handleSubmit = async () => {
    const requests = rated.map((b) => {
      const draft = draftOf(b.subprincipioId);
      return {
        date,
        subprincipioId: b.subprincipioId,
        assessment: draft.assessment as ObservationAssessment,
        comment: draft.comment.trim() || null,
        trainingSessionId: session.id,
      };
    });
    const failed = new Set(await onSubmit(requests));
    const savedIds = rated.filter((_, index) => !failed.has(index)).map((b) => b.subprincipioId);
    setDrafts((current) => {
      const next = { ...current };
      savedIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  return (
    <section className={styles.form} aria-label="Valorar la sesión">
      <h4 className={styles.title}>{`${format(parseISO(date), "dd/MM/yyyy")} · ${session.name}`}</h4>

      <AttendanceNotice attendance={attendance} />

      <SessionContent detail={detail} loading={loadingDetail} />

      {blocks.length === 0 ? (
        <p className={styles.empty}>
          Esta sesión no tiene subprincipios del modelo de juego asociados. Asócialos en la sesión o registra la
          observación sin sesión.
        </p>
      ) : (
        <>
          {blocks.map((block) => {
            const draft = draftOf(block.subprincipioId);
            const commentMissing = missingComment(block.subprincipioId);
            return (
              <fieldset key={block.subprincipioId} className={styles.block} aria-label={block.titulo}>
                <span className={styles.context}>{block.context}</span>
                <span className={styles.subprincipio}>{block.titulo}</span>
                <ul className={styles.targets}>
                  {block.targets.map((t) => (
                    <li key={t.subSubPrincipioId}>{targetLine(t)}</li>
                  ))}
                </ul>
                <AssessmentButtons
                  value={draft.assessment}
                  onChange={(assessment) => updateDraft(block.subprincipioId, { assessment })}
                  ariaLabel={`Valoración de ${block.titulo}`}
                />
                <TextField
                  label={`Comentario sobre ${block.titulo}`}
                  multiline
                  minRows={1}
                  size="small"
                  value={draft.comment}
                  onChange={(e) => updateDraft(block.subprincipioId, { comment: e.target.value })}
                  inputProps={{ maxLength: COMMENT_MAX_LENGTH }}
                  error={commentMissing}
                  helperText={commentMissing ? ABSENT_COMMENT_REQUIRED : undefined}
                  fullWidth
                />
              </fieldset>
            );
          })}
          <div className={styles.actions}>
            <Button variant="contained" onClick={handleSubmit} disabled={!canSave}>
              Guardar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
