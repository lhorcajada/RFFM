import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/squadHistoryService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/squadHistoryService")>(
    "../../../../services/squadHistoryService",
  );
  return { ...actual, requestSquadHistory: vi.fn() };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import SquadHistoryButton from "../SquadHistoryButton";
import { requestSquadHistory } from "../../../../services/squadHistoryService";

const requestMock = vi.mocked(requestSquadHistory);

function renderButton() {
  return render(
    <MemoryRouter>
      <SquadHistoryButton teamCode="555" teamName="CD Ejemplo A" seasonId={22} />
    </MemoryRouter>,
  );
}

describe("SquadHistoryButton", () => {
  const snackbarListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.addEventListener("rffm.show_snackbar", snackbarListener);
  });

  afterEach(() => {
    window.removeEventListener("rffm.show_snackbar", snackbarListener);
  });

  it("con el historial ya generado navega a la página de historial", async () => {
    requestMock.mockResolvedValue({ reportId: "r1", status: "Completed" });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /historial/i }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/federation/squad-history/555?seasonId=22"),
    );
    expect(requestMock).toHaveBeenCalledWith("555", { seasonId: 22, teamName: "CD Ejemplo A", refresh: false });
  });

  it("con el historial en preparación avisa de que llegará una notificación y no navega", async () => {
    requestMock.mockResolvedValue({ reportId: "r1", status: "Pending" });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /historial/i }));

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const event = snackbarListener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
    expect(event.detail.message).toMatch(/te avisaremos con una notificación/i);
    expect(event.detail.severity).toBe("info");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("si la petición falla muestra un aviso de error", async () => {
    requestMock.mockRejectedValue(new Error("network"));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /historial/i }));

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const event = snackbarListener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
    expect(event.detail.severity).toBe("error");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
