const mockGetLocales = jest.fn();

jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

describe('i18n', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetLocales.mockReset();
  });

  it('translates a known key to Spanish by default', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'es' }]);
    const { t } = require('../index');

    expect(t('attendance.going')).toBe('Voy');
    expect(t('attendance.notGoing')).toBe('No voy');
    expect(t('attendance.pending')).toBe('Pendiente');
  });

  it('translates a known key to English when the device locale is English', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    const { t } = require('../index');

    expect(t('attendance.going')).toBe('Going');
    expect(t('attendance.notGoing')).toBe('Not going');
    expect(t('attendance.pending')).toBe('Pending');
  });

  it('falls back to Spanish when the device locale has no translation dictionary', () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'fr' }]);
    const { t } = require('../index');

    expect(t('attendance.going')).toBe('Voy');
  });

  it('falls back to Spanish when no locale is available at all', () => {
    mockGetLocales.mockReturnValue([]);
    const { t } = require('../index');

    expect(t('attendance.going')).toBe('Voy');
  });
});
