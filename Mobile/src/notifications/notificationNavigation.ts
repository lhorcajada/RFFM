import { navigationRef } from '../navigation/navigationRef';

export interface NotificationData {
  type?: string;
  id?: string;
  teamId?: string;
}

export const navigateFromNotificationData = (data: NotificationData | undefined): void => {
  if (!data?.type || !navigationRef.isReady()) {
    return;
  }

  if (data.type === 'news') {
    navigationRef.navigate('Calendar', {
      screen: 'NewsTab',
      params: { screen: 'NewsDetail', params: { newsId: data.id } },
    });
    return;
  }

  if (data.type === 'calendar') {
    navigationRef.navigate('Calendar', {
      screen: 'CalendarTab',
      params: { screen: 'EventDetail', params: { eventId: data.id, teamId: data.teamId } },
    });
  }
};
