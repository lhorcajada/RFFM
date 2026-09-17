import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentReportButton from "../DocumentReportButton";

const mockDownloadTeamDocumentsReport = vi.fn();

vi.mock("../../../../services/playerDocumentService", () => ({
  downloadTeamDocumentsReport: (...args: unknown[]) => mockDownloadTeamDocumentsReport(...args),
  mapPlayerDocumentError: vi.fn(() => ({ message: "Error", severity: "error" as const })),
}));

describe("DocumentReportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("downloads the report when clicked", async () => {
    const blob = new Blob(["pdf-content"], { type: "application/pdf" });
    mockDownloadTeamDocumentsReport.mockResolvedValue(blob);

    render(<DocumentReportButton teamId="t1" documentTypeId="dt1" />);

    await userEvent.click(screen.getByRole("button", { name: /descargar informe/i }));

    await waitFor(() => {
      expect(mockDownloadTeamDocumentsReport).toHaveBeenCalledWith("t1", "dt1");
    });
  });

  it("renders as an icon-only button with an accessible label when iconOnly is set", () => {
    render(<DocumentReportButton teamId="t1" documentTypeId="dt1" iconOnly />);

    const button = screen.getByRole("button", { name: /descargar informe/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveTextContent("Descargar informe");
  });
});
