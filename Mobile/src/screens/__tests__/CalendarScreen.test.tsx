import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CalendarScreen from '../CalendarScreen';
import { api } from '../../api/client';
import * as SecureStore from 'expo-secure-store';
import { ToastProvider } from '../../shared/context/ToastContext';

const Wrapped = () => (
  <ToastProvider>
    <CalendarScreen />
  </ToastProvider>
);

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
}));
jest.mock('expo-secure-store');
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => ReactActual.createElement(View, { testID: 'mock-date-time-picker', ...props }),
  };
});

const mockUseRoute = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockApi = api as jest.Mocked<typeof api>;
const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;

const mockEventTypesOnce = (types: { id: number; name: string }[] = []) => {
  (mockApi.get as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/sport-event-types') {
      return Promise.resolve({ data: types });
    }
    return Promise.resolve({ data: [] });
  });
};

describe('CalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1' } });
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue(undefined);
  });

  it('shows a loading indicator before the events request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });

    const { getByTestId, findByTestId } = await render(<Wrapped />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [] });

    await findByTestId('empty-message');
  });

  it('requests events and event types for the teamId coming from route params', async () => {
    mockEventTypesOnce([]);

    await render(<Wrapped />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: { pageNumber: 1, pageSize: 50, descending: false, startDate: undefined, endDate: undefined },
      }),
    );
    expect(mockApi.get).toHaveBeenCalledWith('/api/sport-event-types');
  });

  it('shows the "Eventos" section title', async () => {
    mockEventTypesOnce([]);

    const { getByTestId } = await render(<Wrapped />);

    expect(getByTestId('screen-header-title').props.children).toBe('Eventos');
  });

  it('does not render a back button, since Eventos is a tab root screen', async () => {
    mockEventTypesOnce([]);

    const { queryByTestId } = await render(<Wrapped />);

    expect(queryByTestId('screen-header-back-button')).toBeNull();
  });

  it('shows an empty-state message when there are no events', async () => {
    mockEventTypesOnce([]);

    const { findByTestId } = await render(<Wrapped />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay eventos programados');
  });

  it('renders an event as a card with title, date and opponent when events are returned', async () => {
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') {
        return Promise.resolve({ data: [{ id: 1, name: 'Entrenamiento' }] });
      }
      return Promise.resolve({
        data: [{ id: '1', name: 'Training', eveDateTime: '2026-07-27', rivalName: 'Barcelona', eventTypeId: 1 }],
      });
    });

    const { findByText, getByText } = await render(<Wrapped />);

    await findByText('Training');
    expect(getByText('Barcelona', { exact: false })).toBeTruthy();
  });

  it('navigates to EventDetail with eventId, teamId and teamPlayerId when a card is pressed', async () => {
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [{ id: 'event1', name: 'Training', eveDateTime: '2026-07-27' }] });
    });

    const { getByTestId } = await render(<Wrapped />);
    await waitFor(() => getByTestId('event-item-event1'));
    await fireEvent.press(getByTestId('event-item-event1'));

    expect(mockNavigate).toHaveBeenCalledWith('EventDetail', {
      eventId: 'event1',
      teamId: 'team1',
      teamPlayerId: 'player1',
    });
  });

  it('shows an error and lets the user retry the request', async () => {
    (mockApi.get as jest.Mock)
      .mockImplementation((url: string) => {
        if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
        return Promise.reject({ response: { data: { detail: 'Error de red' } } });
      });

    const { findByTestId, getByTestId } = await render(<Wrapped />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error de red');

    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    await fireEvent.press(getByTestId('retry-button'));

    await findByTestId('empty-message');
  });

  it('shows an error and does not call the API when teamId is missing', async () => {
    mockUseRoute.mockReturnValue({ params: undefined });

    const { findByTestId } = await render(<Wrapped />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Team ID not provided');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('waits for persisted filters to load before fetching, calling the events endpoint exactly once with them', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ eventTypeId: null, startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-31T00:00:00.000Z' }),
    );
    mockEventTypesOnce([]);

    await render(<Wrapped />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: {
          pageNumber: 1,
          pageSize: 50,
          descending: false,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-31T00:00:00.000Z',
        },
      }),
    );

    const eventsCalls = (mockApi.get as jest.Mock).mock.calls.filter(([url]) => url === '/api/sport-events/team1');
    expect(eventsCalls).toHaveLength(1);
  });

  it('only renders events matching the persisted event type filter', async () => {
    mockGetItemAsync.mockResolvedValue(JSON.stringify({ eventTypeId: 1, startDate: null, endDate: null }));
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') {
        return Promise.resolve({ data: [{ id: 1, name: 'Entrenamiento' }, { id: 2, name: 'Partido' }] });
      }
      return Promise.resolve({
        data: [
          { id: 'e1', name: 'Training Session', eveDateTime: '2026-07-27', eventTypeId: 1 },
          { id: 'e2', name: 'Match Day', eveDateTime: '2026-07-28', eventTypeId: 2 },
        ],
      });
    });

    const { findByText, queryByText } = await render(<Wrapped />);

    await findByText('Training Session');
    expect(queryByText('Match Day')).toBeNull();
  });

  it('opens the filters modal when the filter button is pressed', async () => {
    mockEventTypesOnce([]);

    const { getByTestId, queryByTestId } = await render(<Wrapped />);
    await waitFor(() => getByTestId('open-filters-button'));

    expect(queryByTestId('event-filters-modal')).toBeNull();
    await fireEvent.press(getByTestId('open-filters-button'));

    await waitFor(() => expect(queryByTestId('event-filters-modal')).toBeTruthy());
  });

  it('applying a new date range re-fetches with the new params and persists them', async () => {
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    const { getByTestId } = await render(<Wrapped />);
    await waitFor(() => getByTestId('open-filters-button'));

    const initialEventsCalls = () =>
      (mockApi.get as jest.Mock).mock.calls.filter(([url]) => url === '/api/sport-events/team1').length;
    const callsBefore = initialEventsCalls();

    await fireEvent.press(getByTestId('open-filters-button'));
    await waitFor(() => getByTestId('filter-start-date-input'));
    await fireEvent.press(getByTestId('filter-start-date-input'));

    // Simulate picking a start date directly via the mocked native picker's onChange.
    const startPicker = await waitFor(() => getByTestId('mock-date-time-picker'));
    await fireEvent(startPicker, 'change', {}, new Date('2026-08-01T00:00:00.000Z'));

    await fireEvent.press(getByTestId('apply-filters-button'));

    await waitFor(() => expect(initialEventsCalls()).toBe(callsBefore + 1));
    await waitFor(() =>
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'event_filters',
        expect.stringContaining('2026-08-01T00:00:00.000Z'),
      ),
    );
  });

  it('applying only a new event type does not re-fetch but changes which cards render', async () => {
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') {
        return Promise.resolve({ data: [{ id: 1, name: 'Entrenamiento' }, { id: 2, name: 'Partido' }] });
      }
      return Promise.resolve({
        data: [
          { id: 'e1', name: 'Training Session', eveDateTime: '2026-07-27', eventTypeId: 1 },
          { id: 'e2', name: 'Match Day', eveDateTime: '2026-07-28', eventTypeId: 2 },
        ],
      });
    });

    const { getByTestId, findByText, queryByText } = await render(<Wrapped />);
    await findByText('Training Session');
    await findByText('Match Day');

    const eventsCallsCount = () =>
      (mockApi.get as jest.Mock).mock.calls.filter(([url]) => url === '/api/sport-events/team1').length;
    const callsBefore = eventsCallsCount();

    await fireEvent.press(getByTestId('open-filters-button'));
    await waitFor(() => getByTestId('filter-type-option-2'));
    await fireEvent.press(getByTestId('filter-type-option-2'));
    await fireEvent.press(getByTestId('apply-filters-button'));

    await waitFor(() => expect(queryByText('Training Session')).toBeNull());
    expect(await findByText('Match Day')).toBeTruthy();
    expect(eventsCallsCount()).toBe(callsBefore);
  });

  it('clearing filters resets the visible list and re-fetches without startDate/endDate', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ eventTypeId: 1, startDate: '2026-08-01T00:00:00.000Z', endDate: null }),
    );
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') {
        return Promise.resolve({ data: [{ id: 1, name: 'Entrenamiento' }, { id: 2, name: 'Partido' }] });
      }
      return Promise.resolve({
        data: [
          { id: 'e1', name: 'Training Session', eveDateTime: '2026-07-27', eventTypeId: 1 },
          { id: 'e2', name: 'Match Day', eveDateTime: '2026-07-28', eventTypeId: 2 },
        ],
      });
    });

    const { getByTestId, findByText, queryByText } = await render(<Wrapped />);
    await findByText('Training Session');
    expect(queryByText('Match Day')).toBeNull();

    await fireEvent.press(getByTestId('open-filters-button'));
    await waitFor(() => getByTestId('clear-filters-button'));
    await fireEvent.press(getByTestId('clear-filters-button'));

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: { pageNumber: 1, pageSize: 50, descending: false, startDate: undefined, endDate: undefined },
      }),
    );
    expect(await findByText('Match Day')).toBeTruthy();
  });

  it('shows the empty state (not an error) when zero events match the applied filters', async () => {
    mockGetItemAsync.mockResolvedValue(JSON.stringify({ eventTypeId: 99, startDate: null, endDate: null }));
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') {
        return Promise.resolve({ data: [{ id: 1, name: 'Entrenamiento' }] });
      }
      return Promise.resolve({
        data: [{ id: 'e1', name: 'Training Session', eveDateTime: '2026-07-27', eventTypeId: 1 }],
      });
    });

    const { findByTestId } = await render(<Wrapped />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay eventos programados');
  });

  it('keeps the currently applied filters when teamId changes', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ eventTypeId: null, startDate: '2026-08-01T00:00:00.000Z', endDate: null }),
    );
    mockEventTypesOnce([]);

    const { rerender } = await render(<Wrapped />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: {
          pageNumber: 1,
          pageSize: 50,
          descending: false,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: undefined,
        },
      }),
    );

    mockUseRoute.mockReturnValue({ params: { teamId: 'team2' } });
    await rerender(<Wrapped />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team2', {
        params: {
          pageNumber: 1,
          pageSize: 50,
          descending: false,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: undefined,
        },
      }),
    );
  });

  it('shows a toast (without blocking the UI) when applying a filter fails to persist', async () => {
    mockSetItemAsync.mockRejectedValue(new Error('storage full'));
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    const { getByTestId, queryByTestId } = await render(<Wrapped />);
    await waitFor(() => getByTestId('open-filters-button'));

    await fireEvent.press(getByTestId('open-filters-button'));
    await waitFor(() => getByTestId('filter-type-option-all'));
    await fireEvent.press(getByTestId('apply-filters-button'));

    await waitFor(() => expect(queryByTestId('toast')).toBeTruthy());
    expect(getByTestId('toast-message').props.children).toEqual(
      expect.stringContaining('no se pudieron guardar'),
    );
  });
});
