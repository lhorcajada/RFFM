import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentZipButton from "../DocumentZipButton";

const mockDownloadTeamDocumentsZip = vi.fn();

vi.mock("../../../../services/playerDocumentService", () => ({
  downloadTeamDocumentsZip: (...args: unknown[]) => mockDownloadTeamDocumentsZip(...args),
  mapPlayerDocumentError: vi.fn(() => ({ message: "Error", severity: "error" as const })),
}));

describe("DocumentZipButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("downloads the zip when clicked", async () => {
    const blob = new Blob(["zip-content"], { type: "application/zip" });
    mockDownloadTeamDocumentsZip.mockResolvedValue(blob);

    render(<DocumentZipButton teamId="t1" documentTypeId="dt1" />);

    await userEvent.click(screen.getByRole("button", { name: /descargar zip/i }));

    await waitFor(() => {
      expect(mockDownloadTeamDocumentsZip).toHaveBeenCalledWith("t1", "dt1");
    });
  });

  it("shows an error snackbar when the download fails", async () => {
    mockDownloadTeamDocumentsZip.mockRejectedValue({ response: { data: { code: "SomeError" } } });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<DocumentZipButton teamId="t1" documentTypeId="dt1" />);

    await userEvent.click(screen.getByRole("button", { name: /descargar zip/i }));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "rffm.show_snackbar" })
      );
    });
  });

  it("renders as an icon-only button with an accessible label when iconOnly is set", () => {
    render(<DocumentZipButton teamId="t1" documentTypeId="dt1" iconOnly />);

    const button = screen.getByRole("button", { name: /descargar zip/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveTextContent("Descargar ZIP");
  });
});
