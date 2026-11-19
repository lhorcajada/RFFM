import { useEffect, useRef, useState } from "react";
import gameModelService, { type AssistantMessage, type AssistantReply } from "../../../services/gameModelService";
import type { GameModel } from "../../../types/gameModel";
import {
  applyChange,
  canAccept,
  discardOrphans,
  rejectWithDependents,
  type TrackedChange,
} from "../components/gameModelProposalTree";

export interface UseGameModelAssistantArgs {
  gameModelId: string;
  model: GameModel;
  onModelChange: (next: GameModel) => void;
}

export interface GameModelAssistantState {
  messages: AssistantMessage[];
  changes: TrackedChange[];
  proposalVersion?: string;
  sending: boolean;
  error?: string;
  send(text: string): Promise<void>;
  retry(): Promise<void>;
  accept(changeId: string): void;
  reject(changeId: string): void;
  close(): void;
}

const FALLBACK_ERROR = "No se pudo consultar al asistente. Inténtalo de nuevo.";

function notify(message: string, severity: "info" | "warning") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

/** The backend's detail when there is one, otherwise a Spanish fallback. */
function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail;
  return typeof detail === "string" && detail ? detail : FALLBACK_ERROR;
}

function discardedMessage(count: number): string {
  return `${count} ${count === 1 ? "cambio descartado" : "cambios descartados"} porque no encajan en el modelo.`;
}

function orphanMessage(count: number): string {
  return `${count} ${count === 1 ? "cambio pendiente ya no es válido" : "cambios pendientes ya no son válidos"} tras la aceptación y se han retirado.`;
}

/**
 * Conversation with the game-model assistant and its pending proposal. The hook owns the conversation,
 * the proposal's per-change status and the request state; the saved model only changes through
 * `onModelChange`, one accepted change at a time. Consecutive accepts apply onto the tree the previous
 * accept produced, and a changed `model` argument (after a save or reload) replaces that local tree.
 */
export function useGameModelAssistant({ gameModelId, model, onModelChange }: UseGameModelAssistantArgs): GameModelAssistantState {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [changes, setChanges] = useState<TrackedChange[]>([]);
  const [proposalVersion, setProposalVersion] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Refs hold the latest values, so handlers called in sequence (before a re-render) see each other's results.
  const messagesRef = useRef<AssistantMessage[]>([]);
  const changesRef = useRef<TrackedChange[]>([]);
  const treeRef = useRef<GameModel>(model);
  const sourceModelRef = useRef<GameModel>(model);
  const sendingRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    if (model === sourceModelRef.current) return;
    sourceModelRef.current = model;
    treeRef.current = model;
  }, [model]);

  const setChangesState = (next: TrackedChange[]) => {
    changesRef.current = next;
    setChanges(next);
  };

  const applyReply = (reply: AssistantReply) => {
    const assistantMessage: AssistantMessage = { role: "assistant", content: reply.message, kind: reply.kind };
    const nextMessages = [...messagesRef.current, assistantMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    if (reply.kind === "proposal") {
      setChangesState(reply.changes.map((change): TrackedChange => ({ ...change, status: "pending" })));
      setProposalVersion(reply.version);
    }

    if (reply.discardedCount > 0) notify(discardedMessage(reply.discardedCount), "info");
  };

  const request = async (conversation: AssistantMessage[]) => {
    const generation = generationRef.current;
    sendingRef.current = true;
    setSending(true);
    setError(undefined);
    try {
      const reply = await gameModelService.assistant(gameModelId, conversation);
      if (generation === generationRef.current) applyReply(reply);
    } catch (caught) {
      if (generation === generationRef.current) setError(errorMessage(caught));
    } finally {
      if (generation === generationRef.current) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (content === "" || sendingRef.current) return;
    const nextMessages: AssistantMessage[] = [...messagesRef.current, { role: "user", content }];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    await request(nextMessages);
  };

  // A retry resends the conversation as it stands: the user message of the failed send is already in it.
  const retry = async () => {
    const conversation = messagesRef.current;
    if (sendingRef.current || conversation.at(-1)?.role !== "user") return;
    await request(conversation);
  };

  const accept = (changeId: string) => {
    const change = changesRef.current.find((c) => c.id === changeId);
    if (!change || !canAccept(change, changesRef.current)) return;

    const nextTree = applyChange(treeRef.current, change);
    treeRef.current = nextTree;
    const accepted = changesRef.current.map((c): TrackedChange => (c.id === changeId ? { ...c, status: "accepted" } : c));
    const pruned = discardOrphans(nextTree, accepted);
    setChangesState(pruned.changes);
    onModelChange(nextTree);
    if (pruned.discarded > 0) notify(orphanMessage(pruned.discarded), "warning");
  };

  const reject = (changeId: string) => {
    setChangesState(rejectWithDependents(changesRef.current, changeId));
  };

  const close = () => {
    generationRef.current += 1;
    sendingRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setChangesState([]);
    setProposalVersion(undefined);
    setError(undefined);
    setSending(false);
  };

  return { messages, changes, proposalVersion, sending, error, send, retry, accept, reject, close };
}
