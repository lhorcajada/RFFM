import { useState } from "react";
import { Button, Chip, CircularProgress } from "@mui/material";
import { format, parseISO } from "date-fns";
import type {
  ObservationAssessment,
  PlayerSessionListItem,
  SaveSessionEvaluationItem,
  SessionEvaluation,
} from "../../../../services/playerTrackingService";
import type { Exercise, TrainingSessionDetail } from "../../../../types/training";
import { attendanceFromAssistanceType, isAbsent } from "../../utils/sessionAttendance";
import { habilidadesBySubprincipio } from "../../utils/sessionHabilidades";
import { groupTargetsBySubprincipio, targetLine } from "../../utils/sessionTargets";
import AttendanceNotice from "./AttendanceNotice";
import RatingBlock, { type RatingDraft } from "./RatingBlock";
import SessionContent from "./SessionContent";
import styles from "./SessionEvaluationForm.module.css";

const EMPTY_DRAFT: RatingDraft = { assessment: null, comment: "" };

function initialDrafts(initial: SessionEvaluation | null): Record<string, RatingDraft> {
  const drafts: Record<string, RatingDraft> = {};
  for (const item of initial?.subprincipios ?? []) {
    if (item.subprincipioId) drafts[item.subprincipioId] = { assessment: item.assessment, comment: item.comment ?? "" };
  }
  return drafts;
}

type Props = {
  session: PlayerSessionListItem;
  detail: TrainingSessionDetail | null;
  loadingDetail: boolean;
  exercisesById: Map<string, Exercise>;
  teamId: string;
  initial: SessionEvaluation | null;
  saving: boolean;
  onSubmit: (items: SaveSessionEvaluationItem[]) => Promise<void>;
};

/** Valoración de un jugador en una sesión: un bloque por subprincipio trabajado en ella. */
export default function SessionEvaluationForm({
  session,
  detail,
  loadingDetail,
  exercisesById,
  teamId,
  initial,
  saving,
  onSubmit,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, RatingDraft>>(() => initialDrafts(initial));

  const attendance = attendanceFromAssistanceType(session.hasCalendarEvent, session.assistanceTypeId);
  const commentRequired = isAbsent(attendance);
  const blocks = groupTargetsBySubprincipio(detail?.targets ?? []);
  const habilidades = habilidadesBySubprincipio([...exercisesById.values()]);

  const draftOf = (id: string): RatingDraft => drafts[id] ?? EMPTY_DRAFT;
  const updateDraft = (id: string, change: Partial<RatingDraft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? EMPTY_DRAFT), ...change } }));
  const missingComment = (id: string) => commentRequired && !!draftOf(id).assessment && !draftOf(id).comment.trim();

  const rated = blocks.filter((b) => !!draftOf(b.subprincipioId).assessment);
  const canSave = rated.length > 0 && !rated.some((b) => missingComment(b.subprincipioId)) && !saving;

  const handleSubmit = async () => {
    const items = rated.map((b) => {
      const draft = draftOf(b.subprincipioId);
      return {
        subprincipioId: b.subprincipioId,
        assessment: draft.assessment as ObservationAssessment,
        comment: draft.comment.trim() || null,
      };
    });
    try {
      await onSubmit(items);
    } catch {
      // El aviso lo muestra quien guarda; se conserva lo escrito para reintentar.
    }
  };

  return (
    <section className={styles.form} aria-label="Valorar la sesión">
      <h4 className={styles.title}>{`${format(parseISO(session.date), "dd/MM/yyyy")} · ${session.name}`}</h4>

      <AttendanceNotice attendance={attendance} />

      {loadingDetail || !detail ? (
        <div className={styles.state}>
          <CircularProgress size={24} />
        </div>
      ) : (
        <>
          <SessionContent detail={detail} loading={false} exercisesById={exercisesById} teamId={teamId} />

          {blocks.length === 0 ? (
            <p className={styles.empty}>
              Esta sesión no tiene subprincipios del modelo de juego asociados. Asócialos en la sesión para poder
              valorarla.
            </p>
          ) : (
            <>
              {blocks.map((block) => (
                <RatingBlock
                  key={block.subprincipioId}
                  title={block.titulo}
                  draft={draftOf(block.subprincipioId)}
                  commentMissing={missingComment(block.subprincipioId)}
                  onChange={(change) => updateDraft(block.subprincipioId, change)}
                >
                  <span className={styles.context}>{block.context}</span>
                  <span className={styles.subprincipio}>{block.titulo}</span>
                  <ul className={styles.targets}>
                    {block.targets.map((t) => (
                      <li key={t.subSubPrincipioId}>
                        <span className={styles.targetLine}>{targetLine(t)}</span>
                        {t.texto && <span className={styles.targetText}>{t.texto}</span>}
                      </li>
                    ))}
                  </ul>
                  {(habilidades.get(block.subprincipioId) ?? []).length > 0 && (
                    <div className={styles.habilidades}>
                      <span className={styles.habilidadesTitle}>Habilidades trabajadas</span>
                      <ul className={styles.habilidadesList} aria-label="Habilidades trabajadas">
                        {habilidades.get(block.subprincipioId)!.map((h) => (
                          <li key={h}>
                            <Chip size="small" color="success" variant="outlined" label={h} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </RatingBlock>
              ))}
              <div className={styles.actions}>
                <Button variant="contained" onClick={handleSubmit} disabled={!canSave}>
                  Guardar
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
