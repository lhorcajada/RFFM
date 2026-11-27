import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../../../../services/deconvocationProposalService", () => ({
  getSavedProposals: vi.fn(),
  saveProposal: vi.fn(),
  deleteSavedProposal: vi.fn(),
}));

import { deleteSavedProposal, getSavedProposals, saveProposal } from "../../../../services/deconvocationProposalService";
import { useSavedProposals } from "../useSavedProposals";

const first = { id: "s1", name: "Propuesta 1", teamPlayerIds: ["p1"], createdOn: "2026-11-27T10:00:00Z" };
const second = { ...first, id: "s2", name: "Propuesta 2" };

describe("useSavedProposals", () => {
  const notices: Array<{ message: string; severity: string }> = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);

  beforeEach(() => {
    vi.resetAllMocks();
    notices.length = 0;
    window.addEventListener("rffm.show_snackbar", listener);
    vi.mocked(getSavedProposals).mockResolvedValue([first]);
    return () => window.removeEventListener("rffm.show_snackbar", listener);
  });

  async function renderLoaded() {
    const view = renderHook(() => useSavedProposals("e1", true));
    await waitFor(() => expect(view.result.current.items).toEqual([first]));
    return view;
  }

  it("no pide nada mientras la propuesta está cerrada o sin partido", () => {
    renderHook(() => useSavedProposals("e1", false));
    renderHook(() => useSavedProposals(null, true));

    expect(getSavedProposals).not.toHaveBeenCalled();
  });

  it("añade la propuesta guardada", async () => {
    vi.mocked(saveProposal).mockResolvedValue(second);
    const { result } = await renderLoaded();

    await act(async () => {
      expect(await result.current.save("Propuesta 2", ["p2"])).toBe(true);
    });

    expect(saveProposal).toHaveBeenCalledWith("e1", "Propuesta 2", ["p2"]);
    expect(result.current.items).toEqual([first, second]);
    expect(notices).toEqual([{ message: "Propuesta guardada", severity: "success" }]);
  });

  it("al llegar al límite avisa de que hay que borrar una y no cambia la lista", async () => {
    vi.mocked(saveProposal).mockRejectedValue({ response: { status: 409 } });
    const { result } = await renderLoaded();

    await act(async () => {
      expect(await result.current.save("Otra", ["p2"])).toBe(false);
    });

    expect(result.current.items).toEqual([first]);
    expect(notices).toEqual([
      { message: "Ya hay 10 propuestas guardadas. Borra alguna para guardar otra.", severity: "error" },
    ]);
  });

  it("avisa si no se puede guardar", async () => {
    vi.mocked(saveProposal).mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.save("Otra", ["p2"]);
    });

    expect(notices).toEqual([{ message: "No se pudo guardar la propuesta.", severity: "error" }]);
  });

  it("quita la propuesta borrada", async () => {
    vi.mocked(deleteSavedProposal).mockResolvedValue(undefined);
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.remove("s1");
    });

    expect(deleteSavedProposal).toHaveBeenCalledWith("e1", "s1");
    expect(result.current.items).toEqual([]);
  });

  it("marca el error de carga y permite reintentar", async () => {
    vi.mocked(getSavedProposals).mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useSavedProposals("e1", true));
    await waitFor(() => expect(result.current.loadFailed).toBe(true));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.loadFailed).toBe(false);
    expect(result.current.items).toEqual([first]);
  });
});
