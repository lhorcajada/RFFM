import type { QuinielaWalletSummary } from "../../services/quinielaService";

const COMBINING_MARKS = /\p{M}/gu;

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "");
}

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .split("ñ")
    .map(stripAccents)
    .join("ñ")
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
