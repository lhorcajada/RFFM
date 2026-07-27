import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EventDetailScreen from '../EventDetailScreen';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../../auth/AuthContext');

const mockUseRoute = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAuth = useAuth as jest.Mock;

const otherPlayerConvocation = {
  convocationId: 'conv-other',
  teamPlayerId: 'someone-else',
  alias: 'Someone Else',
  status: 'Going',
};

const myConvocation = {
  convocationId: 'conv1',
  teamPlayerId: 'player1',
  alias: 'John Doe',
  status: 'Pending',
};

describe('EventDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({
      params: { eventId: 'event1', teamId: 'team1', teamPlayerId: 'player1' },
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
  });

  it('shows a loading indicator before the convocation request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId, findByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [otherPlayerConvocation, myConvocation] });

    await findByTestId('status-text');
  }, 15000);

  it('fetches the event convocations and renders only my own entry', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [otherPlayerConvocation, myConvocation],
    });

    const { findByText, getByTestId, queryByText } = await render(<EventDetailScreen />);

    await findByText('John Doe');
    expect(mockApi.get).toHaveBeenCalledWith('/api/events/event1/convocations');
    expect(getByTestId('status-text').props.children.join('')).toBe('Estado: Pending');
    expect(queryByText('Someone Else')).toBeNull();
  });

  it('confirms attendance and updates the status shown on screen', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myConvocation] });
    (mockApi.post as jest.Mock).mockResolvedValue({ data: {} });

    const { findByTestId, getByTestId } = await render(<EventDetailScreen />);
    await findByTestId('going-button');

    await fireEvent.press(getByTestId('going-button'));

    await waitFor(() =>
      expect(getByTestId('status-text').props.children.join('')).toBe('Estado: Going'),
    );
    expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/events/event1/attendance', {
      teamId: 'team1',
      teamPlayerId: 'player1',
      status: 'Going',
    });
  });

  it('shows an error message when confirming attendance fails (e.g. unlinked player) and keeps the previous status', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myConvocation] });
    (mockApi.post as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'No autorizado' } },
    });

    const { findByTestId, getByTestId } = await render(<EventDetailScreen />);
    await findByTestId('not-going-button');

    await fireEvent.press(getByTestId('not-going-button'));

    await waitFor(() => expect(getByTestId('error-message').props.children).toBe('No autorizado'));
  });

  it('shows an error and lets the user retry when loading the convocations fails', async () => {
    (mockApi.get as jest.Mock)
      .mockRejectedValueOnce({ response: { data: { detail: 'Error del servidor' } } })
      .mockResolvedValueOnce({ data: [myConvocation] });

    const { findByTestId, getByTestId } = await render(<EventDetailScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error del servidor');

    await fireEvent.press(getByTestId('retry-button'));

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
    await findByTestId('status-text');
  });

  it('shows an empty-state message when my player has no convocation for this event', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [otherPlayerConvocation] });

    const { findByTestId } = await render(<EventDetailScreen />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay información disponible');
  });
});
