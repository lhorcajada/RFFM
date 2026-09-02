import { describe, expect, it, beforeEach } from "vitest";
import {
  buildWhatsAppMessage,
  getFamilyMemberCredentials,
  saveFamilyMemberCredentials,
  type FamilyMemberCredentials,
} from "../familyMemberCredentials";

describe("familyMemberCredentials", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guarda y recupera las credenciales de un familiar por su id", () => {
    const credentials: FamilyMemberCredentials = {
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    };

    saveFamilyMemberCredentials("fm-1", credentials);

    expect(getFamilyMemberCredentials("fm-1")).toEqual(credentials);
  });

  it("devuelve null cuando no hay credenciales guardadas para ese familiar", () => {
    expect(getFamilyMemberCredentials("fm-does-not-exist")).toBeNull();
  });

  it("no mezcla las credenciales de dos familiares distintos", () => {
    const credentialsA: FamilyMemberCredentials = {
      requestId: "req-a",
      alias: "familiara",
      password: "Pass1!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    };
    const credentialsB: FamilyMemberCredentials = {
      requestId: "req-b",
      alias: "familiarb",
      password: "Pass2!",
      familyMemberName: "Luis",
      playerName: "Pedro",
    };

    saveFamilyMemberCredentials("fm-a", credentialsA);
    saveFamilyMemberCredentials("fm-b", credentialsB);

    expect(getFamilyMemberCredentials("fm-a")).toEqual(credentialsA);
    expect(getFamilyMemberCredentials("fm-b")).toEqual(credentialsB);
  });

  it("construye el mensaje de WhatsApp con la plantilla exacta acordada", () => {
    const credentials: FamilyMemberCredentials = {
      requestId: "req-1",
      alias: "anagarcia",
      password: "Pedro1234!",
      familyMemberName: "Ana",
      playerName: "Pedro",
    };

    const message = buildWhatsAppMessage(credentials);

    expect(message).toBe(
      "Hola Ana!\n\nYa tienes creada tu cuenta en la app de Fútbol Base para seguir a Pedro.\n\nUsuario: anagarcia\nContraseña: Pedro1234!\n\n¡Un saludo!"
    );
  });
});
