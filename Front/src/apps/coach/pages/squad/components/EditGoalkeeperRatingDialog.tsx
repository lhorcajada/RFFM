import { useState } from "react";
import { Button, IconButton, Slider, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import type { CreateGoalkeeperRatingPayload } from "../../../services/playerRatingService";
import styles from "./EditRatingDialog.module.css";

type KeeperKey = keyof Omit<CreateGoalkeeperRatingPayload, "notes">;

type KeeperState = Omit<CreateGoalkeeperRatingPayload, "notes"> & { notes: string };

type RatingGroup = {
  categoryKey: "physical" | "technical" | "tactical" | "competitiveness";
  label: string;
  subRatings: { key: KeeperKey; label: string }[];
};

const KEEPER_GROUPS: RatingGroup[] = [
  {
    categoryKey: "physical",
    label: "Físico",
    subRatings: [
      { key: "keeperReactionSpeed", label: "Reflejos / velocidad de reacción" },
      { key: "keeperAgility", label: "Agilidad" },
      { key: "keeperJumpPower", label: "Potencia de salto" },
      { key: "keeperStrength", label: "Fuerza / cuerpo a cuerpo" },
      { key: "keeperEndurance", label: "Resistencia / constancia" },
    ],
  },
  {
    categoryKey: "technical",
    label: "Técnica",
    subRatings: [
      { key: "keeperHandSecurity", label: "Blocaje / seguridad en manos" },
      { key: "keeperSaves", label: "Paradas" },
      { key: "keeperAerialPlay", label: "Juego aéreo" },
      { key: "keeperHandDistribution", label: "Saques con mano" },
      { key: "keeperKickDistribution", label: "Saques con pie" },
      { key: "keeperFirstTouch", label: "Control orientado / primer toque" },
      { key: "keeperPlayUnderPressure", label: "Juego con pies bajo presión" },
    ],
  },
  {
    categoryKey: "tactical",
    label: "Táctica",
    subRatings: [
      { key: "keeperPositioning", label: "Colocación" },
      { key: "keeperGameReading", label: "Lectura de jugadas" },
      { key: "keeperOneOnOne", label: "Uno contra uno" },
      { key: "keeperBackCoverage", label: "Cobertura de espalda defensiva" },
      { key: "keeperSallyTiming", label: "Timing de salidas" },
      { key: "keeperBuildupPlay", label: "Iniciar juego / salida de balón" },
      { key: "keeperDefensiveOrganization", label: "Comunicación y orden defensivo" },
    ],
  },
  {
    categoryKey: "competitiveness",
    label: "Competitividad",
    subRatings: [
      { key: "keeperValor", label: "Valentía" },
      { key: "keeperConcentration", label: "Concentración" },
      { key: "keeperKeyMoments", label: "Seguridad en momentos clave" },
      { key: "keeperErrorManagement", label: "Gestión del error" },
      { key: "keeperResponsibility", label: "Responsabilidad" },
      { key: "keeperConsistency", label: "Regularidad" },
    ],
  },
];

const DEFAULT_VALUE = 50;

function computeAvg(state: KeeperState, keys: KeeperKey[]): number {
  const sum = keys.reduce((acc, k) => acc + state[k], 0);
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
  initial: Partial<Omit<KeeperState, "notes">>;
  saving: boolean;
  onSave: (state: KeeperState) => void;
  onClose: () => void;
};

export default function EditGoalkeeperRatingDialog({
  playerDisplayName,
  initial,
  saving,
  onSave,
  onClose,
}: Props) {
  const buildDefault = (): KeeperState => {
    const defaults: KeeperState = {
      keeperReactionSpeed: DEFAULT_VALUE,
      keeperAgility: DEFAULT_VALUE,
      keeperJumpPower: DEFAULT_VALUE,
      keeperStrength: DEFAULT_VALUE,
      keeperEndurance: DEFAULT_VALUE,
      keeperHandSecurity: DEFAULT_VALUE,
      keeperSaves: DEFAULT_VALUE,
      keeperAerialPlay: DEFAULT_VALUE,
      keeperHandDistribution: DEFAULT_VALUE,
      keeperKickDistribution: DEFAULT_VALUE,
      keeperFirstTouch: DEFAULT_VALUE,
      keeperPlayUnderPressure: DEFAULT_VALUE,
      keeperPositioning: DEFAULT_VALUE,
      keeperGameReading: DEFAULT_VALUE,
      keeperOneOnOne: DEFAULT_VALUE,
      keeperBackCoverage: DEFAULT_VALUE,
      keeperSallyTiming: DEFAULT_VALUE,
      keeperBuildupPlay: DEFAULT_VALUE,
      keeperDefensiveOrganization: DEFAULT_VALUE,
      keeperValor: DEFAULT_VALUE,
      keeperConcentration: DEFAULT_VALUE,
      keeperKeyMoments: DEFAULT_VALUE,
      keeperErrorManagement: DEFAULT_VALUE,
      keeperResponsibility: DEFAULT_VALUE,
      keeperConsistency: DEFAULT_VALUE,
      notes: "",
    };
    for (const key of Object.keys(initial) as KeeperKey[]) {
      const v = initial[key];
      if (v != null) (defaults as unknown as Record<string, number>)[key] = v;
    }
    return defaults;
  };

  const [state, setState] = useState<KeeperState>(buildDefault);

  function handleSlider(key: KeeperKey, value: number) {
    setState((prev) => ({ ...prev, [key]: Math.min(100, Math.max(0, Math.round(value))) }));
  }

  function handleInput(key: KeeperKey, raw: string) {
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
              Nueva valoración (Portero)
            </div>
            <div className={styles.playerName}>{playerDisplayName}</div>
          </div>
          <IconButton size="small" onClick={onClose} disabled={saving}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <div className={styles.body}>
          {KEEPER_GROUPS.map((group) => {
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
                      value={state[key]}
                      onChange={(_, v) => handleSlider(key, v as number)}
                      min={0}
                      max={100}
                      step={1}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      value={state[key]}
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
            onClick={() => onSave(state)}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
