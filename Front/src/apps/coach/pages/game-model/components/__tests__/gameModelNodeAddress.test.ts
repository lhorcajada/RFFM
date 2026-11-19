import { describe, expect, it } from "vitest";
import {
  habilidadAddress,
  notaAddress,
  phaseAddress,
  principleAddress,
  setPieceRuleAddress,
  SET_PIECES_ADDRESS,
  subprincipioAddress,
  subSubPrincipioAddress,
  zonaAddress,
} from "../gameModelNodeAddress";

describe("gameModelNodeAddress — clave estable cuando la entidad la expone", () => {
  it("usa la clave del principio, subprincipio, zona y sub-subprincipio si existe", () => {
    expect(principleAddress({ key: "defensa-organizada-1", gameMomentId: 1, numero: 1 })).toBe("defensa-organizada-1");
    expect(subprincipioAddress({ key: "defensa-organizada-1.1", numero: "1.1" }, "defensa-organizada-1")).toBe(
      "defensa-organizada-1.1"
    );
    expect(
      zonaAddress({ key: "defensa-organizada-1.1-finalizacion", zoneKeys: ["finalizacion"] }, "defensa-organizada-1.1")
    ).toBe("defensa-organizada-1.1-finalizacion");
    expect(subSubPrincipioAddress({ key: "defensa-organizada-1.1.1", numero: "1.1.1" }, "x")).toBe(
      "defensa-organizada-1.1.1"
    );
  });
});

describe("gameModelNodeAddress — ruta numérica jerárquica cuando no hay clave", () => {
  it("encadena fase, principio, subprincipio y sub-subprincipio", () => {
    const phase = phaseAddress(2);
    const principle = principleAddress({ gameMomentId: 2, numero: 1 });
    const sub = subprincipioAddress({ numero: "1.1" }, principle);
    const ssp = subSubPrincipioAddress({ numero: "1.1.1" }, sub);

    expect(phase).toBe("moment-2");
    expect(principle).toBe("moment-2/1");
    expect(sub).toBe("moment-2/1/1.1");
    expect(ssp).toBe("moment-2/1/1.1/1.1.1");
  });

  it("distingue las zonas de un mismo subprincipio por sus zonas y etiqueta", () => {
    const sub = "moment-1/1/1.1";

    expect(zonaAddress({ zoneKeys: ["iniciacion", "creacion-propia"] }, sub)).toBe(
      "moment-1/1/1.1/zona:iniciacion+creacion-propia"
    );
    expect(zonaAddress({ zoneKeys: ["finalizacion"], label: "Ataque del centro" }, sub)).toBe(
      "moment-1/1/1.1/zona:finalizacion:Ataque del centro"
    );
  });
});

describe("gameModelNodeAddress — nodos sin clave propia", () => {
  it("direcciona habilidades y notas por su id de API colgando del padre", () => {
    expect(habilidadAddress({ id: 3, apiId: "hab-uuid" }, "ssp")).toBe("ssp/hab:hab-uuid");
    expect(habilidadAddress({ id: -2 }, "ssp")).toBe("ssp/hab:-2");
    expect(notaAddress({ id: 1, apiId: "nota-uuid" }, "zona")).toBe("zona/nota:nota-uuid");
  });

  it("direcciona las reglas de balón parado bajo la sección de balón parado", () => {
    expect(setPieceRuleAddress({ id: 1, apiId: "spr-1" })).toBe(`${SET_PIECES_ADDRESS}/spr-1`);
  });
});
