import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import type { ClassificationTeamMatch } from "../../../../../shared/hooks/useClassification";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import ResultRow from "./ResultRow";
import styles from "./TeamResultsDialog.module.css";

type TeamResultsDialogProps = {
  open: boolean;
  teamName: string;
  results: ClassificationTeamMatch[];
  onClose: () => void;
};

export default function TeamResultsDialog({ open, teamName, results, onClose }: TeamResultsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="team-results-title">
      <DialogTitle id="team-results-title">Resultados de {teamName}</DialogTitle>
      <DialogContent>
        {results.length === 0 ? (
          <EmptyState description="No hay resultados." />
        ) : (
          <ul className={styles.list}>
            {results.map((match, index) => (
              <ResultRow key={`${match.date}-${index}`} match={match} />
            ))}
          </ul>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
