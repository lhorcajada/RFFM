import type { AssistantChange } from "../../../services/gameModelService";
import type {
  GameModel,
  Habilidad,
  Nota,
  NotaTipo,
  Principle,
  SetPieceRule,
  SubSubPrincipio,
  Subprincipio,
  Zona,
} from "../../../types/gameModel";
import { NOTA_TIPOS } from "../../../types/gameModel";
import {
  habilidadAddress,
  notaAddress,
  principleAddress,
  setPieceRuleAddress,
  subSubPrincipioAddress,
  subprincipioAddress,
  zonaAddress,
} from "./gameModelNodeAddress";

export type ProposalStatus = "pending" | "accepted" | "rejected";

export type TrackedChange = AssistantChange & { status: ProposalStatus };

type Fields = Record<string, unknown>;

/** Address of a node created by an add: the change id is its key, so a dependent can point at it. */
function pendingKey(changeId: string): string {
  return `pending:${changeId}`;
}

/** A node of the tree with its address and the array that holds it. */
type Located =
  | { nodeType: "principio"; address: string; node: Principle; remove: () => void }
  | { nodeType: "subprincipio"; address: string; node: Subprincipio; remove: () => void }
  | { nodeType: "zona"; address: string; node: Zona; remove: () => void }
  | { nodeType: "subSubPrincipio"; address: string; node: SubSubPrincipio; remove: () => void }
  | { nodeType: "habilidad"; address: string; node: Habilidad; remove: () => void }
  | { nodeType: "nota"; address: string; node: Nota; remove: () => void }
  | { nodeType: "setPieceRule"; address: string; node: SetPieceRule; remove: () => void };

function removeItem<T>(items: T[], item: T): void {
  const index = items.indexOf(item);
  if (index >= 0) items.splice(index, 1);
}

/** Every node of the tree in document order, each with the address the reading tree gives it. */
function listNodes(model: GameModel): Located[] {
  const located: Located[] = [];

  const addNotas = (notas: Nota[], holderAddress: string) => {
    for (const nota of notas) {
      located.push({
        nodeType: "nota",
        address: notaAddress(nota, holderAddress),
        node: nota,
        remove: () => removeItem(notas, nota),
      });
    }
  };

  const addSubSubPrincipios = (items: SubSubPrincipio[], parentAddress: string) => {
    for (const ssp of items) {
      const address = subSubPrincipioAddress(ssp, parentAddress);
      located.push({ nodeType: "subSubPrincipio", address, node: ssp, remove: () => removeItem(items, ssp) });
      for (const habilidad of ssp.habilidades) {
        located.push({
          nodeType: "habilidad",
          address: habilidadAddress(habilidad, address),
          node: habilidad,
          remove: () => removeItem(ssp.habilidades, habilidad),
        });
      }
      addNotas(ssp.notas, address);
    }
  };

  for (const principle of model.principles) {
    const principleAddr = principleAddress(principle);
    located.push({
      nodeType: "principio",
      address: principleAddr,
      node: principle,
      remove: () => removeItem(model.principles, principle),
    });
    addNotas(principle.notas, principleAddr);

    for (const sp of principle.subprincipios) {
      const spAddr = subprincipioAddress(sp, principleAddr);
      located.push({
        nodeType: "subprincipio",
        address: spAddr,
        node: sp,
        remove: () => removeItem(principle.subprincipios, sp),
      });
      addNotas(sp.notas, spAddr);
      addSubSubPrincipios(sp.subSubPrincipios, spAddr);

      for (const zona of sp.zonas) {
        const zonaAddr = zonaAddress(zona, spAddr);
        located.push({ nodeType: "zona", address: zonaAddr, node: zona, remove: () => removeItem(sp.zonas, zona) });
        addNotas(zona.notas, zonaAddr);
        addSubSubPrincipios(zona.subSubPrincipios, zonaAddr);
      }
    }
  }

  for (const rule of model.setPieceRules) {
    located.push({
      nodeType: "setPieceRule",
      address: setPieceRuleAddress(rule),
      node: rule,
      remove: () => removeItem(model.setPieceRules, rule),
    });
  }

  return located;
}

function nextLocalId(model: GameModel): number {
  const ids = listNodes(model).map((entry) => entry.node.id);
  return Math.min(0, ...ids) - 1;
}

function textField(fields: Fields, name: string): string | undefined {
  const value = fields[name];
  return typeof value === "string" ? value : undefined;
}

function numberField(fields: Fields, name: string): number | undefined {
  const value = fields[name];
  return typeof value === "number" ? value : undefined;
}

