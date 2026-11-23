import { IconButton, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { ExerciseTeam, ExerciseTeamColor } from "../../../../types/training";
import { teamColorOptions } from "../constants";
import LinesEditor from "./LinesEditor";
import styles from "./TeamsEditor.module.css";

/** Same cap as the backend validator (`ExerciseSheetLimits.MaxTeams`). */
export const MAX_SHEET_TEAMS = 6;

interface TeamsEditorProps {
  teams: ExerciseTeam[];
  onChange: (teams: ExerciseTeam[]) => void;
}

const emptyTeam = (): ExerciseTeam => ({ color: null, nombre: "", cantidad: null, roles: null, objetivos: [] });

/** Editor of the teams of the sheet ("Jugadores"): one stacked card per team with its palette color,
 * name, number of players, roles and objective lines. */
export default function TeamsEditor({ teams, onChange }: TeamsEditorProps) {
  const updateTeam = (index: number, patch: Partial<ExerciseTeam>) =>
    onChange(teams.map((team, i) => (i === index ? { ...team, ...patch } : team)));
  const removeTeam = (index: number) => onChange(teams.filter((_, i) => i !== index));

  const toggleColor = (index: number, color: ExerciseTeamColor) =>
    updateTeam(index, { color: teams[index].color === color ? null : color });

  return (
    <div className={styles.root} role="group" aria-label="Jugadores y objetivos por equipo">
      <Typography className={styles.hint}>
        Cada equipo aporta su fila en «Jugadores» y sus líneas en «Objetivos» de la ficha.
      </Typography>

      {teams.map((team, index) => (
        <div key={index} className={styles.team}>
          <div className={styles.teamHeader}>
            <Typography className={styles.teamTitle}>Equipo {index + 1}</Typography>
            <IconButton
              size="small"
              aria-label={`Eliminar equipo ${index + 1}`}
              onClick={() => removeTeam(index)}
              className={styles.removeBtn}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </div>

          <div className={styles.colors} role="group" aria-label={`Color del equipo ${index + 1}`}>
            {teamColorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={team.color === option.value}
                className={`${styles.colorBtn} ${team.color === option.value ? styles.colorBtnActive : ""}`}
                onClick={() => toggleColor(index, option.value)}
              >
                <span className={`${styles.swatch} ${styles[`swatch_${option.value}`]}`} />
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.twoCols}>
            <TextField
              label="Nombre"
              value={team.nombre}
              onChange={(e) => updateTeam(index, { nombre: e.target.value })}
              size="small"
              className={styles.field}
              inputProps={{ "aria-label": `Nombre del equipo ${index + 1}` }}
            />
            <TextField
              label="Jugadores"
              type="number"
              value={team.cantidad ?? ""}
              onChange={(e) => updateTeam(index, { cantidad: e.target.value === "" ? null : Number(e.target.value) })}
              size="small"
              className={styles.field}
              inputProps={{ min: 0, "aria-label": `Número de jugadores del equipo ${index + 1}` }}
            />
          </div>

          <TextField
            label="Roles"
            value={team.roles ?? ""}
            onChange={(e) => updateTeam(index, { roles: e.target.value === "" ? null : e.target.value })}
            size="small"
            multiline
            className={styles.field}
            inputProps={{ "aria-label": `Roles del equipo ${index + 1}` }}
          />

          <LinesEditor
            label={`Objetivos del equipo ${index + 1}`}
            lines={team.objetivos}
            onChange={(objetivos) => updateTeam(index, { objetivos })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...teams, emptyTeam()])}
        disabled={teams.length >= MAX_SHEET_TEAMS}
        className={styles.addBtn}
      >
        + Añadir equipo
      </button>
    </div>
  );
}
