import { describe, expect, it } from "vitest";
import { resolveGreetingName } from "../useGreetingName";

describe("resolveGreetingName", () => {
  it("usa el nombre de pila cuando el usuario lo tiene", () => {
    expect(resolveGreetingName({ username: "lhorca", firstName: "Lucía" })).toBe("Lucía");
  });

  it("usa el alias cuando no hay nombre de pila", () => {
    expect(resolveGreetingName({ username: "lhorca" })).toBe("lhorca");
  });

  it("no usa el alias cuando parece un email", () => {
    expect(resolveGreetingName({ username: "ana@club.es" })).toBeNull();
  });

  it("devuelve null cuando no hay usuario", () => {
    expect(resolveGreetingName(null)).toBeNull();
  });

  it("ignora un nombre de pila vacío y recurre al alias", () => {
    expect(resolveGreetingName({ username: "lhorca", firstName: "  " })).toBe("lhorca");
  });
});
