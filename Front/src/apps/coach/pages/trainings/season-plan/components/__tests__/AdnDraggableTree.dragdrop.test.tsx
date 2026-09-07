import { describe, expect, it } from "vitest";
import { dedupeById, describeDragPayload, flattenSubprincipioTargets, summarizeTexto, toTargetDetail } from "../dragPayload";
import type { Principle, Subprincipio, SubSubPrincipio, Zona } from "../../../../types/gameModel";

function buildPrinciple(overrides: Partial<Principle> = {}): Principle {
  return {
    id: 1,
    apiId: "principle-1",
    gameMomentId: 1,
    gameMomentName: "Fase defensiva",
    numero: 1,
    titulo: "Defensa organizada",
    texto: "",
    subprincipios: [],
    notas: [],
    ...overrides,
  };
}

function buildSubprincipio(overrides: Partial<Subprincipio> = {}): Subprincipio {
  return {
    id: 1,
    apiId: "sub-1",
    numero: "1.1",
    titulo: "Presión alta",
    texto: "",
    zonas: [],
    subSubPrincipios: [],
    notas: [],
    ...overrides,
  };
}

function buildSsp(overrides: Partial<SubSubPrincipio> = {}): SubSubPrincipio {
  return {
    id: 1,
    apiId: "ssp-1",
    numero: "1.1.1",
    rol: "Central",
    texto: "",
    habilidades: [],
    notas: [],
    ...overrides,
  };
}

function buildZona(overrides: Partial<Zona> = {}): Zona {
  return {
    id: 1,
    apiId: "zona-1",
    zoneKeys: ["iniciacion"],
    label: null,
    zonaTexto: null,
    texto: "",
    subSubPrincipios: [],
    notas: [],
    ...overrides,
  };
}

describe("toTargetDetail", () => {
  it("construye el breadcrumb completo para un SubSubPrincipio directo (sin Zona)", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio();
    const ssp = buildSsp();

    const result = toTargetDetail(ssp, { principle, sp, zona: null });

    expect(result).toEqual({
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
    });
  });

  it("incluye el id/label de la Zona cuando el SubSubPrincipio cuelga de una Zona", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio();
    const zona = buildZona({ label: "Ataque del centro" });
    const ssp = buildSsp();

    const result = toTargetDetail(ssp, { principle, sp, zona });

    expect(result.zonaId).toBe("zona-1");
    expect(result.zonaLabel).toBe("Ataque del centro");
  });
});

describe("flattenSubprincipioTargets", () => {
  it("aplana los SubSubPrincipios directos cuando el Subprincipio no tiene Zonas", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio({
      subSubPrincipios: [buildSsp({ apiId: "ssp-1" }), buildSsp({ apiId: "ssp-2", numero: "1.1.2" })],
    });

    const result = flattenSubprincipioTargets(sp, { principle });

    expect(result.map((t) => t.subSubPrincipioId)).toEqual(["ssp-1", "ssp-2"]);
    expect(result.every((t) => t.zonaId === null)).toBe(true);
  });

  it("aplana los SubSubPrincipios a través de todas las Zonas cuando el Subprincipio tiene Zonas", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio({
      zonas: [
        buildZona({ apiId: "zona-1", subSubPrincipios: [buildSsp({ apiId: "ssp-1" })] }),
        buildZona({ apiId: "zona-2", subSubPrincipios: [buildSsp({ apiId: "ssp-2", numero: "1.1.2" })] }),
      ],
    });

    const result = flattenSubprincipioTargets(sp, { principle });

    expect(result.map((t) => t.subSubPrincipioId)).toEqual(["ssp-1", "ssp-2"]);
    expect(result.map((t) => t.zonaId)).toEqual(["zona-1", "zona-2"]);
  });

  it("devuelve un único target cuando el Subprincipio tiene un solo SubSubPrincipio directo", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio({ subSubPrincipios: [buildSsp()] });

    const result = flattenSubprincipioTargets(sp, { principle });

    expect(result).toHaveLength(1);
    expect(result[0].subSubPrincipioId).toBe("ssp-1");
  });
});

describe("dedupeById", () => {
  it("elimina duplicados por subSubPrincipioId conservando la primera aparición", () => {
    const a = toTargetDetail(buildSsp({ apiId: "ssp-1" }), { principle: buildPrinciple(), sp: buildSubprincipio(), zona: null });
    const b = toTargetDetail(buildSsp({ apiId: "ssp-1", rol: "Lateral" }), { principle: buildPrinciple(), sp: buildSubprincipio(), zona: null });
    const c = toTargetDetail(buildSsp({ apiId: "ssp-2" }), { principle: buildPrinciple(), sp: buildSubprincipio(), zona: null });

    const result = dedupeById([a, b, c]);

    expect(result).toHaveLength(2);
    expect(result[0].rol).toBe("Central");
    expect(result.map((t) => t.subSubPrincipioId)).toEqual(["ssp-1", "ssp-2"]);
  });
});

describe("summarizeTexto", () => {
  it("devuelve la primera frase completa cuando cabe dentro del límite", () => {
    const result = summarizeTexto("Presión al central. Cortando línea de pase al portero.", 60);

    expect(result).toBe("Presión al central.");
  });

  it("devuelve el texto tal cual cuando ya cabe y no tiene puntuación", () => {
    const result = summarizeTexto("Presión al central cortando la línea de pase", 60);

    expect(result).toBe("Presión al central cortando la línea de pase");
  });

  it("recorta por palabra completa y añade elipsis cuando el texto excede el límite", () => {
    const long =
      "Presión al central cortando la línea de pase al portero para forzar el error en la salida de balón";

    const result = summarizeTexto(long, 40);

    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it("devuelve cadena vacía cuando el texto está vacío o solo tiene espacios", () => {
    expect(summarizeTexto("")).toBe("");
    expect(summarizeTexto("   ")).toBe("");
  });
});

describe("describeDragPayload", () => {
  it("devuelve el breadcrumb completo (con Zona) para un payload de un único sub-subprincipio", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio();
    const zona = buildZona({ label: "Ataque del centro" });
    const target = toTargetDetail(buildSsp({ rol: "Delantero" }), { principle, sp, zona });

    const result = describeDragPayload({ kind: "subsubprincipio", targets: [target] });

    expect(result).toEqual(["Fase defensiva", "Defensa organizada", "Presión alta", "Ataque del centro", "Delantero (1.1.1)"]);
  });

  it("omite el segmento de Zona cuando el sub-subprincipio no cuelga de una Zona", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio();
    const target = toTargetDetail(buildSsp({ rol: "Delantero" }), { principle, sp, zona: null });

    const result = describeDragPayload({ kind: "subsubprincipio", targets: [target] });

    expect(result).toEqual(["Fase defensiva", "Defensa organizada", "Presión alta", "Delantero (1.1.1)"]);
  });

  it("resume un payload de Subprincipio como el prefijo compartido más el recuento de sub-subprincipios", () => {
    const principle = buildPrinciple();
    const sp = buildSubprincipio();
    const targets = [
      toTargetDetail(buildSsp({ apiId: "ssp-1" }), { principle, sp, zona: null }),
      toTargetDetail(buildSsp({ apiId: "ssp-2", numero: "1.1.2" }), { principle, sp, zona: null }),
    ];

    const result = describeDragPayload({ kind: "subprincipio", targets });

    expect(result).toEqual(["Fase defensiva", "Defensa organizada", "Presión alta", "2 sub-subprincipios"]);
  });

  it("devuelve un array vacío cuando no hay targets", () => {
    expect(describeDragPayload({ kind: "subsubprincipio", targets: [] })).toEqual([]);
  });
});
