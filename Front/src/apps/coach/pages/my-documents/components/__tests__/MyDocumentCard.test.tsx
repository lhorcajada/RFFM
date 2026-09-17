import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyDocumentCard from "../MyDocumentCard";
import type { PlayerDocumentResponse } from "../../../../services/playerDocumentService";

vi.mock("../../../../../shared/services/imageService", () => ({
  fetchPublicStorageFile: vi.fn().mockResolvedValue("blob:mock-url"),
}));

const mockDeletePlayerDocument = vi.fn();

vi.mock("../../../../services/playerDocumentService", () => ({
  uploadPlayerDocument: vi.fn().mockResolvedValue({}),
  deletePlayerDocument: (...args: unknown[]) => mockDeletePlayerDocument(...args),
  mapPlayerDocumentError: vi.fn(() => ({
    message: "Error",
    severity: "error" as const,
  })),
}));

const pendingDoc: PlayerDocumentResponse = {
  documentTypeId: "dt1",
  documentTypeName: "Authorization",
  teamPlayerId: "tp1",
  status: "Pending",
  fileName: null,
  url: null,
  contentType: null,
  uploadedAt: null,
  uploadedOnBehalf: null,
  reviewedAt: null,
  reviewNote: null,
};

const rejectedDocWithFile: PlayerDocumentResponse = {
  documentTypeId: "dt1",
  documentTypeName: "Authorization",
  teamPlayerId: "tp1",
  status: "Rejected",
  fileName: "auth.pdf",
  url: "http://example.com/auth.pdf",
  contentType: "application/pdf",
  uploadedAt: "2026-09-17T08:00:00Z",
  uploadedOnBehalf: false,
  reviewedAt: "2026-09-17T09:00:00Z",
  reviewNote: "Not clear",
};

describe("MyDocumentCard", () => {
  const mockOnUploaded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders document status chip with the correct status", () => {
    render(<MyDocumentCard document={pendingDoc} teamPlayerId="tp1" onUploaded={mockOnUploaded} />);

    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Authorization")).toBeInTheDocument();
  });

  it("shows an upload icon button when there is no file yet", () => {
    render(<MyDocumentCard document={pendingDoc} teamPlayerId="tp1" onUploaded={mockOnUploaded} />);

    expect(screen.getByRole("button", { name: "Subir documento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar documento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar documento" })).not.toBeInTheDocument();
  });

  it("shows update, download and delete icon buttons when a file exists", () => {
    render(<MyDocumentCard document={rejectedDocWithFile} teamPlayerId="tp1" onUploaded={mockOnUploaded} />);

    expect(screen.getByRole("button", { name: "Actualizar documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar documento" })).toBeInTheDocument();
  });

  it("shows re-upload notice when opening the upload dialog for a Rejected document", async () => {
    render(<MyDocumentCard document={rejectedDocWithFile} teamPlayerId="tp1" onUploaded={mockOnUploaded} />);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar documento" }));

    expect(
      screen.getByText(
        "Al subir un nuevo archivo, el documento volverá a estado 'Entregado' y deberá revisarse de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("deletes the document after confirming the dialog", async () => {
    mockDeletePlayerDocument.mockResolvedValue(undefined);

    render(<MyDocumentCard document={rejectedDocWithFile} teamPlayerId="tp1" onUploaded={mockOnUploaded} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar documento" }));
    expect(screen.getByText(/seguro que quieres eliminar/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeletePlayerDocument).toHaveBeenCalledWith("tp1", "dt1");
      expect(mockOnUploaded).toHaveBeenCalled();
    });
  });

  it("does not delete when cancelling the confirmation dialog", async () => {
    render(<MyDocumentCard document={rejectedDocWithFile} teamPlayerId="tp1" onUploaded={mockOnUploaded} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar documento" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mockDeletePlayerDocument).not.toHaveBeenCalled();
  });
});
