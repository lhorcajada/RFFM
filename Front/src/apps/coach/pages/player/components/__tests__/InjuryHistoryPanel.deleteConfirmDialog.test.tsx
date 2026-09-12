import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPlayerInjuriesMock = vi.fn();
const deletePlayerInjuryMock = vi.fn();
const updatePlayerInjuryMock = vi.fn();
vi.mock("../../../../services/teamplayerService", () => ({
  getPlayerInjuries: (...args: unknown[]) => getPlayerInjuriesMock(...args),
  deletePlayerInjury: (...args: unknown[]) => deletePlayerInjuryMock(...args),
  updatePlayerInjury: (...args: unknown[]) => updatePlayerInjuryMock(...args),
}));

import InjuryHistoryPanel from "../InjuryHistoryPanel";

function buildInjuries() {
  return [
    {
      id: "inj-1",
      startDate: "2026-01-01T00:00:00Z",
      injuryType: "Esguince de tobillo",
      description: null,
      estimatedRecovery: null,
      endDate: null,
    },
  ];
}

describe("InjuryHistoryPanel — eliminar registro con ConfirmDialog (no confirm() nativo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayerInjuriesMock.mockResolvedValue(buildInjuries());
    deletePlayerInjuryMock.mockResolvedValue(true);
  });

  it("eliminar un registro abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    render(<InjuryHistoryPanel teamPlayerId="tp-1" />);

    await screen.findByText("Esguince de tobillo");

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));

    expect(
      await screen.findByText(/¿eliminar el registro de lesión "esguince de tobillo"\?/i)
    ).toBeInTheDocument();
    expect(deletePlayerInjuryMock).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(deletePlayerInjuryMock).toHaveBeenCalledWith("tp-1", "inj-1"));
    await waitFor(() =>
      expect(screen.queryByText("Esguince de tobillo")).not.toBeInTheDocument()
    );
  });

  it("cancelar el ConfirmDialog no elimina el registro", async () => {
    render(<InjuryHistoryPanel teamPlayerId="tp-1" />);

    await screen.findByText("Esguince de tobillo");

    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    await screen.findByText(/¿eliminar el registro de lesión "esguince de tobillo"\?/i);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await waitFor(() =>
      expect(
        screen.queryByText(/¿eliminar el registro de lesión "esguince de tobillo"\?/i)
      ).not.toBeInTheDocument()
    );
    expect(deletePlayerInjuryMock).not.toHaveBeenCalled();
    expect(screen.getByText("Esguince de tobillo")).toBeInTheDocument();
  });
});
