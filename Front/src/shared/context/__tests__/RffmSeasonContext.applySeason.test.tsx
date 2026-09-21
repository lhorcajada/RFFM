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

const response = (preferredSeasonId: number | null) => ({
  currentSeasonId: 22,
  preferredSeasonId,
  seasons: [
    { id: 22, label: "2026-2027" },
    { id: 21, label: "2025-2026" },
    { id: 20, label: "2024-2025" },
  ],
});

function Consumer() {
  const { seasonId, seasonChangeToken, applySeasonId } = useRffmSeason();
  return (
    <div>
      <span data-testid="season-id">{seasonId ?? ""}</span>
      <span data-testid="token">{seasonChangeToken}</span>
      <button onClick={() => applySeasonId(20)}>apply-20</button>
      <button onClick={() => applySeasonId(null)}>apply-legacy</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <RffmSeasonProvider>
      <Consumer />
    </RffmSeasonProvider>,
  );

describe("RffmSeasonContext — applySeasonId (temporada de la configuración guardada)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aplica la temporada indicada sin guardar preferencia ni disparar la limpieza", async () => {
    vi.mocked(getRffmSeasons).mockResolvedValue(response(21));
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("21"),
    );

    await act(async () => screen.getByText("apply-20").click());

    expect(screen.getByTestId("season-id").textContent).toBe("20");
    expect(screen.getByTestId("token").textContent).toBe("0");
    expect(saveRffmSeasonPreference).not.toHaveBeenCalled();
  });

  it("usa la temporada actual para una configuración antigua sin temporada", async () => {
    vi.mocked(getRffmSeasons).mockResolvedValue(response(21));
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("21"),
    );

    await act(async () => screen.getByText("apply-legacy").click());

    expect(screen.getByTestId("season-id").textContent).toBe("22");
  });

  it("respeta la temporada de la configuración aunque las temporadas carguen después", async () => {
    let resolveSeasons: (v: ReturnType<typeof response>) => void = () => {};
    vi.mocked(getRffmSeasons).mockReturnValue(
      new Promise((resolve) => {
        resolveSeasons = resolve;
      }),
    );
    renderProvider();

    await act(async () => screen.getByText("apply-legacy").click());
    await act(async () => resolveSeasons(response(21)));

    await waitFor(() =>
      expect(screen.getByTestId("season-id").textContent).toBe("22"),
    );
  });
});
