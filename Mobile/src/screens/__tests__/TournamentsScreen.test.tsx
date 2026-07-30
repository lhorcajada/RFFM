import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TournamentsScreen from '../TournamentsScreen';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
}));

jest.mock('../../api/sportEventTypes', () => ({
  fetchSportEventTypeMap: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: {
      teamId: 'team1',
      teamPlayerId: 'tp1',
    },
  }),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('TournamentsScreen', () => {
  let mockFetchSportEventTypeMap: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSportEventTypeMap = require('../../api/sportEventTypes').fetchSportEventTypeMap as jest.Mock;
  });

  it('shows a loading indicator before the request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockImplementation(() => {
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });
    mockFetchSportEventTypeMap.mockResolvedValue({});

    const { getByTestId, findByTestId } = await render(<TournamentsScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [] });

    await findByTestId('empty-message');
  });

  it('shows the "Torneos" section title', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });
    mockFetchSportEventTypeMap.mockResolvedValue({});

    const { findByText } = await render(<TournamentsScreen />);

    expect(await findByText('Torneos')).toBeTruthy();
  });

  it('filters tournament events only, excluding friendlies', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'event1',
          name: 'Partido vs Barcelona',
          eveDateTime: '2026-08-05T18:00:00Z',
          eventTypeId: 1,
        },
        {
          id: 'event2',
          name: 'Entrenamiento',
          eveDateTime: '2026-08-03T17:00:00Z',
          eventTypeId: 2,
        },
        {
          id: 'event3',
          name: 'Reunión de equipo',
          eveDateTime: '2026-08-02T10:00:00Z',
          eventTypeId: 3,
        },
        {
          id: 'event4',
          name: 'Amistoso vs Real Madrid',
          eveDateTime: '2026-08-07T19:00:00Z',
          eventTypeId: 4,
        },
        {
          id: 'event5',
          name: 'Torneo Regional',
          eveDateTime: '2026-08-01T15:00:00Z',
          eventTypeId: 6,
        },
      ],
    });
    mockFetchSportEventTypeMap.mockResolvedValue({
      1: 'Partido',
      2: 'Entrenamiento',
      3: 'Reunión',
      4: 'Amistoso',
      6: 'Torneo Regional',
    });

    const { getByTestId, queryByTestId } = await render(<TournamentsScreen />);

    await waitFor(() => {
      expect(getByTestId('event-item-event5')).toBeTruthy();
    });

    expect(queryByTestId('event-item-event1')).toBeNull();
    expect(queryByTestId('event-item-event2')).toBeNull();
    expect(queryByTestId('event-item-event3')).toBeNull();
    expect(queryByTestId('event-item-event4')).toBeNull();
  });

  it('shows error message when api.get rejects with detail', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'Fallo de red' } },
    });
    mockFetchSportEventTypeMap.mockResolvedValue({});

    const { findByTestId } = await render(<TournamentsScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Fallo de red');
  });

  it('shows fallback error message when error lacks detail', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));
    mockFetchSportEventTypeMap.mockResolvedValue({});

    const { findByTestId } = await render(<TournamentsScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error al cargar los torneos');
  });

  it('shows empty state when no tournament events exist', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [
        { id: 'e1', name: 'Partido', eveDateTime: '2026-08-05T18:00:00Z', eventTypeId: 1 },
        { id: 'e2', name: 'Entrenamiento', eveDateTime: '2026-08-03T17:00:00Z', eventTypeId: 2 },
        { id: 'e3', name: 'Reunión', eveDateTime: '2026-08-02T10:00:00Z', eventTypeId: 3 },
        { id: 'e4', name: 'Amistoso vs Real Madrid', eveDateTime: '2026-08-07T19:00:00Z', eventTypeId: 4 },
      ],
    });
    mockFetchSportEventTypeMap.mockResolvedValue({
      1: 'Partido',
      2: 'Entrenamiento',
      3: 'Reunión',
      4: 'Amistoso',
    });

    const { findByTestId } = await render(<TournamentsScreen />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay torneos próximos');
  });

  it('retries the request when retry button is pressed', async () => {
    let attempt = 0;
    (mockApi.get as jest.Mock).mockImplementation(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.reject({ response: { data: { detail: 'Error' } } });
      }
      return Promise.resolve({ data: [] });
    });
    mockFetchSportEventTypeMap.mockResolvedValue({});

    const { getByTestId, findByTestId } = await render(<TournamentsScreen />);

    await findByTestId('error-message');

    await fireEvent.press(getByTestId('retry-button'));

    await findByTestId('empty-message');
  });

  it('navigates to EventDetail with correct params when event card is pressed', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'event42',
          name: 'Torneo Regional',
          eveDateTime: '2026-08-07T19:00:00Z',
          eventTypeId: 6,
        },
      ],
    });
    mockFetchSportEventTypeMap.mockResolvedValue({
      6: 'Torneo Regional',
    });

    const { getByTestId } = await render(<TournamentsScreen />);

    await waitFor(() => getByTestId('event-item-event42'));
    await fireEvent.press(getByTestId('event-item-event42'));

    expect(mockNavigate).toHaveBeenCalledWith('EventDetail', {
      eventId: 'event42',
      teamId: 'team1',
      teamPlayerId: 'tp1',
    });
  });

  it('calls api.get with correct parameters including startDate', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });
    mockFetchSportEventTypeMap.mockResolvedValue({});

    await render(<TournamentsScreen />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: expect.objectContaining({
          pageNumber: 1,
          pageSize: 50,
          descending: false,
          startDate: expect.any(String),
        }),
      });
    });
  });
});
