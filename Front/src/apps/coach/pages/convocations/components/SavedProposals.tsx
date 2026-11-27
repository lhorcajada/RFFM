import { useState } from "react";
import { Alert, Button, CircularProgress } from "@mui/material";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import type { SavedProposal } from "../../../services/deconvocationProposalService";
import type { SavedProposalsStore } from "../hooks/useSavedProposals";
import styles from "./SavedProposals.module.css";

export type SavedProposalsController = SavedProposalsStore & {
  /** Deconvokes by technical decision those of `playerIds` who are not out yet. */
  apply: (playerIds: string[]) => Promise<void>;
  /** Null when the player is no longer in the squad. */
  playerName: (playerId: string) => string | null;
  notCalledIds: ReadonlySet<string>;
};

type Props = { saved: SavedProposalsController };

type Target = { action: "apply" | "delete"; proposal: SavedProposal };

function savedDay(createdOn: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(createdOn));
}

/** Candidate proposals saved for the match; the coach applies one of them or deletes it. */
export default function SavedProposals({ saved }: Props) {
  const { items, loading, loadFailed, reload, remove, apply, playerName, notCalledIds } = saved;
  const [target, setTarget] = useState<Target | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!loading && !loadFailed && items.length === 0) return null;

  const inSquad = (ids: string[]) => ids.filter((id) => playerName(id) !== null);
  const names = (ids: string[]) => ids.map(playerName).filter(Boolean).join(", ");

  async function handleConfirm() {
    if (!target || processing) return;
    setProcessing(true);
    try {
      if (target.action === "delete") await remove(target.proposal.id);
      else await apply(inSquad(target.proposal.teamPlayerIds));
    } finally {
      setProcessing(false);
      setTarget(null);
    }
  }

  function applyDescription(proposal: SavedProposal) {
    const toDeconvoke = inSquad(proposal.teamPlayerIds).filter((id) => !notCalledIds.has(id));
    const stayOut = inSquad(Array.from(notCalledIds));
    return (
      <div className={styles.confirm}>
        <p>Se desconvocará por decisión técnica a: {names(toDeconvoke)}.</p>
        {stayOut.length > 0 && <p>Ya están desconvocados y seguirán fuera: {names(stayOut)}.</p>}
        <p>La convocatoria no se publica.</p>
      </div>
    );
  }

  return (
    <section className={styles.section} aria-label="Propuestas guardadas">
      <h4 className={styles.title}>Propuestas guardadas</h4>
      {loading && <CircularProgress size={20} />}
      {loadFailed && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void reload()}>
              Reintentar
            </Button>
          }
        >
          No se pudieron cargar las propuestas guardadas.
        </Alert>
      )}
      <div className={styles.cards}>
        {items.map((proposal) => {
          const available = inSquad(proposal.teamPlayerIds);
          const missing = proposal.teamPlayerIds.length - available.length;
          const applied = available.length > 0 && available.every((id) => notCalledIds.has(id));
          return (
            <article key={proposal.id} className={styles.card} aria-label={proposal.name}>
              <div className={styles.cardTop}>
                <strong className={styles.name}>{proposal.name}</strong>
                {applied && <span className={styles.applied}>Aplicada</span>}
              </div>
              <span className={styles.date}>Guardada el {savedDay(proposal.createdOn)}</span>
              <ul className={styles.players}>
                {available.map((id) => (
                  <li key={id} className={styles.player}>
                    {playerName(id)}
                  </li>
                ))}
              </ul>
              {missing > 0 && (
                <p className={styles.missing}>
                  {missing === 1 ? "1 jugador ya no está" : `${missing} jugadores ya no están`} en la plantilla
                </p>
              )}
              <div className={styles.actions}>
                <Button
                  variant="contained"
                  className={styles.button}
                  aria-label={`Aplicar ${proposal.name}`}
                  disabled={applied || available.length === 0}
                  onClick={() => setTarget({ action: "apply", proposal })}
                >
                  Aplicar
                </Button>
                <Button
                  color="inherit"
                  className={styles.button}
                  aria-label={`Borrar ${proposal.name}`}
                  onClick={() => setTarget({ action: "delete", proposal })}
                >
                  Borrar
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {target && (
        <ConfirmDialog
          open
          title={`${target.action === "apply" ? "Aplicar" : "Borrar"} «${target.proposal.name}»`}
          description={
            target.action === "apply"
              ? applyDescription(target.proposal)
              : "La propuesta guardada se borrará. La convocatoria no cambia."
          }
          confirmText={target.action === "apply" ? "Aplicar" : "Borrar"}
          processing={processing}
          onCancel={() => setTarget(null)}
          onConfirm={() => void handleConfirm()}
        />
      )}
    </section>
  );
}
