import trainingService from "../../../../services/trainingService";
import type { SessionTargetDetail, TrainingSession, UpdateSessionRequest } from "../../../../types/training";
import { dedupeById } from "../components/dragPayload";

type SessionsUpdater = (updater: (prev: TrainingSession[]) => TrainingSession[]) => void;

function replaceTargets(sessionId: string, targets: SessionTargetDetail[]) {
  return (prev: TrainingSession[]) =>
    prev.map((s) => (s.id === sessionId ? { ...s, targets } : s));
}

function emitError(message: string) {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity: "error" } }));
}

/** Builds the wholesale-PUT request body for a session, preserving every field the board
 * doesn't touch (name, blocks, schedule, …) by reading the full SessionDetail rather than the
 * board's list-item shape (`TrainingSession`/`SessionListItem` doesn't carry `blocks` — only an
 * `exerciseCount` summary — so building the request from the list item would silently wipe an
 * existing session's blocks on every drop). */
async function buildUpdateRequest(sessionId: string, targetIds: string[]): Promise<UpdateSessionRequest> {
  const detail = await trainingService.getSessionById(sessionId);
  return {
    name: detail.name,
    description: detail.description,
    date: detail.date,
    startTime: detail.startTime,
    endTime: detail.endTime ?? null,
    location: detail.location ?? null,
    sportEventId: detail.sportEventId ?? null,
    microcicloId: detail.microcicloId ?? null,
    objetivoGeneral: detail.objetivoGeneral ?? null,
    mapaCampoTexto: detail.mapaCampoTexto ?? null,
    blocks: detail.blocks.map((b) => ({
      order: b.order,
      nombre: b.nombre,
      comoConectaConAnterior: b.comoConectaConAnterior,
      rotacionEntreEjercicios: b.rotacionEntreEjercicios ?? null,
      exercises: b.exercises.map((e) => ({ exerciseId: e.exerciseId, position: e.position })),
    })),
    targetSubSubPrincipioIds: targetIds,
  };
}

/** Optimistic add/remove of a session's targets — the drag-drop write path (design.md F5 of
 * `season-plan-content-board`). A drop must feel instant, so the chip is rendered before the
 * network round-trip; a failed write rolls the session back to its previous targets and
 * notifies via the shared snackbar event bus. */
export function useSessionDrop(
  sessions: TrainingSession[],
  setSessions: SessionsUpdater,
  refetchCoverage: () => void
) {
  async function addTargets(sessionId: string, incoming: SessionTargetDetail[]) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const before = session.targets;
    const merged = dedupeById([...before, ...incoming]);
    setSessions(replaceTargets(sessionId, merged));

    try {
      const request = await buildUpdateRequest(sessionId, merged.map((t) => t.subSubPrincipioId));
      await trainingService.updateSession(sessionId, request);
      refetchCoverage();
    } catch {
      setSessions(replaceTargets(sessionId, before));
      emitError("Error al asignar el objetivo a la sesión");
    }
  }

  async function removeTarget(sessionId: string, subSubPrincipioId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const before = session.targets;
    const remaining = before.filter((t) => t.subSubPrincipioId !== subSubPrincipioId);
    setSessions(replaceTargets(sessionId, remaining));

    try {
      const request = await buildUpdateRequest(sessionId, remaining.map((t) => t.subSubPrincipioId));
      await trainingService.updateSession(sessionId, request);
      refetchCoverage();
    } catch {
      setSessions(replaceTargets(sessionId, before));
      emitError("Error al quitar el objetivo de la sesión");
    }
  }

  return { addTargets, removeTarget };
}
