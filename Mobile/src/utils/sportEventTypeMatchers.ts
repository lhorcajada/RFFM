const normalize = (name?: string | null): string => (name ?? '').toLowerCase();

export const isTrainingEventType = (name?: string | null): boolean =>
  normalize(name).includes('entrenamiento');

export const isMatchEventType = (name?: string | null): boolean =>
  normalize(name).includes('partido');

export const isTournamentEventType = (name?: string | null): boolean => {
  const n = normalize(name);
  return n.includes('torneo') || n.includes('competici');
};

export const isFriendlyEventType = (name?: string | null): boolean =>
  normalize(name).includes('amistos');

export const isFriendlyOrTournamentEventType = (name?: string | null): boolean =>
  isFriendlyEventType(name) || isTournamentEventType(name);
