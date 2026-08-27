import { IconButton, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { ExerciseLevelRow } from "../../../../../types/training";
import styles from "./NivelesEditor.module.css";

const MIN_ROWS = 2;
const MAX_ROWS = 5;

/** Renumbers rows to 1..N contiguously, preserving order and each row's `valores`. Exported
 * for unit testing — the UI never lets the coach reorder or gap the `nivel` numbers, so this
 * is the single place that keeps the invariant after any add/remove. */
export function renumberNiveles(rows: ExerciseLevelRow[]): ExerciseLevelRow[] {
  return rows.map((row, index) => ({ nivel: index + 1, valores: row.valores }));
}

interface NivelesEditorProps {
  columnas: string[];
  niveles: ExerciseLevelRow[];
  onChange: (columnas: string[], niveles: ExerciseLevelRow[]) => void;
}

export default function NivelesEditor({ columnas, niveles, onChange }: NivelesEditorProps) {
  const sortedNiveles = [...niveles].sort((a, b) => a.nivel - b.nivel);

  const renameColumn = (index: number, newName: string) => {
    const oldName = columnas[index];
    const nextColumnas = columnas.map((c, i) => (i === index ? newName : c));
    const nextNiveles = sortedNiveles.map((row) => {
      if (!(oldName in row.valores)) return row;
      const { [oldName]: value, ...rest } = row.valores;
      return { ...row, valores: { ...rest, [newName]: value } };
    });
    onChange(nextColumnas, nextNiveles);
  };

  const addColumn = () => {
    const name = `Palanca ${columnas.length + 1}`;
    onChange([...columnas, name], sortedNiveles);
  };

  const removeColumn = (index: number) => {
    const name = columnas[index];
    const nextColumnas = columnas.filter((_, i) => i !== index);
    const nextNiveles = sortedNiveles.map((row) => {
      const { [name]: _removed, ...rest } = row.valores;
      return { ...row, valores: rest };
    });
    onChange(nextColumnas, nextNiveles);
  };

  const setCellValue = (rowIndex: number, columnName: string, value: string) => {
    const nextNiveles = sortedNiveles.map((row, i) =>
      i === rowIndex ? { ...row, valores: { ...row.valores, [columnName]: value } } : row
    );
    onChange(columnas, nextNiveles);
  };

  const addRow = () => {
    if (sortedNiveles.length >= MAX_ROWS) return;
    const newRow: ExerciseLevelRow = { nivel: sortedNiveles.length + 1, valores: {} };
    onChange(columnas, renumberNiveles([...sortedNiveles, newRow]));
  };

  const removeRow = (index: number) => {
    if (sortedNiveles.length <= MIN_ROWS) return;
    onChange(columnas, renumberNiveles(sortedNiveles.filter((_, i) => i !== index)));
  };

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <span className={styles.nivelHeaderCell}>Nivel</span>
        {columnas.map((col, index) => (
          <div key={index} className={styles.columnHeaderCell}>
            <TextField
              value={col}
              onChange={(e) => renameColumn(index, e.target.value)}
              size="small"
              variant="standard"
              className={styles.columnNameField}
            />
            <IconButton
              size="small"
              aria-label="Eliminar columna"
              onClick={() => removeColumn(index)}
              className={styles.removeColumnBtn}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
        <IconButton size="small" aria-label="Añadir columna" onClick={addColumn} className={styles.addColumnBtn}>
          <AddIcon fontSize="small" />
        </IconButton>
      </div>

      {sortedNiveles.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.dataRow}>
          <span className={styles.nivelCell}>{row.nivel}</span>
          {columnas.map((col) => (
            <TextField
              key={col}
              value={row.valores[col] ?? ""}
              onChange={(e) => setCellValue(rowIndex, col, e.target.value)}
              size="small"
              variant="standard"
              className={styles.cellField}
            />
          ))}
          <IconButton
            size="small"
            aria-label="Eliminar nivel"
            onClick={() => removeRow(rowIndex)}
            disabled={sortedNiveles.length <= MIN_ROWS}
            className={styles.removeRowBtn}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        disabled={sortedNiveles.length >= MAX_ROWS}
        className={styles.addRowBtn}
      >
        + Nivel
      </button>
    </div>
  );
}
