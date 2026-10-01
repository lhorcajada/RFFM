import { Autocomplete, TextField } from "@mui/material";
import { HABILIDAD_VOCABULARY } from "../../../../types/gameModel";

const MAX_HABILIDADES = 5;

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
};

/** Habilidades implicadas en una observación del modelo de juego (vocabulario cerrado, máximo 5). */
export default function HabilidadesPicker({ value, onChange }: Props) {
  const full = value.length >= MAX_HABILIDADES;
  return (
    <Autocomplete<string, true>
      multiple
      size="small"
      options={HABILIDAD_VOCABULARY as unknown as string[]}
      value={value}
      onChange={(_, next) => onChange(next)}
      getOptionDisabled={(option) => full && !value.includes(option)}
      renderInput={(params) => <TextField {...params} label="Habilidades (opcional)" />}
    />
  );
}
