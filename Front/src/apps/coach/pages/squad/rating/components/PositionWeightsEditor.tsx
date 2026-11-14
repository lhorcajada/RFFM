import { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { TRAIT_CATALOG, type TraitWeight } from "../ratingTraits";

import styles from "./PositionWeightsEditor.module.css";

type Props = {
  weights: Record<string, TraitWeight>;
  readOnly: boolean;
  saving: boolean;
  onSave: (weights: Record<string, TraitWeight>) => void;
};

const WEIGHT_OPTIONS: { value: TraitWeight; label: string }[] = [
  { value: "key", label: "Clave" },
  { value: "sum", label: "Suma" },
  { value: "indifferent", label: "Indiferente" },
];

export default function PositionWeightsEditor({ weights, readOnly, saving, onSave }: Props) {
  const [draft, setDraft] = useState<Record<string, TraitWeight>>(weights);
  const changed = TRAIT_CATALOG.some((trait) => draft[trait.key] !== weights[trait.key]);

  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }} className={styles.accordion}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>Pesos del puesto</AccordionSummary>
      <AccordionDetails>
        {TRAIT_CATALOG.map((trait) => (
          <div key={trait.key} role="group" aria-label={`Peso de ${trait.label}`} className={styles.row}>
            <span className={styles.label}>{trait.label}</span>
            <ToggleButtonGroup
              value={draft[trait.key]}
              exclusive
              size="small"
              disabled={readOnly}
              onChange={(_, value: TraitWeight | null) => {
                if (value) setDraft((prev) => ({ ...prev, [trait.key]: value }));
              }}
            >
              {WEIGHT_OPTIONS.map(({ value, label }) => (
                <ToggleButton key={value} value={value} className={styles.toggleBtn}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        ))}
        {!readOnly && (
          <Button
            size="small"
            variant="contained"
            className={styles.save}
            disabled={!changed || saving}
            onClick={() => onSave(draft)}
          >
            Guardar pesos
          </Button>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
