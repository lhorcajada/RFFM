import { describe, it, expect, beforeEach, afterEach } from "vitest";
import i18next from "../../i18n/i18n";
import { mapApiErrorToMessage, getErrorMessage } from "../errorMessages";

describe("errorMessages", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("es");
  });

  afterEach(async () => {
    await i18next.changeLanguage("es");
  });

  it("maps a known backend code to the Spanish message by default", () => {
    const message = mapApiErrorToMessage({
      response: { data: { code: "EmailIsAlreadyTaken" } },
    });

    expect(message).toBe(
      "El correo electrónico ya está registrado. Usa otro o inicia sesión."
    );
  });

  it("maps a known backend code to the English message when language changes", async () => {
    await i18next.changeLanguage("en");

    const message = mapApiErrorToMessage({
      response: { data: { code: "EmailIsAlreadyTaken" } },
    });

    expect(message).toBe(
      "This email is already registered. Use a different one or sign in."
    );
  });

  it("falls back to the detail text when the code is unknown", () => {
    const message = mapApiErrorToMessage({
      response: {
        data: { code: "SomeBrandNewCode", detail: "Texto del backend" },
      },
    });

    expect(message).toBe("Texto del backend");
  });

  it("falls back to a generic message when there is no code or detail", () => {
    const message = mapApiErrorToMessage({ response: { data: {} } });

    expect(message).toBe(
      "Ha ocurrido un error inesperado. Por favor, intenta de nuevo."
    );
  });

  it("maps network errors", () => {
    const message = mapApiErrorToMessage({
      code: "ERR_NETWORK",
      message: "Network Error",
    });

    expect(message).toBe(
      "Ha habido un problema de conexión. Verifica tu conexión a internet."
    );
  });

  it("maps timeout errors", () => {
    const message = mapApiErrorToMessage({ code: "ECONNABORTED" });

    expect(message).toBe(
      "La solicitud tardó demasiado. Por favor, intenta de nuevo."
    );
  });

  it("getErrorMessage returns the localized text for a known snake_case code", () => {
    expect(getErrorMessage("team_has_players")).toBe(
      "No puedes eliminar el equipo porque todavía tiene jugadores asignados."
    );
  });
});
