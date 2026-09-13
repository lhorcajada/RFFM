import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetInjuryProtocol = vi.fn();
const mockUploadAttachment = vi.fn();
const mockDeleteAttachment = vi.fn();
vi.mock("../../../../services/injuryProtocolService", () => ({
  getInjuryProtocol: (...args: unknown[]) => mockGetInjuryProtocol(...args),
  uploadInjuryProtocolAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
  deleteInjuryProtocolAttachment: (...args: unknown[]) => mockDeleteAttachment(...args),
}));

const mockFetchPublicStorageFile = vi.fn();
vi.mock("../../../../../../shared/services/imageService", () => ({
  fetchPublicStorageFile: (...args: unknown[]) => mockFetchPublicStorageFile(...args),
}));

import InjuryProtocolDocuments from "../InjuryProtocolDocuments";

const attachments = [
  {
    id: "att-1",
    fileName: "protocolo.pdf",
    url: "injury-protocol-attachments/team-1/protocolo.pdf",
    uploadedAt: "2026-01-01T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInjuryProtocol.mockResolvedValue({
    teamId: "team-1",
    content: null,
    updatedAt: null,
    attachments,
  });
  mockFetchPublicStorageFile.mockResolvedValue("blob:mock-object-url");
});

describe("InjuryProtocolDocuments", () => {
  it("todos los roles ven un botón de descarga que fuerza la descarga del PDF", async () => {
    render(<InjuryProtocolDocuments teamId="team-1" isCoach={false} />);

    const { default: userEvent } = await import("@testing-library/user-event");
    const downloadButton = await screen.findByRole("button", {
      name: /descargar protocolo\.pdf/i,
    });
    await userEvent.click(downloadButton);

    await waitFor(() =>
      expect(mockFetchPublicStorageFile).toHaveBeenCalledWith(
        "injury-protocol-attachments/team-1/protocolo.pdf"
      )
    );
  });

  it("un rol distinto de coach no ve controles de subida ni de eliminación", async () => {
    render(<InjuryProtocolDocuments teamId="team-1" isCoach={false} />);

    await screen.findByRole("button", { name: /descargar protocolo\.pdf/i });

    expect(
      screen.queryByRole("button", { name: /subir documento/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it("un coach ve los controles de subida y eliminación", async () => {
    render(<InjuryProtocolDocuments teamId="team-1" isCoach={true} />);

    await screen.findByRole("button", { name: /descargar protocolo\.pdf/i });

    expect(
      screen.getByRole("button", { name: /subir documento/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay documentos", async () => {
    mockGetInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: null,
      updatedAt: null,
      attachments: [],
    });

    render(<InjuryProtocolDocuments teamId="team-1" isCoach={false} />);

    await waitFor(() =>
      expect(screen.getByText(/no hay documentos/i)).toBeInTheDocument()
    );
  });

  it("rechaza en el cliente un fichero que no sea PDF sin llamar al servicio", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<InjuryProtocolDocuments teamId="team-1" isCoach={true} />);

    await screen.findByRole("button", { name: /descargar protocolo.pdf/i });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["contenido"], "imagen.png", { type: "image/png" });
    await userEvent.upload(input, badFile);

    expect(mockUploadAttachment).not.toHaveBeenCalled();
    expect(await screen.findByText(/solo se admiten ficheros pdf/i)).toBeInTheDocument();
  });

  it("sube un PDF válido llamando al servicio y refresca la lista", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockUploadAttachment.mockResolvedValue({
      id: "att-2",
      fileName: "nuevo.pdf",
      url: "https://storage/nuevo.pdf",
      uploadedAt: "2026-01-05T00:00:00Z",
    });

    render(<InjuryProtocolDocuments teamId="team-1" isCoach={true} />);

    await screen.findByRole("button", { name: /descargar protocolo.pdf/i });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = new File(["contenido"], "nuevo.pdf", { type: "application/pdf" });
    await userEvent.upload(input, goodFile);

    await waitFor(() =>
      expect(mockUploadAttachment).toHaveBeenCalledWith("team-1", goodFile)
    );
  });

  it("eliminar un documento usa un ConfirmDialog antes de llamar al servicio", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockDeleteAttachment.mockResolvedValue(undefined);

    render(<InjuryProtocolDocuments teamId="team-1" isCoach={true} />);

    const deleteButton = await screen.findByRole("button", { name: /eliminar/i });
    await userEvent.click(deleteButton);

    expect(mockDeleteAttachment).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: /^eliminar$/i });
    await userEvent.click(confirmButton);

    await waitFor(() =>
      expect(mockDeleteAttachment).toHaveBeenCalledWith("team-1", "att-1")
    );
  });
});
