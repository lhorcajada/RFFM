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

describe('CalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1' } });
  });

  it('shows a loading indicator before the events request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId, findByTestId } = await render(<CalendarScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [] });

    await findByTestId('empty-message');
  });

  it('requests events for the teamId coming from route params', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });

    await render(<CalendarScreen />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/sport-events/team1', {
        params: { pageNumber: 1, pageSize: 50, descending: false },
      }),
    );
  });

  it('shows an empty-state message when there are no events', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });

    const { findByTestId } = await render(<CalendarScreen />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay eventos programados');
  });

  it('renders event title, date and opponent when events are returned', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [{ id: '1', name: 'Training', eveDateTime: '2026-07-27', rivalName: 'Barcelona' }],
    });

    const { findByText, getByText } = await render(<CalendarScreen />);

    await findByText('Training');
    expect(getByText('2026-07-27')).toBeTruthy();
    expect(getByText('vs Barcelona')).toBeTruthy();
  });

  it('navigates to EventDetail with eventId, teamId and teamPlayerId when an event is pressed', async () => {
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [{ id: 'event1', name: 'Training', eveDateTime: '2026-07-27' }],
    });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId('event-item-event1'));

    expect(mockNavigate).toHaveBeenCalledWith('EventDetail', {
      eventId: 'event1',
      teamId: 'team1',
      teamPlayerId: 'player1',
    });
  });

  it('shows an error and lets the user retry the request', async () => {
    (mockApi.get as jest.Mock)
      .mockRejectedValueOnce({ response: { data: { detail: 'Error de red' } } })
      .mockResolvedValueOnce({ data: [] });

    const { findByTestId, getByTestId } = await render(<CalendarScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error de red');

    await fireEvent.press(getByTestId('retry-button'));

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
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
