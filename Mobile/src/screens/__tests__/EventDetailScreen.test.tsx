import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EventDetailScreen from '../EventDetailScreen';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { coachColors } from '../../theme/colors';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  API_BASE_URL: 'https://api.example.com',
}));
jest.mock('../../auth/AuthContext');
jest.mock('../../i18n', () => ({
  t: (key: string) => {
    const dict: Record<string, string> = {
      'attendance.going': 'Voy',
      'attendance.notGoing': 'No voy',
      'attendance.pending': 'Pendiente',
      'attendanceGroups.pending': 'Pendientes',
      'attendanceGroups.going': 'Asisten',
      'attendanceGroups.notGoing': 'No asisten',
    };
    return dict[key] ?? key;
  },
}));

const mockUseRoute = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAuth = useAuth as jest.Mock;

const myRow = {
  teamPlayerId: 'player1',
  alias: 'John Doe',
  urlPhoto: null,
  dorsal: 7,
  status: 'Pending',
  statusId: 0,
};

const otherPendingRow = {
  teamPlayerId: 'other-pending',
  alias: 'Other Pending',
  urlPhoto: null,
  dorsal: 4,
  status: 'Pending',
  statusId: 0,
};

const goingRow = {
  teamPlayerId: 'someone-going',
  alias: 'Someone Going',
  urlPhoto: null,
  dorsal: 9,
  status: 'Going',
  statusId: 1,
};

const notGoingRow = {
  teamPlayerId: 'someone-not-going',
  alias: 'Someone NotGoing',
  urlPhoto: null,
  dorsal: 11,
  status: 'NotGoing',
  statusId: 2,
};

const fullRoster = [otherPendingRow, myRow, goingRow, notGoingRow];

