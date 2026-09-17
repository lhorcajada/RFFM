import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyDocumentUploadDialog from "../MyDocumentUploadDialog";

const mockUploadPlayerDocument = vi.fn();
const mockMapPlayerDocumentError = vi.fn((code) => ({
  message: "Archivo no válido. Debe ser un PDF, JPG o PNG.",
  severity: "warning" as const,
}));

vi.mock("../../../../services/playerDocumentService", () => ({
  uploadPlayerDocument: (...args: unknown[]) => mockUploadPlayerDocument(...args),
  mapPlayerDocumentError: (...args: unknown[]) => mockMapPlayerDocumentError(...args),
}));

describe("MyDocumentUploadDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with title and buttons when open", () => {
    render(
      <MyDocumentUploadDialog
        open={true}
        onClose={vi.fn()}
        teamPlayerId="tp1"
        documentTypeId="dt1"
        onUploaded={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: /subir documento/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seleccionar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("does not render dialog when open is false", () => {
    render(
      <MyDocumentUploadDialog
        open={false}
        onClose={vi.fn()}
        teamPlayerId="tp1"
        documentTypeId="dt1"
        onUploaded={vi.fn()}
      />
    );

    expect(screen.queryByRole("heading", { name: /subir documento/i })).not.toBeInTheDocument();
  });

  it("calls uploadPlayerDocument on valid file selection", async () => {
    const user = userEvent.setup();
    const mockOnUploaded = vi.fn();
    mockUploadPlayerDocument.mockResolvedValue({ documentTypeId: "dt1" });
    mockMapPlayerDocumentError.mockReturnValue({
      message: "Error",
      severity: "error" as const,
    });

    render(
      <MyDocumentUploadDialog
        open={true}
        onClose={vi.fn()}
        teamPlayerId="tp1"
        documentTypeId="dt1"
        onUploaded={mockOnUploaded}
      />
    );

    const button = screen.getByRole("button", { name: /seleccionar/i });
    const fileInput = button.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      const file = new File(["pdf content"], "doc.pdf", { type: "application/pdf" });
      await user.upload(fileInput, file);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockUploadPlayerDocument).toHaveBeenCalledWith("tp1", "dt1", file);
    }
  });

  it("calls onUploaded callback on successful upload", async () => {
    const user = userEvent.setup();
    const mockOnUploaded = vi.fn();
    mockUploadPlayerDocument.mockResolvedValue({ documentTypeId: "dt1" });

    render(
      <MyDocumentUploadDialog
        open={true}
        onClose={vi.fn()}
        teamPlayerId="tp1"
        documentTypeId="dt1"
        onUploaded={mockOnUploaded}
      />
    );

    const button = screen.getByRole("button", { name: /seleccionar/i });
    const fileInput = button.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
      await user.upload(fileInput, file);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockOnUploaded).toHaveBeenCalled();
    }
  });

  it("dispatches snackbar on upload error", async () => {
    const user = userEvent.setup();
    const mockOnUploaded = vi.fn();
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

    mockUploadPlayerDocument.mockRejectedValue({
      response: { data: { code: "PlayerDocumentInvalidFile" } },
    });

    mockMapPlayerDocumentError.mockReturnValue({
      message: "Archivo no válido. Debe ser un PDF, JPG o PNG.",
      severity: "warning" as const,
    });

    render(
      <MyDocumentUploadDialog
        open={true}
        onClose={vi.fn()}
        teamPlayerId="tp1"
        documentTypeId="dt1"
        onUploaded={mockOnUploaded}
      />
    );

    const button = screen.getByRole("button", { name: /seleccionar/i });
    const fileInput = button.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
      await user.upload(fileInput, file);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that mapPlayerDocumentError was called with the error code
      expect(mockMapPlayerDocumentError).toHaveBeenCalledWith("PlayerDocumentInvalidFile");

      // Check that dispatchEvent was called for snackbar
      const snackbarCalls = dispatchEventSpy.mock.calls.filter(
        (call) => call[0] instanceof CustomEvent && call[0].type === "rffm.show_snackbar"
      );
      expect(snackbarCalls.length).toBeGreaterThan(0);
    }

    dispatchEventSpy.mockRestore();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    render(
      <MyDocumentUploadDialog
        open={true}
        onClose={mockOnClose}
        teamPlayerId="tp1"
        documentTypeId="dt1"
        onUploaded={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /cancelar/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
