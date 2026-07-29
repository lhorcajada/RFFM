import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEventFilters } from '../useEventFilters';

jest.mock('expo-secure-store');

const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

describe('useEventFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
    mockDeleteItemAsync.mockResolvedValue(undefined);
  });

  it('returns default filters and isLoaded true when nothing is stored', async () => {
    const { result } = await renderHook(() => useEventFilters());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.filters).toEqual({ eventTypeId: null, startDate: null, endDate: null });
  });

  it('loads and parses a previously stored value on mount', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ eventTypeId: 3, startDate: '2026-08-01T00:00:00.000Z', endDate: null }),
    );

    const { result } = await renderHook(() => useEventFilters());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.filters).toEqual({
      eventTypeId: 3,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: null,
    });
    expect(mockGetItemAsync).toHaveBeenCalledWith('event_filters');
  });

  it('saveFilters merges into current filters and persists the merged JSON', async () => {
    const { result } = await renderHook(() => useEventFilters());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.saveFilters({ eventTypeId: 2 });
    });

    expect(result.current.filters).toEqual({ eventTypeId: 2, startDate: null, endDate: null });
    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'event_filters',
      JSON.stringify({ eventTypeId: 2, startDate: null, endDate: null }),
    );

    await act(async () => {
      await result.current.saveFilters({ startDate: '2026-09-01T00:00:00.000Z' });
    });

    expect(result.current.filters).toEqual({
      eventTypeId: 2,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: null,
    });
  });

  it('clearFilters resets to default and deletes the stored value', async () => {
    mockGetItemAsync.mockResolvedValue(JSON.stringify({ eventTypeId: 1, startDate: null, endDate: null }));
    const { result } = await renderHook(() => useEventFilters());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({ eventTypeId: null, startDate: null, endDate: null });
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('event_filters');
  });

  it('resolves to default filters with isLoaded true when reading from secure store fails', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useEventFilters());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.filters).toEqual({ eventTypeId: null, startDate: null, endDate: null });
  });

  it('saveFilters resolves to true when persistence succeeds', async () => {
    const { result } = await renderHook(() => useEventFilters());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let persisted: boolean | undefined;
    await act(async () => {
      persisted = await result.current.saveFilters({ eventTypeId: 1 });
    });

    expect(persisted).toBe(true);
  });

  it('saveFilters resolves to false but still applies the filters in-memory when persistence fails', async () => {
    mockSetItemAsync.mockRejectedValue(new Error('storage full'));
    const { result } = await renderHook(() => useEventFilters());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let persisted: boolean | undefined;
    await act(async () => {
      persisted = await result.current.saveFilters({ eventTypeId: 1 });
    });

    expect(persisted).toBe(false);
    expect(result.current.filters).toEqual({ eventTypeId: 1, startDate: null, endDate: null });
  });

  it('clearFilters resolves to false but still resets in-memory filters when persistence fails', async () => {
    mockDeleteItemAsync.mockRejectedValue(new Error('storage full'));
    const { result } = await renderHook(() => useEventFilters());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let persisted: boolean | undefined;
    await act(async () => {
      persisted = await result.current.clearFilters();
    });

    expect(persisted).toBe(false);
    expect(result.current.filters).toEqual({ eventTypeId: null, startDate: null, endDate: null });
  });
});
