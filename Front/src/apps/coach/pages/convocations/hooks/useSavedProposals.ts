import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteSavedProposal,
  getSavedProposals,
  saveProposal,
  type SavedProposal,
} from "../../../services/deconvocationProposalService";

export type SavedProposalsStore = {
  items: SavedProposal[];
  loading: boolean;
  loadFailed: boolean;
  reload: () => Promise<void>;
  /** False when it could not be saved; the reason has already been notified. */
  save: (name: string, teamPlayerIds: string[]) => Promise<boolean>;
  remove: (proposalId: string) => Promise<boolean>;
};

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

const isConflict = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 409;

/** Saved deconvocation proposals of a match, loaded only while `enabled`. */
export function useSavedProposals(eventId: string | null, enabled: boolean): SavedProposalsStore {
  const [items, setItems] = useState<SavedProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  /** Drops the answer of a load that a newer one, or another match, has replaced. */
  const request = useRef(0);

  const reload = useCallback(async () => {
    if (!eventId) return;
    const current = ++request.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const loaded = await getSavedProposals(eventId);
      if (current === request.current) setItems(loaded);
    } catch {
      if (current === request.current) setLoadFailed(true);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setItems([]);
  }, [eventId]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  const save = useCallback(
    async (name: string, teamPlayerIds: string[]) => {
      if (!eventId) return false;
      try {
        const saved = await saveProposal(eventId, name, teamPlayerIds);
        setItems((previous) => [...previous, saved]);
        notify("Propuesta guardada", "success");
        return true;
      } catch (error) {
        notify(
          isConflict(error)
            ? "Ya hay 10 propuestas guardadas. Borra alguna para guardar otra."
            : "No se pudo guardar la propuesta.",
          "error",
        );
        return false;
      }
    },
    [eventId],
  );

  const remove = useCallback(
    async (proposalId: string) => {
      if (!eventId) return false;
      try {
        await deleteSavedProposal(eventId, proposalId);
        setItems((previous) => previous.filter((p) => p.id !== proposalId));
        return true;
      } catch {
        notify("No se pudo borrar la propuesta.", "error");
        return false;
      }
    },
    [eventId],
  );

  return { items, loading, loadFailed, reload, save, remove };
}
