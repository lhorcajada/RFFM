import { useCallback, useEffect, useState } from "react";
import { getMyQuinielaWallet } from "../../apps/coach/services/quinielaService";
import resolveTeamId from "./resolveUserTeamId";

/** Dispatched by the quiniela screens after any operation that changes the current
 * user's wallet balance, so the header (mounted once) refreshes without a remount. */
export const QUINIELA_WALLET_UPDATED_EVENT = "rffm.quiniela_wallet_updated";

export interface QuinielaWalletBalanceInfo {
  /** True once a numeric balance has been loaded. Stays false if the quiniela is
   * unavailable (feature flag off, 403/404) or no team resolves. */
  visible: boolean;
  balance: number | null;
  teamId: string | null;
}

/** Quiniela wallet balance of the current user for their team. Fails silently. */
export default function useQuinielaWalletBalance(): QuinielaWalletBalanceInfo {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const load = useCallback((mountedRef: { current: boolean }) => {
    resolveTeamId()
      .then(async (resolvedTeamId) => {
        if (!mountedRef.current) return;
        setTeamId(resolvedTeamId);
        if (!resolvedTeamId) {
          setBalance(null);
          return;
        }
        try {
          const wallet = await getMyQuinielaWallet(resolvedTeamId, { limit: 1 });
          if (mountedRef.current) setBalance(wallet.balance);
        } catch {
          if (mountedRef.current) setBalance(null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };

    load(mountedRef);

    const handleUpdated = () => load(mountedRef);
    window.addEventListener(QUINIELA_WALLET_UPDATED_EVENT, handleUpdated);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(QUINIELA_WALLET_UPDATED_EVENT, handleUpdated);
    };
  }, [load]);

  return { visible: balance !== null, balance, teamId };
}
