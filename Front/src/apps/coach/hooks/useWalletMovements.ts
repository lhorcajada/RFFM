import { useCallback, useEffect, useRef, useState } from "react";
import type { QuinielaWallet, QuinielaWalletMovement } from "../services/quinielaService";

export const WALLET_MOVEMENTS_PAGE_SIZE = 25;

type FetchPage = (limit: number, offset: number) => Promise<QuinielaWallet>;

export default function useWalletMovements(fetchPage: FetchPage, enabled = true) {
  const [movements, setMovements] = useState<QuinielaWalletMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const loadPage = useCallback(async (offset: number) => {
    setLoading(true);
    setFailed(false);
    try {
      const wallet = await fetchRef.current(WALLET_MOVEMENTS_PAGE_SIZE, offset);
      setBalance(wallet.balance);
      setTotal(wallet.totalMovements);
      setMovements((prev) => (offset === 0 ? wallet.movements : [...prev, ...wallet.movements]));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setMovements([]);
    setTotal(0);
    void loadPage(0);
  }, [enabled, loadPage]);

  const reload = useCallback(() => loadPage(0), [loadPage]);
  const loadMore = useCallback(() => loadPage(movements.length), [loadPage, movements.length]);

  return {
    movements,
    balance,
    loading,
    failed,
    hasMore: movements.length < total,
    isEmpty: !loading && !failed && movements.length === 0,
    reload,
    loadMore,
  };
}
