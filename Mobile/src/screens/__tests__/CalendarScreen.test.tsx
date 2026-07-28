import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CalendarScreen from '../CalendarScreen';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
}));
jest.mock('expo-secure-store');

const mockUseRoute = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockApi = api as jest.Mocked<typeof api>;

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
  });

  it('shows a loading indicator before the events request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });

    const { getByTestId, findByTestId } = await render(<CalendarScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [] });

    await findByTestId('empty-message');
  });

  it('requests events and event types for the teamId coming from route params', async () => {
    mockEventTypesOnce([]);

    await render(<CalendarScreen />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: { pageNumber: 1, pageSize: 50, descending: false },
      }),
    );
    expect(mockApi.get).toHaveBeenCalledWith('/api/sport-event-types');
  });

  it('shows the "Eventos" section title', async () => {
    mockEventTypesOnce([]);

    const { findByText } = await render(<CalendarScreen />);

    expect(await findByText('Eventos')).toBeTruthy();
  });

  it('shows an empty-state message when there are no events', async () => {
    mockEventTypesOnce([]);

    const { findByTestId } = await render(<CalendarScreen />);

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

    const { findByText, getByText } = await render(<CalendarScreen />);

    await findByText('Training');
    expect(getByText('Barcelona', { exact: false })).toBeTruthy();
  });

  it('navigates to EventDetail with eventId, teamId and teamPlayerId when a card is pressed', async () => {
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });
    (mockApi.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/sport-event-types') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [{ id: 'event1', name: 'Training', eveDateTime: '2026-07-27' }] });
    });

    const { getByTestId } = await render(<CalendarScreen />);
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

    const { findByTestId, getByTestId } = await render(<CalendarScreen />);

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

    const { findByTestId } = await render(<CalendarScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Team ID not provided');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});
