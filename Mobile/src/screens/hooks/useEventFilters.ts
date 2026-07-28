import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const FILTERS_KEY = 'event_filters';

export interface EventFilters {
  eventTypeId: number | null;
  startDate: string | null;
  endDate: string | null;
}

const DEFAULT_FILTERS: EventFilters = { eventTypeId: null, startDate: null, endDate: null };

export const useEventFilters = () => {
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(FILTERS_KEY);
        if (mounted && stored) {
          setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(stored) });
        }
      } catch (error) {
        console.error('Error retrieving event filters from secure store:', error);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveFilters = async (partial: Partial<EventFilters>): Promise<boolean> => {
    const merged = { ...filters, ...partial };
    setFilters(merged);
    try {
      await SecureStore.setItemAsync(FILTERS_KEY, JSON.stringify(merged));
      return true;
    } catch (error) {
      console.error('Error saving event filters to secure store:', error);
      return false;
    }
  };

  const clearFilters = async (): Promise<boolean> => {
    setFilters(DEFAULT_FILTERS);
    try {
      await SecureStore.deleteItemAsync(FILTERS_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing event filters from secure store:', error);
      return false;
    }
  };

  return { filters, isLoaded, saveFilters, clearFilters };
};
