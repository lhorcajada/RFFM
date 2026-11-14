import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FederationActaTab from "../FederationActaTab";

vi.mock("../../../../services/matchReportService", () => ({
  getEventFederationActa: vi.fn().mockResolvedValue({
    equipo_local: "CD Local",
    equipo_visitante: "CF Visitante",
    fecha: "2026-11-14",
    jugadores_equipo_local: [],
    jugadores_equipo_visitante: [],
  }),
}));

vi.mock("../../../../../../shared/services/pdfService", () => ({
  exportElementToPdf: vi.fn().mockResolvedValue(undefined),
}));

import { exportElementToPdf } from "../../../../../../shared/services/pdfService";

describe("FederationActaTab — descarga en PDF", () => {
  beforeEach(() => {
    vi.mocked(exportElementToPdf).mockClear();
  });

  it("al pulsar «Descargar PDF» exporta el acta con un nombre de archivo con los equipos", async () => {
    render(<FederationActaTab eventId="e1" />);

    await userEvent.click(await screen.findByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => expect(exportElementToPdf).toHaveBeenCalledTimes(1));
    const [element, fileName] = vi.mocked(exportElementToPdf).mock.calls[0];
    expect(element).toBeInstanceOf(HTMLElement);
    expect(fileName).toBe("Acta CD Local - CF Visitante.pdf");
  });

  it("si falla la generación del PDF avisa con un mensaje de error", async () => {
    vi.mocked(exportElementToPdf).mockRejectedValueOnce(new Error("boom"));
    const messages: string[] = [];
    const listener = (e: Event) => messages.push((e as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener("rffm.show_snackbar", listener);
    render(<FederationActaTab eventId="e1" />);

    await userEvent.click(await screen.findByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => expect(messages).toContain("No se ha podido generar el PDF del acta."));
    window.removeEventListener("rffm.show_snackbar", listener);
  });
});
