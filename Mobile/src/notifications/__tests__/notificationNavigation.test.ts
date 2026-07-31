const mockIsReady = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => mockIsReady(),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

import { navigateFromNotificationData } from '../notificationNavigation';

describe('navigateFromNotificationData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady.mockReturnValue(true);
  });

  it('navigates to NewsDetail with newsId for a news payload', () => {
    navigateFromNotificationData({ type: 'news', id: 'news-1' });

    expect(mockNavigate).toHaveBeenCalledWith('Calendar', {
      screen: 'NewsTab',
      params: { screen: 'NewsDetail', params: { newsId: 'news-1' } },
    });
  });

  it('navigates to EventDetail with eventId and teamId for a calendar payload', () => {
    navigateFromNotificationData({ type: 'calendar', id: 'event-1', teamId: 'team-1' });

    expect(mockNavigate).toHaveBeenCalledWith('Calendar', {
      screen: 'CalendarTab',
      params: { screen: 'EventDetail', params: { eventId: 'event-1', teamId: 'team-1' } },
    });
  });

  it('does nothing (no crash) for an unknown type', () => {
    expect(() => navigateFromNotificationData({ type: 'unknown', id: 'x' })).not.toThrow();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when data is missing/undefined', () => {
    expect(() => navigateFromNotificationData(undefined as any)).not.toThrow();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when the navigation container is not ready yet', () => {
    mockIsReady.mockReturnValue(false);

    navigateFromNotificationData({ type: 'news', id: 'news-1' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
