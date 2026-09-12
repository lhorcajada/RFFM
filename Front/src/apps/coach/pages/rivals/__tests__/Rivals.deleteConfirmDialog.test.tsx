import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const getRivalsMock = vi.fn();
const deleteRivalMock = vi.fn();
vi.mock("../../../services/rivalService", () => ({
  getRivals: (...args: unknown[]) => getRivalsMock(...args),
  createRival: vi.fn(),
  updateRival: vi.fn(),
  uploadRivalPhoto: vi.fn(),
  deleteRival: (...args: unknown[]) => deleteRivalMock(...args),
}));

vi.mock("../../../../federation/services/Federation/ClubService", () => ({
  clubService: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

import Rivals from "../Rivals";

function renderRivals() {
  return render(
    <MemoryRouter>
      <Rivals />
    </MemoryRouter>
  );
}

describe("Rivals — eliminar rival con ConfirmDialog (no confirm() nativo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRivalsMock.mockResolvedValue([{ id: "r1", name: "Rival FC" }]);
    deleteRivalMock.mockResolvedValue(undefined);
  });

  it("eliminar un rival abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    renderRivals();

    await userEvent.click(await screen.findByRole("button", { name: /^eliminar$/i }));

    expect(
      await screen.findByText(/¿eliminar "rival fc"\? esta acción no se puede deshacer\./i)
    ).toBeInTheDocument();
    expect(deleteRivalMock).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(deleteRivalMock).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(screen.queryByText("Rival FC")).not.toBeInTheDocument());
  });

  it("cancelar el ConfirmDialog no elimina el rival", async () => {
    renderRivals();

    await userEvent.click(await screen.findByRole("button", { name: /^eliminar$/i }));
    await screen.findByText(/¿eliminar "rival fc"\? esta acción no se puede deshacer\./i);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await waitFor(() =>
      expect(
        screen.queryByText(/¿eliminar "rival fc"\? esta acción no se puede deshacer\./i)
      ).not.toBeInTheDocument()
    );
    expect(deleteRivalMock).not.toHaveBeenCalled();
    expect(screen.getByText("Rival FC")).toBeInTheDocument();
  });
});
