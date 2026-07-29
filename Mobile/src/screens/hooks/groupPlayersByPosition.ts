interface Demarcation {
  id: number;
  name: string;
  code: string;
}

interface PlayerLike {
  teamPlayerId: string;
  dorsal: number | null;
  activeDemarcation: Demarcation | null;
  [key: string]: unknown;
}

export interface PlayerPositionSection<T extends PlayerLike = PlayerLike> {
  key: string;
  title: string;
  data: T[];
}

interface GroupDefinition {
  key: string;
  title: string;
  codes: string[];
}

const GROUPS: GroupDefinition[] = [
  { key: 'porteros', title: 'Porteros', codes: ['POR'] },
  { key: 'defensas', title: 'Defensas', codes: ['DFC', 'LIB', 'LI', 'LD'] },
  { key: 'medio-centros', title: 'Medio centros', codes: ['MCD', 'MC', 'MCO'] },
  { key: 'bandas', title: 'Bandas', codes: ['MI', 'MD', 'EI', 'ED'] },
  { key: 'delanteros', title: 'Delanteros', codes: ['SD', 'DC'] },
];

const SIN_POSICION: GroupDefinition = { key: 'sin-posicion', title: 'Sin posición', codes: [] };

function subPositionIndex(codes: string[], code: string | undefined): number {
  if (!code) return codes.length;
  const index = codes.indexOf(code);
  return index === -1 ? codes.length : index;
}

function sortWithinGroup<T extends PlayerLike>(cards: T[], codes: string[]): T[] {
  return [...cards].sort((a, b) => {
    const indexA = subPositionIndex(codes, a.activeDemarcation?.code);
    const indexB = subPositionIndex(codes, b.activeDemarcation?.code);
    if (indexA !== indexB) return indexA - indexB;
    const dorsalA = a.dorsal ?? Infinity;
    const dorsalB = b.dorsal ?? Infinity;
    return dorsalA - dorsalB;
  });
}

export function groupPlayersByPosition<T extends PlayerLike>(cards: T[]): PlayerPositionSection<T>[] {
  const sections: PlayerPositionSection<T>[] = [];

  for (const group of GROUPS) {
    const matching = cards.filter((card) =>
      card.activeDemarcation != null && group.codes.includes(card.activeDemarcation.code),
    );
    if (matching.length > 0) {
      sections.push({ key: group.key, title: group.title, data: sortWithinGroup(matching, group.codes) });
    }
  }

  const knownCodes = GROUPS.flatMap((g) => g.codes);
  const sinPosicion = cards.filter(
    (card) => card.activeDemarcation == null || !knownCodes.includes(card.activeDemarcation.code),
  );
  if (sinPosicion.length > 0) {
    sections.push({ key: SIN_POSICION.key, title: SIN_POSICION.title, data: sinPosicion });
  }

  return sections;
}
