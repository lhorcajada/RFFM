import type { GameModel, Nota, SubSubPrincipio } from "../../types/gameModel";
import { NOTA_TIPO_LABELS, SET_PIECE_SUBTYPE_LABELS } from "../../types/gameModel";
import { compareNumero, zonaHeading } from "./components/gameModelOrder";

export type GameModelPdfBlockKind =
  | "title"
  | "subtitle"
  | "phase"
  | "principle"
  | "subprinciple"
  | "zone"
  | "subsubprinciple"
  | "setpiece"
  | "paragraph"
  | "bullet"
  | "note";

export type GameModelPdfBlock = { kind: GameModelPdfBlockKind; text: string };

const sortByNumero = <T extends { numero: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => compareNumero(a.numero, b.numero));

function paragraph(text: string | null | undefined): GameModelPdfBlock[] {
  const t = text?.trim();
  return t ? [{ kind: "paragraph", text: t }] : [];
}

function notes(list: Nota[]): GameModelPdfBlock[] {
  return list.map((n) => ({ kind: "note" as const, text: `${NOTA_TIPO_LABELS[n.tipo] ?? "Nota"}: ${n.texto}` }));
}

function subSubPrinciples(list: SubSubPrincipio[]): GameModelPdfBlock[] {
  return sortByNumero(list).flatMap((ssp) => [
    { kind: "subsubprinciple" as const, text: `${ssp.numero} — ${ssp.rol}` },
    ...paragraph(ssp.texto),
    ...ssp.habilidades.map((h) => ({
      kind: "bullet" as const,
      text: h.referenciaAKey
        ? `${h.nombre} (misma que ${h.referenciaAKey})`
        : `${h.nombre}: ${h.descripcion}${h.entrenable ? ` (Entrenable: ${h.entrenable})` : ""}`,
    })),
    ...notes(ssp.notas),
  ]);
}

export function buildGameModelPdfBlocks(gameModel: GameModel, teamName?: string): GameModelPdfBlock[] {
  const blocks: GameModelPdfBlock[] = [
    { kind: "title", text: gameModel.name },
    {
      kind: "subtitle",
      text: [teamName, gameModel.season ? `Temporada ${gameModel.season}` : ""].filter(Boolean).join(" · "),
    },
  ];

  const momentIds = Array.from(new Set(gameModel.principles.map((p) => p.gameMomentId))).sort((a, b) => a - b);
  for (const momentId of momentIds) {
    const principles = gameModel.principles.filter((p) => p.gameMomentId === momentId).sort((a, b) => a.numero - b.numero);
    blocks.push({ kind: "phase", text: principles[0]?.gameMomentName ?? `Fase ${momentId}` });

    for (const principle of principles) {
      blocks.push({ kind: "principle", text: `${principle.numero}. ${principle.titulo}` }, ...paragraph(principle.texto));

      for (const sp of sortByNumero(principle.subprincipios)) {
        blocks.push({ kind: "subprinciple", text: `${sp.numero} — ${sp.titulo}` }, ...paragraph(sp.texto));
        blocks.push(...subSubPrinciples(sp.subSubPrincipios));
        for (const zona of sp.zonas) {
          blocks.push({ kind: "zone", text: zonaHeading(zona) }, ...paragraph(zona.texto));
          blocks.push(...subSubPrinciples(zona.subSubPrincipios), ...notes(zona.notas));
        }
        blocks.push(...notes(sp.notas));
      }
      blocks.push(...notes(principle.notas));
    }
  }

  if (gameModel.setPieceRules.length > 0) {
    blocks.push({ kind: "phase", text: "Balón parado" });
    for (const rule of gameModel.setPieceRules) {
      blocks.push(
        {
          kind: "setpiece",
          text: SET_PIECE_SUBTYPE_LABELS[rule.subtype as keyof typeof SET_PIECE_SUBTYPE_LABELS] ?? rule.subtype,
        },
        ...paragraph(rule.texto),
      );
    }
  }

  if (gameModel.openIssues.length > 0) {
    blocks.push({ kind: "phase", text: "Pendientes abiertos" });
    for (const issue of gameModel.openIssues) {
      blocks.push({
        kind: "bullet",
        text: `${issue.topic} (${issue.status === "open" ? "pendiente" : "resuelto"}): ${issue.description}`,
      });
    }
  }

  if (momentIds.length === 0 && gameModel.setPieceRules.length === 0) {
    blocks.push({ kind: "paragraph", text: "Este modelo de juego todavía no tiene contenido." });
  }

  return blocks;
}

export function gameModelPdfFileName(gameModel: GameModel): string {
  return `${gameModel.name} - ${gameModel.season}`.replace(/[\\/:*?"<>|]/g, "-") + ".pdf";
}
