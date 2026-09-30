import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { ASSESSMENT_LABELS, type ObservationAssessment } from "../../../../services/playerTrackingService";
import styles from "./AssessmentButtons.module.css";

const ASSESSMENT_BUTTONS: { value: ObservationAssessment; icon: JSX.Element; color: "success" | "warning" | "error" }[] = [
  { value: "Achieved", icon: <CheckCircleOutlineIcon fontSize="small" />, color: "success" },
  { value: "Partial", icon: <RemoveCircleOutlineIcon fontSize="small" />, color: "warning" },
  { value: "NotAchieved", icon: <HighlightOffIcon fontSize="small" />, color: "error" },
];

type Props = {
  value: ObservationAssessment | null;
  onChange: (value: ObservationAssessment | null) => void;
  ariaLabel?: string;
};

export default function AssessmentButtons({ value, onChange, ariaLabel = "Valoración" }: Props) {
  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_, next: ObservationAssessment | null) => onChange(next)}
      className={styles.group}
      aria-label={ariaLabel}
    >
      {ASSESSMENT_BUTTONS.map((button) => (
        <ToggleButton
          key={button.value}
          value={button.value}
          color={button.color}
          aria-label={ASSESSMENT_LABELS[button.value]}
          className={styles.button}
        >
          {button.icon}
          <span>{ASSESSMENT_LABELS[button.value]}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
