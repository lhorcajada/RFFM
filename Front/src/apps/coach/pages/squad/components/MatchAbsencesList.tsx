import { useState } from "react";
import { Button, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import styles from "./MatchAbsencesList.module.css";

type Props = {
  lines: string[];
};

export default function MatchAbsencesList({ lines }: Props) {
  const [open, setOpen] = useState(false);

  if (lines.length === 0) return null;

  return (
    <div className={styles.block}>
      <Button
        size="small"
        variant="text"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        endIcon={<ExpandMoreIcon className={open ? styles.toggleIconOpen : styles.toggleIcon} />}
      >
        Ver ausencias ({lines.length})
      </Button>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <ul className={styles.absences} aria-label="Ausencias en partidos">
          {lines.map((line) => (
            <li key={line} className={styles.absence}>
              {line}
            </li>
          ))}
        </ul>
      </Collapse>
    </div>
  );
}
