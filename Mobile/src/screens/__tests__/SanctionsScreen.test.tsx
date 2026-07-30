import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SanctionsScreen from '../SanctionsScreen';
import { api } from '../../api/client';
import * as sanctionsApi from '../../api/sanctions';

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: { teamId: 'team1' } })),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
  API_BASE_URL: 'https://example.com',
}));

jest.mock('../../api/sanctions');

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

const mockCompetitionSanctions = [
  {
    id: 'sanc1',
    category: 'Competition' as const,
    startDate: '2025-01-15',
    sanctionType: 'Expulsión',
    description: 'Tarjeta roja',
    estimatedEnd: '2025-01-24',
    endDate: null,
  },
];

const mockInternalSanctions = [
  {
    id: 'sanc2',
    category: 'InternalDiscipline' as const,
    startDate: '2025-01-10',
    sanctionType: 'Multa',
    description: null,
    estimatedEnd: null,
    endDate: '2025-01-20',
  },
];

describe('SanctionsScreen', () => {
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

    const { getByTestId } = await render(<SanctionsScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('fetches roster from /api/mobile/teams/{teamId}/season-player-cards', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock).mockResolvedValue([]);

    await render(<SanctionsScreen />);

    expect(mockApi.get).toHaveBeenCalledWith('/api/mobile/teams/team1/season-player-cards');
  });

  it('fetches both categories of sanctions for each player', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock).mockResolvedValue([]);

    await render(<SanctionsScreen />);

    expect(sanctionsApi.getTeamPlayerSanctions).toHaveBeenCalledWith('player1', 'Competition');
    expect(sanctionsApi.getTeamPlayerSanctions).toHaveBeenCalledWith('player1', 'InternalDiscipline');
    expect(sanctionsApi.getTeamPlayerSanctions).toHaveBeenCalledWith('player2', 'Competition');
    expect(sanctionsApi.getTeamPlayerSanctions).toHaveBeenCalledWith('player2', 'InternalDiscipline');
  });

  it('shows the "Sanciones" section title', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock).mockResolvedValue([]);

    const { getByTestId } = await render(<SanctionsScreen />);

    expect(getByTestId('screen-header-title').props.children).toBe('Sanciones');
  });

  it('renders segmented control with "En competición" and "Por normas internas" tabs', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<SanctionsScreen />);

    expect(await findByText('En competición')).toBeTruthy();
    expect(await findByText('Por normas internas')).toBeTruthy();
  });

  it('renders Competition sanctions by default', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock)
      .mockResolvedValueOnce(mockCompetitionSanctions) // player1 Competition
      .mockResolvedValueOnce(mockInternalSanctions) // player1 InternalDiscipline
      .mockResolvedValueOnce([]) // player2 Competition
      .mockResolvedValueOnce([]); // player2 InternalDiscipline

    const { findByTestId, findByText } = await render(<SanctionsScreen />);

    expect(await findByTestId('sanction-item-sanc1')).toBeTruthy();
    expect(await findByText('Expulsión')).toBeTruthy();
  });

  it('switches to InternalDiscipline sanctions when tab is pressed', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock)
      .mockResolvedValueOnce(mockCompetitionSanctions) // player1 Competition
      .mockResolvedValueOnce(mockInternalSanctions) // player1 InternalDiscipline
      .mockResolvedValueOnce([]) // player2 Competition
      .mockResolvedValueOnce([]); // player2 InternalDiscipline

    const { findByTestId, findByText, queryByTestId } = await render(<SanctionsScreen />);

    expect(await findByTestId('sanction-item-sanc1')).toBeTruthy();

    const internalTab = await findByText('Por normas internas');
    fireEvent.press(internalTab);

    expect(await findByTestId('sanction-item-sanc2')).toBeTruthy();
    expect(queryByTestId('sanction-item-sanc1')).toBeFalsy();
  });

  it('renders status "Activa" when endDate is null', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock)
      .mockResolvedValueOnce(mockCompetitionSanctions)
      .mockResolvedValueOnce(mockInternalSanctions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { findByText } = await render(<SanctionsScreen />);

    expect(await findByText('Activa')).toBeTruthy();
  });

  it('renders status "Resuelta" when endDate is not null', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock)
      .mockResolvedValueOnce(mockCompetitionSanctions)
      .mockResolvedValueOnce(mockInternalSanctions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { findByText } = await render(<SanctionsScreen />);

    const internalTab = await findByText('Por normas internas');
    fireEvent.press(internalTab);

    expect(await findByText('Resuelta')).toBeTruthy();
  });

  it('renders sanction detail with type, startDate, description and estimatedEnd', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock)
      .mockResolvedValueOnce(mockCompetitionSanctions)
      .mockResolvedValueOnce(mockInternalSanctions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { findByTestId, findByText } = await render(<SanctionsScreen />);

    expect(await findByTestId('sanction-date-sanc1')).toBeTruthy();
    expect(await findByText('Expulsión')).toBeTruthy();
    expect(await findByText('Tarjeta roja')).toBeTruthy();
  });

  it('renders empty state when no sanctions are found after successful roster load', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: mockRosterData });
    (sanctionsApi.getTeamPlayerSanctions as jest.Mock).mockResolvedValue([]);

    const { findByTestId } = await render(<SanctionsScreen />);

    expect(await findByTestId('empty-message')).toBeTruthy();
  });

  it('displays error message when roster fetch fails', async () => {
    const error: any = new Error('network error');
    error.response = { data: { detail: 'Error al conectar' } };
    (mockApi.get as jest.Mock).mockRejectedValue(error);

    const { findByTestId, findByText } = await render(<SanctionsScreen />);

    expect(await findByTestId('error-message')).toBeTruthy();
    expect(await findByText('Error al conectar')).toBeTruthy();
  });
});
