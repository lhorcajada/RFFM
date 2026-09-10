import { describe, expect, it } from "vitest";
import {
  buildPendingConfirmationMessage,
  buildWaMeLink,
  type PendingConfirmationEventSummary,
} from "../pendingConfirmationWhatsApp";

const deepLinkUrl = "https://app.rffm.example/coach/attendance/event-1?viewConvocation=1";

describe("buildPendingConfirmationMessage", () => {
  it("incluye tipo de evento, rival, fecha, hora, lugar y el enlace de confirmación", () => {
    const summary: PendingConfirmationEventSummary = {
      eventTypeLabel: "Partido",
      rivalName: "CD Rival",
      dateES: "Domingo, 12 de octubre de 2026",
      time: "10:00",
      location: "Campo Municipal",
    };

    const message = buildPendingConfirmationMessage(summary, "Juanito", deepLinkUrl);

    expect(message).toContain("Juanito");
    expect(message).toContain("Partido vs CD Rival");
    expect(message).toContain("Domingo, 12 de octubre de 2026");
    expect(message).toContain("10:00");
    expect(message).toContain("Campo Municipal");
    expect(message).toContain(deepLinkUrl);
  });

  it("omite el rival cuando no hay rivalName", () => {
    const summary: PendingConfirmationEventSummary = {
      eventTypeLabel: "Entrenamiento",
      rivalName: null,
      dateES: "Martes, 14 de octubre de 2026",
      time: "18:30",
      location: null,
    };

    const message = buildPendingConfirmationMessage(summary, "Ana", deepLinkUrl);

    expect(message).toContain("Entrenamiento");
    expect(message).not.toContain(" vs ");
  });

  it("omite la línea de lugar cuando location es null", () => {
    const summary: PendingConfirmationEventSummary = {
      eventTypeLabel: "Entrenamiento",
      rivalName: null,
      dateES: "Martes, 14 de octubre de 2026",
      time: null,
      location: null,
    };

    const message = buildPendingConfirmationMessage(summary, "Ana", deepLinkUrl);
    const lines = message.split("\n");

    expect(lines.some((l) => l.trim() === "")).toBe(true);
    expect(message).not.toMatch(/undefined|null/);
  });
});

describe("buildWaMeLink", () => {
  it("elimina caracteres no numéricos del teléfono y codifica el mensaje", () => {
    const link = buildWaMeLink("+34 600 12 34 56", "Hola mundo");

    expect(link).toBe(`https://wa.me/34600123456?text=${encodeURIComponent("Hola mundo")}`);
  });

  it("construye la URL con el formato https://wa.me/<digitos>?text=...", () => {
    const link = buildWaMeLink("(34) 600-123-456", "Confirma tu asistencia");

    expect(link.startsWith("https://wa.me/34600123456?text=")).toBe(true);
  });
});
