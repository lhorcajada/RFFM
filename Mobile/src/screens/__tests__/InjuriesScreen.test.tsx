import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import InjuriesScreen from '../InjuriesScreen';
import { api } from '../../api/client';
import * as injuriesApi from '../../api/injuries';

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: { teamId: 'team1' } })),
}));

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
  API_BASE_URL: 'https://example.com',
}));

jest.mock('../../api/injuries');

const mockApi = api as jest.Mocked<typeof api>;

const mockRosterData = [
  {
    teamPlayerId: 'player1',
    alias: 'Juan',
    urlPhoto: '/photos/juan.jpg',
    activeDemarcation: { id: 1, name: 'Delantero', code: 'DEL' },
  },
  {
    teamPlayerId: 'player2',
    alias: 'Pedro',
    urlPhoto: null,
    activeDemarcation: { id: 2, name: 'Portero', code: 'POR' },
  },
];

const mockInjuries1 = [
  {
    id: 'inj1',
    startDate: '2025-01-15',
    injuryType: 'Fractura',
    description: 'Fractura de tibia',
    estimatedRecovery: '4 semanas',
    endDate: null,
  },
];

const mockInjuries2 = [
  {
    id: 'inj2',
    startDate: '2025-01-10',
    injuryType: 'Esguince',
    description: null,
    estimatedRecovery: null,
    endDate: '2025-01-20',
  },
];

describe('InjuriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading indicator while fetching data', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId } = await render(<InjuriesScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('fetches roster from /api/mobile/teams/{teamId}/season-player-cards', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValue([]);

    await render(<InjuriesScreen />);

    expect(mockApi.get).toHaveBeenCalledWith('/api/mobile/teams/team1/season-player-cards');
  });

  it('fetches injuries for each player in the roster', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock)
      .mockResolvedValueOnce(mockInjuries1)
      .mockResolvedValueOnce(mockInjuries2);

    await render(<InjuriesScreen />);

    expect(injuriesApi.getTeamPlayerInjuries).toHaveBeenCalledWith('player1');
    expect(injuriesApi.getTeamPlayerInjuries).toHaveBeenCalledWith('player2');
  });

  it('renders injury records with player info and status "De baja" when endDate is null', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValueOnce(mockInjuries1).mockResolvedValueOnce([]);

    const { findByTestId, findByText } = await render(<InjuriesScreen />);

    expect(await findByTestId('player-alias-inj1')).toBeTruthy();
    expect(await findByTestId('player-position-inj1')).toBeTruthy();
    expect(await findByText('De baja')).toBeTruthy();
    expect(await findByText('Fractura')).toBeTruthy();
    expect(await findByText('Fractura de tibia')).toBeTruthy();
    expect(await findByText('4 semanas')).toBeTruthy();
  });

  it('renders status "De alta" when endDate is not null', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce(mockInjuries2);

    const { findByText } = await render(<InjuriesScreen />);

    expect(await findByText('De alta')).toBeTruthy();
  });

  it('renders "Sin definir" when endDate is null', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValueOnce(mockInjuries1).mockResolvedValueOnce([]);

    const { findByText } = await render(<InjuriesScreen />);

    expect(await findByText('Sin definir')).toBeTruthy();
  });

  it('shows the "Lesiones" section title', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<InjuriesScreen />);

    expect(await findByText('Lesiones')).toBeTruthy();
  });

  it('renders empty state when no injuries are found after successful roster load', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValue([]);

    const { findByTestId } = await render(<InjuriesScreen />);

    expect(await findByTestId('empty-message')).toBeTruthy();
  });

  it('displays error message when roster fetch fails', async () => {
    const error: any = new Error('network error');
    error.response = { data: { detail: 'Error al conectar' } };
    (mockApi.get as jest.Mock).mockRejectedValue(error);

    const { findByTestId, findByText } = await render(<InjuriesScreen />);

    expect(await findByTestId('error-message')).toBeTruthy();
    expect(await findByText('Error al conectar')).toBeTruthy();
  });

  it('renders injury startDate formatted correctly', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (injuriesApi.getTeamPlayerInjuries as jest.Mock).mockResolvedValueOnce(mockInjuries1).mockResolvedValueOnce([]);

    const { findByTestId } = await render(<InjuriesScreen />);

    expect(await findByTestId('injury-date-inj1')).toBeTruthy();
  });
});
