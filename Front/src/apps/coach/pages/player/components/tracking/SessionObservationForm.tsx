import { useState } from "react";
import { Button } from "@mui/material";
import { format, parseISO } from "date-fns";
import {
  ATTITUDE_TRAITS,
  type CreatePlayerObservationRequest,
  type ObservationAssessment,
} from "../../../../services/playerTrackingService";
import type { TrainingSession } from "../../../../types/training";
import { useSessionDetail } from "../../hooks/useSessionDetail";
import { isAbsent, usePlayerSessionAttendance } from "../../hooks/usePlayerSessionAttendance";
import { groupTargetsBySubprincipio, targetLine } from "../../utils/sessionTargets";
import AttendanceNotice from "./AttendanceNotice";
import RatingBlock, { type RatingDraft } from "./RatingBlock";
import SessionContent from "./SessionContent";
import styles from "./SessionObservationForm.module.css";

type RequestBase = { date: string; assessment: ObservationAssessment; comment: string | null; trainingSessionId: string };

type ItemDraft = { habilidades?: string[] };

/** Un elemento valorable: su clave de borrador y cómo se convierte en request. */
type RatingItem = {
  key: string;
  toRequest: (base: RequestBase, draft: ItemDraft) => CreatePlayerObservationRequest;
};

const EMPTY_DRAFT: RatingDraft = { assessment: null, comment: "" };

const subprincipioKey = (id: string) => `sub:${id}`;
const attitudeKey = (key: string) => `att:${key}`;

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
  const [drafts, setDrafts] = useState<Record<string, RatingDraft>>({});

  const blocks = groupTargetsBySubprincipio(session.targets);
  const commentRequired = isAbsent(attendance);
  const date = (session.date ?? "").slice(0, 10);

  const items: RatingItem[] = [
    ...blocks.map((b) => ({
      key: subprincipioKey(b.subprincipioId),
      toRequest: (base: RequestBase, draft: ItemDraft) => ({
        kind: "GameModel" as const,
        ...base,
        subprincipioId: b.subprincipioId,
        habilidades: draft.habilidades ?? [],
      }),
    })),
    ...ATTITUDE_TRAITS.map((t) => ({
      key: attitudeKey(t.key),
      toRequest: (base: RequestBase) => ({
        kind: "Attitude" as const,
        attitudeKey: t.key,
        ...base,
      }),
    })),
  ];

  const draftOf = (key: string): RatingDraft => drafts[key] ?? EMPTY_DRAFT;
  const updateDraft = (key: string, change: Partial<RatingDraft>) =>
    setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? EMPTY_DRAFT), ...change } }));
  const missingComment = (key: string) => {
    const draft = draftOf(key);
    return commentRequired && !!draft.assessment && !draft.comment.trim();
  };

  const rated = items.filter((item) => !!draftOf(item.key).assessment);
  const canSave = rated.length > 0 && !rated.some((item) => missingComment(item.key)) && !saving;

  const handleSubmit = async () => {
    const requests = rated.map((item) => {
      const draft = draftOf(item.key);
      return item.toRequest(
        {
          date,
          assessment: draft.assessment as ObservationAssessment,
          comment: draft.comment.trim() || null,
          trainingSessionId: session.id,
        },
        draft,
      );
    });
    const failed = new Set(await onSubmit(requests));
    const savedKeys = rated.filter((_, index) => !failed.has(index)).map((item) => item.key);
    setDrafts((current) => {
      const next = { ...current };
      savedKeys.forEach((key) => delete next[key]);
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
        blocks.map((block) => {
          const key = subprincipioKey(block.subprincipioId);
          return (
            <RatingBlock
              key={key}
              title={block.titulo}
              draft={draftOf(key)}
              commentMissing={missingComment(key)}
              onChange={(change) => updateDraft(key, change)}
              withHabilidades
            >
              <span className={styles.context}>{block.context}</span>
              <span className={styles.subprincipio}>{block.titulo}</span>
              <ul className={styles.targets}>
                {block.targets.map((t) => (
                  <li key={t.subSubPrincipioId}>{targetLine(t)}</li>
                ))}
              </ul>
            </RatingBlock>
          );
        })
      )}

      <section className={styles.attitude} aria-label="Actitud">
        <h5 className={styles.sectionTitle}>Actitud</h5>
        {ATTITUDE_TRAITS.map((trait) => {
          const key = attitudeKey(trait.key);
          return (
            <RatingBlock
              key={key}
              title={trait.label}
              draft={draftOf(key)}
              commentMissing={missingComment(key)}
              onChange={(change) => updateDraft(key, change)}
            >
              <span className={styles.subprincipio}>{trait.label}</span>
            </RatingBlock>
          );
        })}
      </section>

      <div className={styles.actions}>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSave}>
          Guardar
        </Button>
      </div>
    </section>
  );
}
