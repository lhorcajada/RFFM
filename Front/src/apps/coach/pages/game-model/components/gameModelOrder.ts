/** Compares dotted numbering literals ("1.10" > "1.2") segment by segment, numerically. */
export function compareNumero(a: string, b: string): number {
  const segsA = a.split(".").map(Number);
  const segsB = b.split(".").map(Number);
  const len = Math.max(segsA.length, segsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (segsA[i] ?? 0) - (segsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Sorts items by their dotted `numero`, pairing each with its original array index so
 * callers that dispatch by index (the editor) can still address the right underlying entry. */
export function indexedSortByNumero<T extends { numero: string }>(
  items: T[]
): { item: T; index: number }[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareNumero(a.item.numero, b.item.numero));
}
