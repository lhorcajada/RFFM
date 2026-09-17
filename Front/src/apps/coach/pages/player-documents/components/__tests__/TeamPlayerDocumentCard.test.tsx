import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamPlayerDocumentCard from "../TeamPlayerDocumentCard";
import type { TeamPlayerDocumentStatusResponse } from "../../../../services/playerDocumentService";
import defaultAvatar from "../../../../../../assets/avatar.svg";

const mockDeletePlayerDocument = vi.fn();

vi.mock("../../../../services/playerDocumentService", () => ({
  uploadPlayerDocument: vi.fn().mockResolvedValue({}),
  deletePlayerDocument: (...args: unknown[]) => mockDeletePlayerDocument(...args),
  reviewPlayerDocument: vi.fn().mockResolvedValue({}),
  mapPlayerDocumentError: vi.fn(() => ({ message: "Error", severity: "error" as const })),
}));

const pendingRow: TeamPlayerDocumentStatusResponse = {
  teamPlayerId: "tp1",
  playerId: "p1",
  playerName: "John Doe",
  alias: "Johnny",
  urlPhoto: null,
  dorsal: 10,
  status: "Pending",
  uploadedAt: null,
  reviewedAt: null,
};

const deliveredRow: TeamPlayerDocumentStatusResponse = {
  ...pendingRow,
  status: "Delivered",
  uploadedAt: "2026-09-17T08:00:00Z",
};

const approvedRow: TeamPlayerDocumentStatusResponse = {
  ...pendingRow,
  status: "Approved",
  uploadedAt: "2026-09-17T08:00:00Z",
  reviewedAt: "2026-09-17T09:00:00Z",
};

describe("TeamPlayerDocumentCard", () => {
  const mockOnChanged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an upload-on-behalf icon button and no approve/reject/delete when Pending", () => {
    render(
      <TeamPlayerDocumentCard row={pendingRow} documentTypeId="dt1" teamId="t1" onChanged={mockOnChanged} />
    );

    expect(screen.getByRole("button", { name: "Subir en nombre del jugador" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar documento" })).not.toBeInTheDocument();
  });

  it("shows the player's alias instead of their full name", () => {
    render(
      <TeamPlayerDocumentCard row={pendingRow} documentTypeId="dt1" teamId="t1" onChanged={mockOnChanged} />
    );

    expect(screen.getByText("Johnny")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("shows the player's photo when urlPhoto is set", () => {
    render(
      <TeamPlayerDocumentCard
        row={{ ...pendingRow, urlPhoto: "https://example.com/photo.jpg" }}
        documentTypeId="dt1"
        teamId="t1"
        onChanged={mockOnChanged}
        photoSrc="blob:mock-photo"
      />
    );

    const img = screen.getByAltText("Johnny") as HTMLImageElement;
    expect(img.src).toBe("blob:mock-photo");
  });

  it("falls back to the default avatar when there is no photo", () => {
    render(
      <TeamPlayerDocumentCard row={pendingRow} documentTypeId="dt1" teamId="t1" onChanged={mockOnChanged} />
    );

    const img = screen.getByAltText("Johnny") as HTMLImageElement;
    expect(img.src).toBe(defaultAvatar);
  });

  it("shows update, approve, reject and delete icon buttons when Delivered", () => {
    render(
      <TeamPlayerDocumentCard row={deliveredRow} documentTypeId="dt1" teamId="t1" onChanged={mockOnChanged} />
    );

    expect(screen.getByRole("button", { name: "Actualizar documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar documento" })).toBeInTheDocument();
  });

  it("shows update and delete but no approve/reject when Approved", () => {
    render(
      <TeamPlayerDocumentCard row={approvedRow} documentTypeId="dt1" teamId="t1" onChanged={mockOnChanged} />
    );

    expect(screen.getByRole("button", { name: "Actualizar documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar documento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
  });

  it("deletes the document after confirming the dialog", async () => {
    mockDeletePlayerDocument.mockResolvedValue(undefined);

    render(
      <TeamPlayerDocumentCard row={approvedRow} documentTypeId="dt1" teamId="t1" onChanged={mockOnChanged} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar documento" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeletePlayerDocument).toHaveBeenCalledWith("tp1", "dt1");
      expect(mockOnChanged).toHaveBeenCalled();
    });
  });
});
