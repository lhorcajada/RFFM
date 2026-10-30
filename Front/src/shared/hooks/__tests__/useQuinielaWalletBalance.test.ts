import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getMyProfileMock = vi.fn();
vi.mock("../../../apps/coach/services/coachApi", () => ({
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
}));

const getCurrentMock = vi.fn();
vi.mock("../../../apps/coach/services/configurationCoachService", () => ({
  default: { getCurrent: (...args: unknown[]) => getCurrentMock(...args) },
}));

const getMyQuinielaWalletMock = vi.fn();
vi.mock("../../../apps/coach/services/quinielaService", () => ({
  getMyQuinielaWallet: (...args: unknown[]) => getMyQuinielaWalletMock(...args),
}));

import useQuinielaWalletBalance from "../useQuinielaWalletBalance";

const walletOf = (balance: number) => ({
  userId: "u1",
  userName: "Ana",
  role: "Coach",
  balance,
  totalMovements: 0,
  movements: [],
});

describe("useQuinielaWalletBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga el saldo del monedero del equipo del perfil pidiendo solo un movimiento", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-1" });
    getMyQuinielaWalletMock.mockResolvedValue(walletOf(3));

    const { result } = renderHook(() => useQuinielaWalletBalance());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.balance).toBe(3);
    expect(result.current.teamId).toBe("team-1");
    expect(getMyQuinielaWalletMock).toHaveBeenCalledWith("team-1", { limit: 1 });
  });

  it("usa el equipo preferido del entrenador cuando el perfil no tiene equipo", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Coach", teamId: null });
    getCurrentMock.mockResolvedValue({ id: 1, coachId: "c1", preferredTeamId: "team-2" });
    getMyQuinielaWalletMock.mockResolvedValue(walletOf(0));

    const { result } = renderHook(() => useQuinielaWalletBalance());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.balance).toBe(0);
    expect(result.current.teamId).toBe("team-2");
  });

  it("no es visible si no se resuelve ningún equipo", async () => {
    getMyProfileMock.mockResolvedValue(null);
    getCurrentMock.mockResolvedValue(null);

    const { result } = renderHook(() => useQuinielaWalletBalance());

    await waitFor(() => expect(getCurrentMock).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
    expect(getMyQuinielaWalletMock).not.toHaveBeenCalled();
  });

  it("falla en silencio y no es visible si la llamada al monedero falla (403/404)", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-3" });
    getMyQuinielaWalletMock.mockRejectedValue({ response: { status: 404 } });

    const { result } = renderHook(() => useQuinielaWalletBalance());

    await waitFor(() => expect(getMyQuinielaWalletMock).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
    expect(result.current.balance).toBeNull();
  });

  it("recarga el saldo al recibir el evento rffm.quiniela_wallet_updated", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-1" });
    getMyQuinielaWalletMock.mockResolvedValue(walletOf(3));

    const { result } = renderHook(() => useQuinielaWalletBalance());
    await waitFor(() => expect(result.current.balance).toBe(3));

    getMyQuinielaWalletMock.mockResolvedValue(walletOf(2));
    window.dispatchEvent(new CustomEvent("rffm.quiniela_wallet_updated"));

    await waitFor(() => expect(result.current.balance).toBe(2));
    expect(getMyQuinielaWalletMock).toHaveBeenCalledTimes(2);
  });

  it("deja de ser visible si tras el evento la llamada falla", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-1" });
    getMyQuinielaWalletMock.mockResolvedValue(walletOf(3));

    const { result } = renderHook(() => useQuinielaWalletBalance());
    await waitFor(() => expect(result.current.visible).toBe(true));

    getMyQuinielaWalletMock.mockRejectedValue({ response: { status: 403 } });
    window.dispatchEvent(new CustomEvent("rffm.quiniela_wallet_updated"));

    await waitFor(() => expect(result.current.visible).toBe(false));
  });
});
