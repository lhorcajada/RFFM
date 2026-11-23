import { IconButton, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import styles from "./LinesEditor.module.css";

/** Same cap as the backend validator (`ExerciseSheetLimits.MaxLines`). */
export const MAX_SHEET_LINES = 30;

interface LinesEditorProps {
  label: string;
  lines: string[];
  onChange: (lines: string[]) => void;
  /** Numbers the lines 1..N, for ordered content such as the sequence. */
  numbered?: boolean;
  hint?: string;
  placeholder?: string;
}

/** Editor of a list of text lines (sequence, rules, what is seen, objectives): one stacked field per
 * line with its own remove button, and a button to add another. */
export default function LinesEditor({ label, lines, onChange, numbered = false, hint, placeholder }: LinesEditorProps) {
  const setLine = (index: number, value: string) => onChange(lines.map((line, i) => (i === index ? value : line)));
  const removeLine = (index: number) => onChange(lines.filter((_, i) => i !== index));
  const addLine = () => onChange([...lines, ""]);

  return (
    <div className={styles.root} role="group" aria-label={label}>
      <Typography className={styles.title}>{label}</Typography>
      {hint && <Typography className={styles.hint}>{hint}</Typography>}
      {lines.map((line, index) => (
        <div key={index} className={styles.line}>
          {numbered && <span className={styles.lineNumber}>{index + 1}.</span>}
          <TextField
            value={line}
            onChange={(e) => setLine(index, e.target.value)}
            size="small"
            multiline
            minRows={1}
            placeholder={placeholder}
            className={styles.lineField}
            inputProps={{ "aria-label": `${label} ${index + 1}` }}
          />
          <IconButton
            size="small"
            aria-label={`Eliminar ${label.toLowerCase()} ${index + 1}`}
            onClick={() => removeLine(index)}
            className={styles.removeBtn}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </div>
      ))}
      <button type="button" onClick={addLine} disabled={lines.length >= MAX_SHEET_LINES} className={styles.addBtn}>
        + Añadir línea
      </button>
    </div>
  );
}
