import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/rffmSeasonService", () => ({
  getRffmSeasons: vi.fn(),
  saveRffmSeasonPreference: vi.fn(),
}));

import {
  getRffmSeasons,
  saveRffmSeasonPreference,
} from "../../services/rffmSeasonService";
import { RffmSeasonProvider, useRffmSeason } from "../RffmSeasonContext";

const seasonsResponse = {
  currentSeasonId: 22,
  preferredSeasonId: null as number | null,
  seasons: [
    { id: 22, label: "2026-2027" },
    { id: 21, label: "2025-2026" },
  ],
};

function Consumer() {
  const { seasonId, seasons, setSeasonId } = useRffmSeason();
  return (
    <div>
      <span data-testid="season-id">{seasonId ?? ""}</span>
      <span data-testid="season-count">{seasons.length}</span>
      <button onClick={() => setSeasonId(21)}>set-21</button>
    </div>
  );
}

describe("RffmSeasonContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds seasonId from currentSeasonId when there is no preference", async () => {
    vi.mocked(getRffmSeasons).mockResolvedValue({
      ...seasonsResponse,
      preferredSeasonId: null,
    });

    render(
      <RffmSeasonProvider>
        <Consumer />
      </RffmSeasonProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("22"),
    );
    expect(screen.getByTestId("season-count").textContent).toBe("2");
  });

  it("seeds seasonId from preferredSeasonId when present", async () => {
    vi.mocked(getRffmSeasons).mockResolvedValue({
      ...seasonsResponse,
      preferredSeasonId: 21,
    });

    render(
      <RffmSeasonProvider>
        <Consumer />
      </RffmSeasonProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("21"),
    );
  });

  it("setSeasonId updates state immediately and saves in background", async () => {
    vi.mocked(getRffmSeasons).mockResolvedValue({
      ...seasonsResponse,
      preferredSeasonId: null,
    });
    vi.mocked(saveRffmSeasonPreference).mockResolvedValue(undefined);

    render(
      <RffmSeasonProvider>
        <Consumer />
      </RffmSeasonProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("22"),
    );

    await act(async () => {
      screen.getByText("set-21").click();
    });

    expect(screen.getByTestId("season-id").textContent).toBe("21");
    await waitFor(() =>
      expect(saveRffmSeasonPreference).toHaveBeenCalledWith(21),
    );
  });

  it("does not break the UI when saving the preference fails", async () => {
    vi.mocked(getRffmSeasons).mockResolvedValue({
      ...seasonsResponse,
      preferredSeasonId: null,
    });
    vi.mocked(saveRffmSeasonPreference).mockRejectedValue(
      new Error("network error"),
    );

    render(
      <RffmSeasonProvider>
        <Consumer />
      </RffmSeasonProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("22"),
    );

    await act(async () => {
      screen.getByText("set-21").click();
    });

    await waitFor(() =>
      expect(saveRffmSeasonPreference).toHaveBeenCalledWith(21),
    );
    expect(screen.getByTestId("season-id").textContent).toBe("21");
  });

  it("re-fetches the seasons once the auth token becomes available after a 401 on mount", async () => {
    vi.mocked(getRffmSeasons)
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce({ ...seasonsResponse, preferredSeasonId: null });

    render(
      <RffmSeasonProvider>
        <Consumer />
      </RffmSeasonProvider>,
    );

    await waitFor(() => expect(getRffmSeasons).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("season-count").textContent).toBe("0");

    await act(async () => {
      window.dispatchEvent(new CustomEvent("rffm.coach_token_updated"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("22"),
    );
    expect(screen.getByTestId("season-count").textContent).toBe("2");
  });

  it("useRffmSeason throws when used outside the provider", () => {
    function Broken() {
      useRffmSeason();
      return null;
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Broken />)).toThrow();
    consoleError.mockRestore();
  });
});