describe('EventDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({
      params: { eventId: 'event1', teamId: 'team1', teamPlayerId: 'player1' },
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Player'] });
  });

  it('shows a loading indicator before the roster request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId, findByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: fullRoster });

    await findByTestId('group-header-Pending');
  }, 15000);

  it('shows an error and lets the user retry when loading the roster fails', async () => {
    (mockApi.get as jest.Mock)
      .mockRejectedValueOnce({ response: { data: { detail: 'Error del servidor' } } })
      .mockResolvedValueOnce({ data: fullRoster });

    const { findByTestId } = await render(<EventDetailScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error del servidor');

    await fireEvent.press(await findByTestId('retry-button'));

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
    await findByTestId('group-header-Pending');
  });

  it('shows an empty-state message when the roster is empty', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });

    const { findByTestId } = await render(<EventDetailScreen />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay información disponible');
  });

  it('shows the three groups with the correct label and player count', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: fullRoster });

    const { findByTestId } = await render(<EventDetailScreen />);

    expect((await findByTestId('group-label-Pending')).props.children.join('')).toBe('Pendientes (2)');
    expect((await findByTestId('group-label-Going')).props.children.join('')).toBe('Asisten (1)');
    expect((await findByTestId('group-label-NotGoing')).props.children.join('')).toBe('No asisten (1)');
  });

  it('for a Player role, only the group containing my own player is expanded initially', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: fullRoster });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await findByTestId('roster-row-player1');
    expect(queryByTestId('roster-row-someone-going')).toBeNull();
    expect(queryByTestId('roster-row-someone-not-going')).toBeNull();
  });

  it('for a Coach role, the Pending group is expanded initially regardless of anything else', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Coach'] });
    mockUseRoute.mockReturnValue({
      params: { eventId: 'event1', teamId: 'team1', teamPlayerId: 'someone-going' },
    });
    (mockApi.get as jest.Mock).mockResolvedValue({ data: fullRoster });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await findByTestId('roster-row-player1');
    await findByTestId('roster-row-other-pending');
    expect(queryByTestId('roster-row-someone-going')).toBeNull();
  });

  it('expands a collapsed group when its header is tapped', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: fullRoster });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await findByTestId('roster-row-player1');
    expect(queryByTestId('roster-row-someone-going')).toBeNull();

    await fireEvent.press(await findByTestId('group-header-Going'));

    expect(await findByTestId('roster-row-someone-going')).toBeTruthy();
  });

  it('collapses an expanded group when its header is tapped again', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: fullRoster });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await findByTestId('roster-row-player1');
    await fireEvent.press(await findByTestId('group-header-Pending'));

    await waitFor(() => expect(queryByTestId('roster-row-player1')).toBeNull());
  });

  it('shows my own player first within its group', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: fullRoster });

    const { findByTestId, getAllByTestId } = await render(<EventDetailScreen />);

    await findByTestId('roster-row-player1');
    const rows = getAllByTestId(/^roster-row-/);
    expect(rows[0].props.testID).toBe('roster-row-player1');
  });

  it('shows the player photo when urlPhoto is an absolute URL', async () => {
    const rowWithPhoto = { ...myRow, urlPhoto: 'https://example.com/photo.jpg' };
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [rowWithPhoto] });

    const { findByTestId } = await render(<EventDetailScreen />);

    const photo = await findByTestId('player-photo-player1');
    expect(photo.props.source).toEqual({ uri: 'https://example.com/photo.jpg' });
  });

  it('resolves a relative urlPhoto through the public storage proxy', async () => {
    const rowWithRelativePhoto = { ...myRow, urlPhoto: 'players/club1/abc123.jpg' };
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [rowWithRelativePhoto] });

    const { findByTestId } = await render(<EventDetailScreen />);

    const photo = await findByTestId('player-photo-player1');
    expect(photo.props.source).toEqual({
      uri: 'https://api.example.com/api/public/storage?url=players%2Fclub1%2Fabc123.jpg',
    });
  });

  it('shows a placeholder when the player has no photo', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow] });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await findByTestId('player-photo-placeholder-player1');
    expect(queryByTestId('player-photo-player1')).toBeNull();
  });

  it('shows edit buttons only on my own row for a Player role', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow, otherPendingRow] });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await findByTestId('going-button-player1');
    expect(queryByTestId('going-button-other-pending')).toBeNull();
    expect(queryByTestId('not-going-button-other-pending')).toBeNull();
    expect(queryByTestId('pending-button-other-pending')).toBeNull();
  });

  it('shows edit buttons on every row for a Coach role once its group is expanded', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Coach'] });
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow, otherPendingRow] });

    const { findByTestId } = await render(<EventDetailScreen />);

    expect(await findByTestId('going-button-player1')).toBeTruthy();
    expect(await findByTestId('going-button-other-pending')).toBeTruthy();
    expect(await findByTestId('pending-button-player1')).toBeTruthy();
    expect(await findByTestId('pending-button-other-pending')).toBeTruthy();
  });

  it('confirms attendance for my own row, moves it to the new group and keeps it visible', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow] });
    (mockApi.post as jest.Mock).mockResolvedValue({ data: {} });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);
    await fireEvent.press(await findByTestId('going-button-player1'));

    await waitFor(() => expect(queryByTestId('roster-row-player1')).toBeTruthy());
    expect((await findByTestId('group-label-Going')).props.children.join('')).toBe('Asisten (1)');
    expect((await findByTestId('group-label-Pending')).props.children.join('')).toBe('Pendientes (0)');
    expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/events/event1/attendance', {
      teamId: 'team1',
      teamPlayerId: 'player1',
      status: 'Going',
    });
  });

  it('a Coach confirms attendance for another player', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Coach'] });
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow, otherPendingRow] });
    (mockApi.post as jest.Mock).mockResolvedValue({ data: {} });

    const { findByTestId } = await render(<EventDetailScreen />);
    await fireEvent.press(await findByTestId('not-going-button-other-pending'));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/events/event1/attendance', {
        teamId: 'team1',
        teamPlayerId: 'other-pending',
        status: 'NotGoing',
      }),
    );
  });

  it('shows an error message when confirming attendance fails and keeps the previous status', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow] });
    (mockApi.post as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'No autorizado' } },
    });

    const { findByTestId } = await render(<EventDetailScreen />);
    await fireEvent.press(await findByTestId('not-going-button-player1'));

    await waitFor(async () =>
      expect((await findByTestId('error-message')).props.children).toBe('No autorizado'),
    );
  });

  it('marks attendance as pending for my own row, moves it to the Pending group and keeps it visible', async () => {
    const myRowGoing = { ...myRow, status: 'Going' };
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRowGoing] });
    (mockApi.post as jest.Mock).mockResolvedValue({ data: {} });

    const { findByTestId, queryByTestId } = await render(<EventDetailScreen />);
    await fireEvent.press(await findByTestId('pending-button-player1'));

    await waitFor(() => expect(queryByTestId('roster-row-player1')).toBeTruthy());
    expect((await findByTestId('group-label-Pending')).props.children.join('')).toBe('Pendientes (1)');
    expect((await findByTestId('group-label-Going')).props.children.join('')).toBe('Asisten (0)');
    expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/events/event1/attendance', {
      teamId: 'team1',
      teamPlayerId: 'player1',
      status: 'Pending',
    });
  });

  it('renders the three action buttons identically styled, except the one matching the current status which looks pressed/selected', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Coach'] });
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [goingRow] });

    const { findByTestId } = await render(<EventDetailScreen />);
    await fireEvent.press(await findByTestId('group-header-Going'));

    const goingButton = await findByTestId('going-button-someone-going');
    const notGoingButton = await findByTestId('not-going-button-someone-going');
    const pendingButton = await findByTestId('pending-button-someone-going');

    const flatten = (style: unknown) => StyleSheet.flatten(style as never);

    expect(flatten(notGoingButton.props.style)).toEqual(flatten(pendingButton.props.style));
    expect(flatten(goingButton.props.style)).not.toEqual(flatten(notGoingButton.props.style));
    expect(flatten(goingButton.props.style)).toMatchObject({ backgroundColor: coachColors.secondary });
    expect(flatten(notGoingButton.props.style)).not.toMatchObject({ backgroundColor: coachColors.secondary });
  });

  it('marks the Pending button as selected (not Going) when the row status is Pending', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Coach'] });
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [otherPendingRow] });

    const { findByTestId } = await render(<EventDetailScreen />);

    const goingButton = await findByTestId('going-button-other-pending');
    const notGoingButton = await findByTestId('not-going-button-other-pending');
    const pendingButton = await findByTestId('pending-button-other-pending');

    const flatten = (style: unknown) => StyleSheet.flatten(style as never);

    expect(flatten(pendingButton.props.style)).toMatchObject({ backgroundColor: coachColors.secondary });
    expect(flatten(goingButton.props.style)).toEqual(flatten(notGoingButton.props.style));
    expect(flatten(goingButton.props.style)).not.toMatchObject({ backgroundColor: coachColors.secondary });
  });

  it('a Coach marks another player as pending', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, roles: ['Coach'] });
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [myRow, goingRow] });
    (mockApi.post as jest.Mock).mockResolvedValue({ data: {} });

    const { findByTestId } = await render(<EventDetailScreen />);
    await fireEvent.press(await findByTestId('group-header-Going'));
    await fireEvent.press(await findByTestId('pending-button-someone-going'));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/events/event1/attendance', {
        teamId: 'team1',
        teamPlayerId: 'someone-going',
        status: 'Pending',
      }),
    );
  });
});
