import {
  isTrainingEventType,
  isMatchEventType,
  isTournamentEventType,
  isFriendlyEventType,
  isFriendlyOrTournamentEventType,
} from '../sportEventTypeMatchers';

describe('sportEventTypeMatchers', () => {
  describe('isTrainingEventType', () => {
    it('returns true for "Entrenamiento"', () => {
      expect(isTrainingEventType('Entrenamiento')).toBe(true);
    });

    it('returns true for lowercase "entrenamiento"', () => {
      expect(isTrainingEventType('entrenamiento')).toBe(true);
    });

    it('returns false for "Partido"', () => {
      expect(isTrainingEventType('Partido')).toBe(false);
    });

    it('returns false for "Reunión"', () => {
      expect(isTrainingEventType('Reunión')).toBe(false);
    });

    it('returns false for "Amistoso"', () => {
      expect(isTrainingEventType('Amistoso')).toBe(false);
    });

    it('returns false for "Pruebas de acceso"', () => {
      expect(isTrainingEventType('Pruebas de acceso')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTrainingEventType(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isTrainingEventType(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isTrainingEventType('')).toBe(false);
    });
  });

  describe('isMatchEventType', () => {
    it('returns true for "Partido"', () => {
      expect(isMatchEventType('Partido')).toBe(true);
    });

    it('returns true for uppercase "PARTIDO"', () => {
      expect(isMatchEventType('PARTIDO')).toBe(true);
    });

    it('returns false for "Entrenamiento"', () => {
      expect(isMatchEventType('Entrenamiento')).toBe(false);
    });

    it('returns false for "Reunión"', () => {
      expect(isMatchEventType('Reunión')).toBe(false);
    });

    it('returns false for "Amistoso"', () => {
      expect(isMatchEventType('Amistoso')).toBe(false);
    });

    it('returns false for "Pruebas de acceso"', () => {
      expect(isMatchEventType('Pruebas de acceso')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isMatchEventType(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isMatchEventType(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isMatchEventType('')).toBe(false);
    });
  });

  describe('isTournamentEventType', () => {
    it('returns true for "Torneo Provincial"', () => {
      expect(isTournamentEventType('Torneo Provincial')).toBe(true);
    });

    it('returns true for "Fase de Competición"', () => {
      expect(isTournamentEventType('Fase de Competición')).toBe(true);
    });

    it('returns true for lowercase "torneo regional"', () => {
      expect(isTournamentEventType('torneo regional')).toBe(true);
    });

    it('returns false for "Amistoso"', () => {
      expect(isTournamentEventType('Amistoso')).toBe(false);
    });

    it('returns false for "Partido"', () => {
      expect(isTournamentEventType('Partido')).toBe(false);
    });

    it('returns false for "Entrenamiento"', () => {
      expect(isTournamentEventType('Entrenamiento')).toBe(false);
    });

    it('returns false for "Reunión"', () => {
      expect(isTournamentEventType('Reunión')).toBe(false);
    });

    it('returns false for "Pruebas de acceso"', () => {
      expect(isTournamentEventType('Pruebas de acceso')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTournamentEventType(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isTournamentEventType(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isTournamentEventType('')).toBe(false);
    });
  });

  describe('isFriendlyEventType', () => {
    it('returns true for "Amistoso"', () => {
      expect(isFriendlyEventType('Amistoso')).toBe(true);
    });

    it('returns true for uppercase "AMISTOSO"', () => {
      expect(isFriendlyEventType('AMISTOSO')).toBe(true);
    });

    it('returns false for "Partido"', () => {
      expect(isFriendlyEventType('Partido')).toBe(false);
    });

    it('returns false for "Entrenamiento"', () => {
      expect(isFriendlyEventType('Entrenamiento')).toBe(false);
    });

    it('returns false for "Reunión"', () => {
      expect(isFriendlyEventType('Reunión')).toBe(false);
    });

    it('returns false for "Pruebas de acceso"', () => {
      expect(isFriendlyEventType('Pruebas de acceso')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isFriendlyEventType(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isFriendlyEventType(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isFriendlyEventType('')).toBe(false);
    });
  });

  describe('isFriendlyOrTournamentEventType', () => {
    it('returns true for "Amistoso"', () => {
      expect(isFriendlyOrTournamentEventType('Amistoso')).toBe(true);
    });

    it('returns true for "Torneo Provincial"', () => {
      expect(isFriendlyOrTournamentEventType('Torneo Provincial')).toBe(true);
    });

    it('returns true for "Fase de Competición"', () => {
      expect(isFriendlyOrTournamentEventType('Fase de Competición')).toBe(true);
    });

    it('returns false for "Partido"', () => {
      expect(isFriendlyOrTournamentEventType('Partido')).toBe(false);
    });

    it('returns false for "Entrenamiento"', () => {
      expect(isFriendlyOrTournamentEventType('Entrenamiento')).toBe(false);
    });

    it('returns false for "Reunión"', () => {
      expect(isFriendlyOrTournamentEventType('Reunión')).toBe(false);
    });

    it('returns false for "Pruebas de acceso"', () => {
      expect(isFriendlyOrTournamentEventType('Pruebas de acceso')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isFriendlyOrTournamentEventType(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isFriendlyOrTournamentEventType(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isFriendlyOrTournamentEventType('')).toBe(false);
    });
  });
});
