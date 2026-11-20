import { canAccept, pendingKey, type TrackedChange } from "./gameModelProposalTree";
import type { PendingChange, PendingChanges } from "./gameModelReadingTree";

/** Address of the placeholder an add shows under its parent: the key the proposal tree gives the node the add creates. */
export function proposedAddAddress(changeId: string): string {
  return pendingKey(changeId);
}

type Fields = Record<string, unknown>;

function firstText(fields: Fields, names: string[]): string | undefined {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

function numberText(fields: Fields, name: string): string | undefined {
  const value = fields[name];
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** The parent a dependent add hangs from: its own parentAddress, or the one of the change it depends on. */
function parentAddressOf(change: TrackedChange, all: TrackedChange[]): string | undefined {
  let current: TrackedChange | undefined = change;
  for (let depth = 0; current !== undefined && depth <= all.length; depth++) {
    if (current.parentAddress !== undefined) return current.parentAddress;
    const parentId: string | undefined = current.parentChangeId;
    current = parentId === undefined ? undefined : all.find((candidate) => candidate.id === parentId);
  }
  return undefined;
}

function pendingOf(change: TrackedChange, all: TrackedChange[], parentAddress?: string): PendingChange {
  const { fields } = change;
  return {
    operation: change.operation,
    parentAddress,
    number: numberText(fields, "numero"),
    title: firstText(fields, ["titulo", "rol", "nombre", "tipo", "subtype", "zoneKeysCsv"]),
    text: firstText(fields, ["texto", "descripcion", "zonaTexto"]),
    changeId: change.id,
    canAccept: canAccept(change, all),
  };
}

/**
 * The still-pending changes as the reading view decorates them: a change or a removal by the address it
 * touches, an add by a placeholder address under the node it hangs from. An add whose parent cannot be
 * found is left out. Accepted, rejected and discarded changes are not shown.
 */
export function assistantPendingChanges(changes: TrackedChange[]): PendingChanges {
  const pending: Record<string, PendingChange> = {};
  for (const change of changes) {
    if (change.status !== "pending") continue;
    if (change.operation === "add") {
      const parentAddress = parentAddressOf(change, changes);
      if (parentAddress === undefined) continue;
      pending[proposedAddAddress(change.id)] = pendingOf(change, changes, parentAddress);
    } else if (change.address !== undefined) {
      pending[change.address] = pendingOf(change, changes);
    }
  }
  return pending;
}
