import { describe, expect, it } from "vitest";
import { buildTargetTree, summarizeTargetsForObjetivo } from "../targetTreeGrouping";
import type { SessionTargetDetail } from "../../../../types/training";

function buildTarget(overrides: Partial<SessionTargetDetail> = {}): SessionTargetDetail {
  return {
    subSubPrincipioId: "ssp-1",
    rol: "Central",
    numero: "1.1.1",
    subprincipioId: "sub-1",
    subprincipioTitulo: "Presión alta",
    zonaId: null,
    zonaLabel: null,
    principioId: "principle-1",
    principioTitulo: "Defensa organizada",
    gameMomentId: 1,
    gameMomentName: "Fase defensiva",
    ...overrides,
  };
}

describe("buildTargetTree", () => {
  it("agrupa dos targets que comparten Fase/Principio/Subprincipio bajo una sola rama", () => {
    const tree = buildTargetTree([
      buildTarget({ subSubPrincipioId: "ssp-1", rol: "Central", numero: "1.1.1" }),
      buildTarget({ subSubPrincipioId: "ssp-2", rol: "Lateral", numero: "1.1.2" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].principios).toHaveLength(1);
    expect(tree[0].principios[0].subprincipios).toHaveLength(1);
    expect(tree[0].principios[0].subprincipios[0].leaves).toHaveLength(2);
  });

  it("crea ramas de Fase separadas cuando los targets pertenecen a distinta Fase", () => {
    const tree = buildTargetTree([
      buildTarget({ gameMomentId: 1, gameMomentName: "Fase defensiva", subSubPrincipioId: "ssp-1" }),
      buildTarget({ gameMomentId: 2, gameMomentName: "Fase ofensiva", subSubPrincipioId: "ssp-2" }),
    ]);

    expect(tree).toHaveLength(2);
  });

  it("agrupa targets que comparten Zona bajo el mismo nodo de Zona, sin duplicarlo", () => {
    const tree = buildTargetTree([
      buildTarget({ subSubPrincipioId: "ssp-1", zonaId: "zona-1", zonaLabel: "Ataque del centro" }),
      buildTarget({ subSubPrincipioId: "ssp-2", zonaId: "zona-1", zonaLabel: "Ataque del centro", numero: "1.1.2" }),
    ]);

    const subprincipio = tree[0].principios[0].subprincipios[0];
    expect(subprincipio.zonas).toHaveLength(1);
    expect(subprincipio.zonas[0].leaves).toHaveLength(2);
    expect(subprincipio.leaves).toHaveLength(0);
  });

  it("mantiene por separado los targets con Zona de los que no tienen Zona bajo el mismo Subprincipio", () => {
    const tree = buildTargetTree([
      buildTarget({ subSubPrincipioId: "ssp-1", zonaId: "zona-1", zonaLabel: "Ataque del centro" }),
      buildTarget({ subSubPrincipioId: "ssp-2", zonaId: null, zonaLabel: null, numero: "1.1.2" }),
    ]);

    const subprincipio = tree[0].principios[0].subprincipios[0];
    expect(subprincipio.zonas).toHaveLength(1);
    expect(subprincipio.leaves).toHaveLength(1);
  });

  it("no agrupa targets con distinto Subprincipio aunque compartan Fase y Principio", () => {
    const tree = buildTargetTree([
      buildTarget({ subSubPrincipioId: "ssp-1", subprincipioId: "sub-1", subprincipioTitulo: "Presión alta" }),
      buildTarget({ subSubPrincipioId: "ssp-2", subprincipioId: "sub-2", subprincipioTitulo: "Repliegue" }),
    ]);

    expect(tree[0].principios[0].subprincipios).toHaveLength(2);
  });
});

describe("summarizeTargetsForObjetivo", () => {
  it("devuelve cadena vacía cuando no hay targets", () => {
    expect(summarizeTargetsForObjetivo([])).toBe("");
  });

  it("agrupa los roles de un mismo Subprincipio en una sola línea", () => {
    const summary = summarizeTargetsForObjetivo([
      buildTarget({
        subSubPrincipioId: "ssp-1",
        subprincipioId: "sub-1",
        subprincipioTitulo: "1.1 Evitar que el rival supere nuestra primera línea de presión",
        rol: "Delantero",
      }),
      buildTarget({
        subSubPrincipioId: "ssp-2",
        subprincipioId: "sub-1",
        subprincipioTitulo: "1.1 Evitar que el rival supere nuestra primera línea de presión",
        rol: "Extremo",
      }),
      buildTarget({
        subSubPrincipioId: "ssp-3",
        subprincipioId: "sub-1",
        subprincipioTitulo: "1.1 Evitar que el rival supere nuestra primera línea de presión",
        rol: "Mediocentro A",
      }),
    ]);

    expect(summary).toBe(
      "1.1 Evitar que el rival supere nuestra primera línea de presión: Delantero, Extremo, Mediocentro A."
    );
  });

  it("produce una línea por cada Subprincipio distinto, en orden de aparición", () => {
    const summary = summarizeTargetsForObjetivo([
      buildTarget({ subSubPrincipioId: "ssp-1", subprincipioId: "sub-1", subprincipioTitulo: "Presión alta", rol: "Delantero" }),
      buildTarget({ subSubPrincipioId: "ssp-2", subprincipioId: "sub-2", subprincipioTitulo: "Repliegue", rol: "Lateral" }),
    ]);

    expect(summary).toBe("Presión alta: Delantero.\nRepliegue: Lateral.");
  });

  it("no duplica un rol repetido en distintas Zonas del mismo Subprincipio", () => {
    const summary = summarizeTargetsForObjetivo([
      buildTarget({ subSubPrincipioId: "ssp-1", subprincipioId: "sub-1", subprincipioTitulo: "Presión alta", rol: "Central", zonaId: "z1", zonaLabel: "Zona A" }),
      buildTarget({ subSubPrincipioId: "ssp-2", subprincipioId: "sub-1", subprincipioTitulo: "Presión alta", rol: "Central", zonaId: "z2", zonaLabel: "Zona B" }),
    ]);

    expect(summary).toBe("Presión alta: Central.");
  });
});
