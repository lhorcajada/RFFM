import { useState } from "react";
import { Button, IconButton, Slider, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import type { CreateRatingPayload, CharacteristicAnswer } from "../../../services/playerRatingService";
import styles from "./EditRatingDialog.module.css";

type SubRatingKey = string;

type SubRatingState = { notes: string; [key: string]: number | string };

type RatingGroup = {
  categoryKey: "physical" | "technical" | "tactical" | "competitiveness";
  label: string;
  subRatings: { key: SubRatingKey; label: string }[];
};

const RATING_GROUPS: RatingGroup[] = [
  {
    categoryKey: "physical",
    label: "Físico",
    subRatings: [
      { key: "physicalSpeed", label: "Velocidad" },
      { key: "physicalEndurance", label: "Resistencia" },
      { key: "physicalStrength", label: "Fuerza" },
    ],
  },
  {
    categoryKey: "technical",
    label: "Técnica",
    subRatings: [
      { key: "technicalDribbling", label: "Regate" },
      { key: "technicalPassing", label: "Pase" },
      { key: "technicalControl", label: "Conducción" },
      { key: "technicalShooting", label: "Tiro" },
      { key: "technicalTackling", label: "Entradas" },
      { key: "technicalInterceptions", label: "Intercepciones" },
      { key: "technicalHeading", label: "Cabeceo" },
    ],
  },
  {
    categoryKey: "tactical",
    label: "Táctica",
    subRatings: [
      { key: "tacticalDefensiveAwareness", label: "Vigilancias defensivas" },
      { key: "tacticalMarking", label: "Marcaje" },
      { key: "tacticalTrackBack", label: "Repliegue" },
      { key: "tacticalPressing", label: "Pressing" },
      { key: "tacticalGeneratesAdvantage", label: "Genera ventaja en ataque" },
      { key: "tacticalOffMovement", label: "Desmarque" },
      { key: "tacticalBeatsOpponents", label: "Supera rivales" },
      { key: "tacticalAttackParticipation", label: "Participación en ataque" },
    ],
  },
  {
    categoryKey: "competitiveness",
    label: "Competitividad",
    subRatings: [
      { key: "competDuelWinning", label: "Ganador de duelos" },
      { key: "competLooseBalls", label: "Bal. div. disputados" },
      { key: "competRecoveries", label: "Recuperaciones" },
      { key: "competDecisiveActions", label: "Acciones decisivas" },
      { key: "competResponsibility", label: "Asume responsabilidades" },
      { key: "competConstantEffort", label: "Esfuerzo constante" },
    ],
  },
];

const DEFAULT_VALUE = 50;

function computeAvg(state: SubRatingState, keys: SubRatingKey[]): number {
  const sum = keys.reduce((acc, k) => acc + Number(state[k] ?? 0), 0);
  return Math.round((sum / keys.length) * 10) / 10;
}

function ratingColor(v: number): string {
  if (v >= 90) return "#29b6f6";
  if (v >= 70) return "#66bb6a";
  if (v >= 50) return "#ffb300";
  return "#ef5350";
}

type Props = {
  playerDisplayName: string;
  initial: Partial<Record<string, number>>;
  saving: boolean;
  onSave: (state: CreateRatingPayload & { notes: string }) => void;
  onClose: () => void;
};

export default function EditRatingDialog({
  playerDisplayName,
  initial,
  saving,
  onSave,
  onClose,
}: Props) {
  const buildDefault = (): SubRatingState => {
    const defaults: SubRatingState = {
      physicalSpeed: DEFAULT_VALUE,
      physicalEndurance: DEFAULT_VALUE,
      physicalStrength: DEFAULT_VALUE,
      technicalDribbling: DEFAULT_VALUE,
      technicalPassing: DEFAULT_VALUE,
      technicalControl: DEFAULT_VALUE,
      technicalShooting: DEFAULT_VALUE,
      technicalTackling: DEFAULT_VALUE,
      technicalInterceptions: DEFAULT_VALUE,
      technicalHeading: DEFAULT_VALUE,
      tacticalDefensiveAwareness: DEFAULT_VALUE,
      tacticalMarking: DEFAULT_VALUE,
      tacticalTrackBack: DEFAULT_VALUE,
      tacticalPressing: DEFAULT_VALUE,
      tacticalGeneratesAdvantage: DEFAULT_VALUE,
      tacticalOffMovement: DEFAULT_VALUE,
      tacticalBeatsOpponents: DEFAULT_VALUE,
      tacticalAttackParticipation: DEFAULT_VALUE,
      competDuelWinning: DEFAULT_VALUE,
      competLooseBalls: DEFAULT_VALUE,
      competRecoveries: DEFAULT_VALUE,
      competDecisiveActions: DEFAULT_VALUE,
      competResponsibility: DEFAULT_VALUE,
      competConstantEffort: DEFAULT_VALUE,
      notes: "",
    };
    for (const key of Object.keys(initial) as SubRatingKey[]) {
      const v = initial[key];
      if (v != null) (defaults as unknown as Record<string, number>)[key] = v;
    }
    return defaults;
  };

  const [state, setState] = useState<SubRatingState>(buildDefault);

  function handleSlider(key: SubRatingKey, value: number) {
    setState((prev) => ({ ...prev, [key]: Math.min(100, Math.max(0, Math.round(value))) }));
  }

  function handleInput(key: SubRatingKey, raw: string) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) setState((prev) => ({ ...prev, [key]: Math.min(100, Math.max(0, n)) }));
    else if (raw === "") setState((prev) => ({ ...prev, [key]: 0 }));
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              <EditIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
              Nueva valoración
            </div>
            <div className={styles.playerName}>{playerDisplayName}</div>
          </div>
          <IconButton size="small" onClick={onClose} disabled={saving}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <div className={styles.body}>
          {RATING_GROUPS.map((group) => {
            const avg = computeAvg(state, group.subRatings.map((s) => s.key));
            return (
              <div key={group.categoryKey} className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>{group.label}</span>
                  <span className={styles.groupAvg} style={{ color: ratingColor(avg) }}>
                    {avg % 1 === 0 ? avg : avg.toFixed(1)}
                  </span>
                </div>
                {group.subRatings.map(({ key, label }) => (
                  <div key={key} className={styles.field}>
                    <span className={styles.fieldLabel}>{label}</span>
                    <Slider
                      value={Number(state[key] ?? 0)}
                      onChange={(_, v) => handleSlider(key, v as number)}
                      min={0}
                      max={100}
                      step={1}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      value={Number(state[key] ?? 0)}
                      onChange={(e) => handleInput(key, e.target.value)}
                      size="small"
                      inputProps={{ min: 0, max: 100, style: { textAlign: "center", width: 36, padding: "3px 4px" } }}
                      sx={{ width: 54, flexShrink: 0 }}
                    />
                  </div>
                ))}
              </div>
            );
          })}
          <TextField
            label="Notas (opcional)"
            value={state.notes}
            onChange={(e) =>
              setState((prev) => ({ ...prev, notes: e.target.value }))
            }
            size="small"
            multiline
            rows={2}
            fullWidth
            inputProps={{ maxLength: 500 }}
          />
        </div>

        <div className={styles.footer}>
          <Button size="small" variant="text" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              const answers: CharacteristicAnswer[] = [];
              for (const group of RATING_GROUPS) {
                for (const s of group.subRatings) {
                  const raw = Number(state[s.key] ?? 0);
                  const level = Math.max(1, Math.min(10, Math.round(raw / 10)));
                  answers.push({
                    characteristicKey: s.key,
                    level,
                    concept: "",
                    categoryKey: group.categoryKey,
                  });
                }
              }

              const payload: CreateRatingPayload & { notes: string } = {
                isGoalkeeper: false,
                answers,
                notes: state.notes ?? "",
              };

              onSave(payload);
            }}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

