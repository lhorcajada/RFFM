import { groupPlayersByPosition, PlayerPositionSection } from '../groupPlayersByPosition';

type Demarcation = { id: number; name: string; code: string } | null;

const card = (teamPlayerId: string, dorsal: number | null, activeDemarcation: Demarcation) => ({
  teamPlayerId,
  dorsal,
  activeDemarcation,
});

describe('groupPlayersByPosition', () => {
  it('All groups populated, correct titles and order', () => {
    const cards = [
      card('p1', 1, { id: 1, name: 'Portero', code: 'POR' }),
      card('p2', 4, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p3', 6, { id: 6, name: 'Medio Centro', code: 'MC' }),
      card('p4', 9, { id: 9, name: 'Mediocampista Izquierdo', code: 'MI' }),
      card('p5', 11, { id: 11, name: 'Delantero Centro', code: 'DC' }),
      card('p6', 12, null),
    ];

    const result = groupPlayersByPosition(cards);
    const titles = result.map((s) => s.title);

    expect(titles).toEqual(['Porteros', 'Defensas', 'Medio centros', 'Bandas', 'Delanteros', 'Sin posición']);
  });

  it('Empty interior group omitted', () => {
    const cards = [
      card('p1', 1, { id: 1, name: 'Portero', code: 'POR' }),
      card('p2', 4, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p3', 6, { id: 6, name: 'Medio Centro', code: 'MC' }),
      card('p4', 9, { id: 9, name: 'Mediocampista Izquierdo', code: 'MI' }),
      card('p6', 12, null),
    ];

    const result = groupPlayersByPosition(cards);
    const titles = result.map((s) => s.title);

    expect(titles).not.toContain('Delanteros');
    expect(result.find((s) => s.title === 'Delanteros')).toBeUndefined();
  });

  it('Sin posición omitted when no nulls', () => {
    const cards = [
      card('p1', 1, { id: 1, name: 'Portero', code: 'POR' }),
      card('p2', 4, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p3', 6, { id: 6, name: 'Medio Centro', code: 'MC' }),
      card('p4', 9, { id: 9, name: 'Mediocampista Izquierdo', code: 'MI' }),
      card('p5', 11, { id: 11, name: 'Delantero Centro', code: 'DC' }),
    ];

    const result = groupPlayersByPosition(cards);

    expect(result.find((s) => s.title === 'Sin posición')).toBeUndefined();
  });

  it('Nulls all land in Sin posición, always last', () => {
    const cards = [
      card('p1', 1, { id: 1, name: 'Portero', code: 'POR' }),
      card('p2', 4, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p6', 12, null),
      card('p7', 13, null),
    ];

    const result = groupPlayersByPosition(cards);

    const lastSection = result[result.length - 1];
    expect(lastSection.title).toBe('Sin posición');
    expect(lastSection.data.length).toBe(2);
    expect(lastSection.data.map((c) => c.teamPlayerId)).toEqual(['p6', 'p7']);
  });

  it('Sub-position order within Defensas', () => {
    const cards = [
      card('p1', null, { id: 10, name: 'Lateral Derecho', code: 'LD' }),
      card('p2', null, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p3', null, { id: 5, name: 'Lateral Izquierdo', code: 'LI' }),
      card('p4', null, { id: 8, name: 'Libero', code: 'LIB' }),
    ];

    const result = groupPlayersByPosition(cards);
    const defensasSection = result.find((s) => s.title === 'Defensas');

    expect(defensasSection?.data.map((c) => c.activeDemarcation?.code)).toEqual(['DFC', 'LIB', 'LI', 'LD']);
  });

  it('Dorsal ascending within same sub-position', () => {
    const cards = [
      card('p1', 9, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p2', 3, { id: 4, name: 'Defensa Central', code: 'DFC' }),
    ];

    const result = groupPlayersByPosition(cards);
    const defensasSection = result.find((s) => s.title === 'Defensas');

    expect(defensasSection?.data.map((c) => c.dorsal)).toEqual([3, 9]);
  });

  it('Null dorsal sorts last within its sub-position', () => {
    const cards = [
      card('p1', 5, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p2', null, { id: 4, name: 'Defensa Central', code: 'DFC' }),
      card('p3', 2, { id: 4, name: 'Defensa Central', code: 'DFC' }),
    ];

    const result = groupPlayersByPosition(cards);
    const defensasSection = result.find((s) => s.title === 'Defensas');

    expect(defensasSection?.data.map((c) => c.dorsal)).toEqual([2, 5, null]);
  });

  it('Matches by code, not name', () => {
    const cards = [
      card('p1', 1, { id: 1, name: 'Unexpected Name', code: 'POR' }),
    ];

    const result = groupPlayersByPosition(cards);
    const porterosSection = result.find((s) => s.title === 'Porteros');

    expect(porterosSection).toBeDefined();
    expect(porterosSection?.data.length).toBe(1);
  });
});
