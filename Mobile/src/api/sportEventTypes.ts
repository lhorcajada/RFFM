import { api } from './client';

export type SportEventTypeMap = Record<number, string>;

export const fetchSportEventTypeMap = async (): Promise<SportEventTypeMap> => {
  try {
    const response = await api.get('/api/sport-event-types');
    const types: { id: number; name: string }[] = response.data || [];
    return types.reduce<SportEventTypeMap>((map, type) => {
      map[type.id] = type.name;
      return map;
    }, {});
  } catch {
    return {};
  }
};