/** A nullable text field: `null` when the change clears it, `undefined` when the change leaves it alone. */
function nullableTextField(fields: Fields, name: string): string | null | undefined {
  const value = fields[name];
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function notaTipoField(fields: Fields): NotaTipo | undefined {
  const value = textField(fields, "tipo");
  return NOTA_TIPOS.find((tipo) => tipo === value);
}

function splitZoneKeys(zoneKeysCsv: string): string[] {
  return zoneKeysCsv
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function momentName(model: GameModel, gameMomentId: number): string | undefined {
  return model.principles.find((p) => p.gameMomentId === gameMomentId && p.gameMomentName)?.gameMomentName;
}

function patchNode(model: GameModel, located: Located, fields: Fields): void {
  switch (located.nodeType) {
    case "principio": {
      const { node } = located;
      const gameMomentId = numberField(fields, "gameMomentId");
      if (gameMomentId !== undefined) {
        node.gameMomentId = gameMomentId;
        node.gameMomentName = momentName(model, gameMomentId);
      }
      node.numero = numberField(fields, "numero") ?? node.numero;
      node.titulo = textField(fields, "titulo") ?? node.titulo;
      node.texto = textField(fields, "texto") ?? node.texto;
      return;
    }
    case "subprincipio": {
      const { node } = located;
      node.numero = textField(fields, "numero") ?? node.numero;
      node.titulo = textField(fields, "titulo") ?? node.titulo;
      node.texto = textField(fields, "texto") ?? node.texto;
      return;
    }
    case "zona": {
      const { node } = located;
      const zoneKeysCsv = textField(fields, "zoneKeysCsv");
      if (zoneKeysCsv !== undefined) node.zoneKeys = splitZoneKeys(zoneKeysCsv);
      const label = nullableTextField(fields, "label");
      if (label !== undefined) node.label = label;
      const zonaTexto = nullableTextField(fields, "zonaTexto");
      if (zonaTexto !== undefined) node.zonaTexto = zonaTexto;
      node.texto = textField(fields, "texto") ?? node.texto;
      return;
    }
    case "subSubPrincipio": {
      const { node } = located;
      node.numero = textField(fields, "numero") ?? node.numero;
      node.rol = textField(fields, "rol") ?? node.rol;
      node.texto = textField(fields, "texto") ?? node.texto;
      return;
    }
    case "habilidad": {
      const { node } = located;
      node.nombre = textField(fields, "nombre") ?? node.nombre;
      node.descripcion = textField(fields, "descripcion") ?? node.descripcion;
      node.entrenable = textField(fields, "entrenable") ?? node.entrenable;
      const referenciaAKey = nullableTextField(fields, "referenciaAKey");
      if (referenciaAKey !== undefined) node.referenciaAKey = referenciaAKey;
      return;
    }
    case "nota": {
      const { node } = located;
      node.tipo = notaTipoField(fields) ?? node.tipo;
      node.texto = textField(fields, "texto") ?? node.texto;
      return;
    }
    case "setPieceRule": {
      const { node } = located;
      node.subtype = textField(fields, "subtype") ?? node.subtype;
      node.texto = textField(fields, "texto") ?? node.texto;
      return;
    }
  }
}

function locate(model: GameModel, change: AssistantChange): Located | undefined {
  if (!change.address) return undefined;
  return listNodes(model).find((entry) => entry.address === change.address && entry.nodeType === change.nodeType);
}

/** The notas list of a node that can hold notas (principio, subprincipio, zona, subSubPrincipio). */
function notasOf(entry: Located | undefined): Nota[] | undefined {
  switch (entry?.nodeType) {
    case "principio":
    case "subprincipio":
    case "zona":
    case "subSubPrincipio":
      return entry.node.notas;
    default:
      return undefined;
  }
}

/** Adds a node under its parent. A change without a valid parent or required field adds nothing. */
function addNode(model: GameModel, change: AssistantChange): void {
  const key = pendingKey(change.id);
  const fields = change.fields;
  const id = nextLocalId(model);
  const parentAddress =
    change.parentAddress ?? (change.parentChangeId !== undefined ? pendingKey(change.parentChangeId) : undefined);
  const parent = parentAddress === undefined ? undefined : listNodes(model).find((e) => e.address === parentAddress);

  switch (change.nodeType) {
    case "principio": {
      const gameMomentId = numberField(fields, "gameMomentId");
      if (gameMomentId === undefined) return;
      model.principles.push({
        id,
        key,
        gameMomentId,
        gameMomentName: momentName(model, gameMomentId),
        numero: numberField(fields, "numero") ?? 0,
        titulo: textField(fields, "titulo") ?? "",
        texto: textField(fields, "texto") ?? "",
        subprincipios: [],
        notas: [],
      });
      return;
    }
    case "subprincipio": {
      if (parent?.nodeType !== "principio") return;
      parent.node.subprincipios.push({
        id,
        key,
        numero: textField(fields, "numero") ?? "",
        titulo: textField(fields, "titulo") ?? "",
        texto: textField(fields, "texto") ?? "",
        zonas: [],
        subSubPrincipios: [],
        notas: [],
      });
      return;
    }
    case "zona": {
      if (parent?.nodeType !== "subprincipio") return;
      parent.node.zonas.push({
        id,
        key,
        zoneKeys: splitZoneKeys(textField(fields, "zoneKeysCsv") ?? ""),
        label: nullableTextField(fields, "label") ?? null,
        zonaTexto: nullableTextField(fields, "zonaTexto") ?? null,
        texto: textField(fields, "texto") ?? "",
        subSubPrincipios: [],
        notas: [],
      });
      return;
    }
    case "subSubPrincipio": {
      const created: SubSubPrincipio = {
        id,
        key,
        numero: textField(fields, "numero") ?? "",
        rol: textField(fields, "rol") ?? "",
        texto: textField(fields, "texto") ?? "",
        habilidades: [],
        notas: [],
      };
      if (parent?.nodeType === "subprincipio") parent.node.subSubPrincipios.push(created);
      else if (parent?.nodeType === "zona") parent.node.subSubPrincipios.push(created);
      return;
    }
    case "habilidad": {
      if (parent?.nodeType !== "subSubPrincipio") return;
      parent.node.habilidades.push({
        id,
        apiId: key,
        nombre: textField(fields, "nombre") ?? "",
        descripcion: textField(fields, "descripcion") ?? "",
        entrenable: textField(fields, "entrenable") ?? "",
        referenciaAKey: nullableTextField(fields, "referenciaAKey") ?? null,
      });
      return;
    }
    case "nota": {
      const tipo = notaTipoField(fields);
      const notas = notasOf(parent);
      if (tipo === undefined || notas === undefined) return;
      notas.push({ id, apiId: key, tipo, texto: textField(fields, "texto") ?? "" });
      return;
    }
    case "setPieceRule": {
      model.setPieceRules.push({ id, apiId: key, subtype: textField(fields, "subtype") ?? "", texto: textField(fields, "texto") ?? "" });
      return;
    }
  }
}

/** Returns a new tree with the accepted change applied. The input tree is never mutated. */
export function applyChange(model: GameModel, change: AssistantChange): GameModel {
  const next = structuredClone(model);

  if (change.operation === "add") {
    addNode(next, change);
    return next;
  }

  const target = locate(next, change);
  if (!target) return next;

  if (change.operation === "change") patchNode(next, target, change.fields);
  else target.remove();

  return next;
}

/** An add can be accepted only once its parent change has been accepted. */
export function canAccept(change: TrackedChange, all: TrackedChange[]): boolean {
  if (change.status !== "pending") return false;
  if (change.parentChangeId === undefined) return true;
  const parent = all.find((c) => c.id === change.parentChangeId);
  return parent?.status === "accepted";
}

/** Rejects the change and, transitively, every change that depends on it through parentChangeId.
 * Only pending changes change status: an accepted change is already in the tree. */
export function rejectWithDependents(all: TrackedChange[], changeId: string): TrackedChange[] {
  const rejectedIds = new Set<string>([changeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const change of all) {
      if (change.parentChangeId !== undefined && rejectedIds.has(change.parentChangeId) && !rejectedIds.has(change.id)) {
        rejectedIds.add(change.id);
        grew = true;
      }
    }
  }
  return all.map((change): TrackedChange =>
    rejectedIds.has(change.id) && change.status === "pending" ? { ...change, status: "rejected" } : change
  );
}

/** A pending change is an orphan when its target no longer exists in `model`, or when its parent change
 * was rejected or dropped, or an accepted parent's node was removed. */
function isOrphan(
  change: TrackedChange,
  addresses: ReadonlySet<string>,
  statusById: ReadonlyMap<string, ProposalStatus>
): boolean {
  if (change.operation !== "add") return change.address === undefined || !addresses.has(change.address);

  if (change.parentAddress !== undefined && !addresses.has(change.parentAddress)) return true;

  if (change.parentChangeId !== undefined) {
    const parentStatus = statusById.get(change.parentChangeId);
    if (parentStatus === undefined || parentStatus === "rejected") return true;
    if (parentStatus === "accepted" && !addresses.has(pendingKey(change.parentChangeId))) return true;
  }

  return false;
}

/** Drops still-pending changes whose target no longer exists in `model`, repeating until no more fall,
 * so a dependent of a dropped change is dropped too. Accepted and rejected changes are kept as they are. */
export function discardOrphans(model: GameModel, all: TrackedChange[]): { changes: TrackedChange[]; discarded: number } {
  const addresses = new Set(listNodes(model).map((entry) => entry.address));
  let remaining = all;
  let discarded = 0;
  let droppedThisPass = true;

  while (droppedThisPass) {
    const statusById = new Map(remaining.map((change) => [change.id, change.status] as const));
    const kept = remaining.filter((change) => change.status !== "pending" || !isOrphan(change, addresses, statusById));
    droppedThisPass = kept.length < remaining.length;
    discarded += remaining.length - kept.length;
    remaining = kept;
  }

  return { changes: remaining, discarded };
}
