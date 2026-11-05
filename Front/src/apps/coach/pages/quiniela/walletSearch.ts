import type { QuinielaWalletSummary } from "../../services/quinielaService";

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function filterWallets(wallets: QuinielaWalletSummary[], query: string): QuinielaWalletSummary[] {
  const needle = normalizeSearchText(query);
  if (needle === "") return wallets;

  return wallets.filter(
    (wallet) =>
      normalizeSearchText(wallet.userName).includes(needle) ||
      wallet.associatedPlayers.some((player) => normalizeSearchText(player.name).includes(needle)),
  );
}
