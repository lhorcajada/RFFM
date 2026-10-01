import type { ReactNode } from "react";
import { TextField } from "@mui/material";
import type { ObservationAssessment } from "../../../../services/playerTrackingService";
import AssessmentButtons from "./AssessmentButtons";
import HabilidadesPicker from "./HabilidadesPicker";
import styles from "./RatingBlock.module.css";

const COMMENT_MAX_LENGTH = 500;
const ABSENT_COMMENT_REQUIRED = "Indica por qué: no asistió al entrenamiento";

export type RatingDraft = { assessment: ObservationAssessment | null; comment: string; habilidades?: string[] };

type Props = {
  title: string;
  draft: RatingDraft;
  commentMissing: boolean;
  onChange: (change: Partial<RatingDraft>) => void;
  withHabilidades?: boolean;
  children?: ReactNode;
};

/** Un elemento valorable del formulario de sesión (subprincipio o rasgo de actitud): valoración, habilidades si aplica y comentario. */
export default function RatingBlock({ title, draft, commentMissing, onChange, withHabilidades = false, children }: Props) {
  return (
    <fieldset className={styles.block} aria-label={title}>
      {children}
      <AssessmentButtons
        value={draft.assessment}
        onChange={(assessment) => onChange({ assessment })}
        ariaLabel={`Valoración de ${title}`}
      />
      {withHabilidades && (
        <HabilidadesPicker value={draft.habilidades ?? []} onChange={(habilidades) => onChange({ habilidades })} />
      )}
      <TextField
        label={`Comentario sobre ${title}`}
        multiline
        minRows={1}
        size="small"
        value={draft.comment}
        onChange={(e) => onChange({ comment: e.target.value })}
        inputProps={{ maxLength: COMMENT_MAX_LENGTH }}
        error={commentMissing}
        helperText={commentMissing ? ABSENT_COMMENT_REQUIRED : undefined}
        fullWidth
      />
    </fieldset>
  );
}
