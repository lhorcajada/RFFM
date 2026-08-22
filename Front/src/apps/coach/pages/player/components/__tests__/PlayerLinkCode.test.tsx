import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PlayerLinkCode from "../PlayerLinkCode";
import * as teamplayerService from "../../../../services/teamplayerService";

vi.mock("../../../../services/teamplayerService", () => ({
  getTeamPlayerLinkCode: vi.fn(),
  regenerateTeamPlayerLinkCode: vi.fn(),
}));

vi.mock("../../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog", () => ({
  default: ({ open, onConfirm, onCancel, title, description, processing }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} disabled={processing}>
          Confirm
        </button>
      </div>
    ) : null,
}));

describe("PlayerLinkCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(teamplayerService.getTeamPlayerLinkCode).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<PlayerLinkCode teamPlayerId="player1" />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("displays the link code after loading", async () => {
    vi.mocked(teamplayerService.getTeamPlayerLinkCode).mockResolvedValue({
      teamPlayerId: "player1",
      linkCode: "ABC12345",
    });

    render(<PlayerLinkCode teamPlayerId="player1" />);

    await waitFor(() => {
      expect(screen.getByText("ABC12345")).toBeInTheDocument();
    });
  });

  it("copy button copies code to clipboard", async () => {
    vi.mocked(teamplayerService.getTeamPlayerLinkCode).mockResolvedValue({
      teamPlayerId: "player1",
      linkCode: "ABC12345",
    });

    const clipboardSpy = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<PlayerLinkCode teamPlayerId="player1" />);

    await waitFor(() => {
      expect(screen.getByText("ABC12345")).toBeInTheDocument();
    });

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardSpy },
      configurable: true,
      writable: true,
    });

    const copyButton = screen.getByRole("button", { name: /Copiar código/i });
    await user.click(copyButton);

    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledWith("ABC12345");
    });
  });

  it("regenerate button opens confirm dialog", async () => {
    vi.mocked(teamplayerService.getTeamPlayerLinkCode).mockResolvedValue({
      teamPlayerId: "player1",
      linkCode: "ABC12345",
    });

    const user = userEvent.setup();
    render(<PlayerLinkCode teamPlayerId="player1" />);

    await waitFor(() => {
      expect(screen.getByText("ABC12345")).toBeInTheDocument();
    });

    const regenerateButton = screen.getByRole("button", { name: /Regenerar código/i });
    await user.click(regenerateButton);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      expect(screen.getByText(/¿Regenerar el código/)).toBeInTheDocument();
    });
  });

  it("regenerate confirms and updates code", async () => {
    vi.mocked(teamplayerService.getTeamPlayerLinkCode).mockResolvedValue({
      teamPlayerId: "player1",
      linkCode: "ABC12345",
    });

    vi.mocked(teamplayerService.regenerateTeamPlayerLinkCode).mockResolvedValue({
      teamPlayerId: "player1",
      linkCode: "XYZ98765",
    });

    const user = userEvent.setup();
    render(<PlayerLinkCode teamPlayerId="player1" />);

    await waitFor(() => {
      expect(screen.getByText("ABC12345")).toBeInTheDocument();
    });

    const regenerateButton = screen.getByRole("button", { name: /Regenerar código/i });
    await user.click(regenerateButton);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("XYZ98765")).toBeInTheDocument();
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });

  it("displays error when loading fails", async () => {
    vi.mocked(teamplayerService.getTeamPlayerLinkCode).mockRejectedValue(
      new Error("Network error")
    );

    render(<PlayerLinkCode teamPlayerId="player1" />);

    await waitFor(() => {
      expect(screen.getByText("Error al cargar el código de vinculación")).toBeInTheDocument();
    });
  });
});
