import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlayerSeasonCardsScreen from '../PlayerSeasonCardsScreen';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
  API_BASE_URL: 'https://api.example.com',
}));

const mockUseRoute = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
}));

const mockApi = api as jest.Mocked<typeof api>;

const cardOne = {
  teamPlayerId: 'player1',
  alias: 'John Doe',
  urlPhoto: null,
  dorsal: 7,
  currentMatchday: 6,
  matchesPlayed: 5,
  matchesStarted: 4,
  matchesSinceLastDeconvocation: 5,
  yellowCards: 2,
  redCards: 0,
  goals: 3,
  trainingsAttended: 10,
  trainingsAbsent: 2,
  trainingsPossible: 14,
  activeDemarcation: { id: 1, name: 'Portero', code: 'POR' },
  possibleDemarcations: [
    { id: 1, name: 'Portero', code: 'POR' },
    { id: 2, name: 'Defensa central', code: 'DFC' },
  ],
};

const cardTwo = {
  teamPlayerId: 'player2',
  alias: 'Jane Smith',
  urlPhoto: 'https://example.com/photo.jpg',
  dorsal: 9,
  currentMatchday: 6,
  matchesPlayed: 3,
  matchesStarted: 1,
  matchesSinceLastDeconvocation: 1,
  yellowCards: 0,
  redCards: 1,
  goals: 0,
  trainingsAttended: 8,
  trainingsAbsent: 4,
  trainingsPossible: 14,
  activeDemarcation: null,
  possibleDemarcations: [],
};

describe('PlayerSeasonCardsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1' } });
  });

  it('shows a loading indicator before the season cards request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId } = await render(<PlayerSeasonCardsScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [cardOne] });

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
  });

  it('fetches the season cards for the team from route params on mount', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    await render(<PlayerSeasonCardsScreen />);

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/api/mobile/teams/team1/season-player-cards'),
    );
  });

  it('shows an error and lets the user retry when loading fails', async () => {
    (mockApi.get as jest.Mock)
      .mockRejectedValueOnce({ response: { data: { detail: 'Error del servidor' } } })
      .mockResolvedValueOnce({ data: [cardOne] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error del servidor');

    await fireEvent.press(await findByTestId('retry-button'));

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
    fireEvent.press(await findByTestId('position-section-header-porteros'));
    await findByTestId('player-season-card-player1');
  });

  it('falls back to a statistics-worded error when the server sends no detail', async () => {
    (mockApi.get as jest.Mock).mockRejectedValueOnce({ response: { data: {} } });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error al cargar las estadísticas');
  });

  it('shows an empty-state message when there are no players', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay información disponible');
  });

  it('renders one card per player with alias and dorsal', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne, cardTwo] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    const card1 = await findByTestId('player-season-card-player1');
    expect(card1).toBeTruthy();
    expect((await findByTestId('player-alias-player1')).props.children).toBe('John Doe');
    expect((await findByTestId('player-dorsal-player1')).props.children).toBe(7);

    fireEvent.press(await findByTestId('position-section-header-sin-posicion'));
    const card2 = await findByTestId('player-season-card-player2');
    expect(card2).toBeTruthy();
  });

  it('shows the player photo when urlPhoto is an absolute URL', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardTwo] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-sin-posicion'));
    const photo = await findByTestId('player-photo-player2');
    expect(photo.props.source).toEqual({ uri: 'https://example.com/photo.jpg' });
  });

  it('resolves a relative urlPhoto through the public storage proxy', async () => {
    const cardWithRelativePhoto = { ...cardOne, urlPhoto: 'players/club1/abc123.jpg' };
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardWithRelativePhoto] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    const photo = await findByTestId('player-photo-player1');
    expect(photo.props.source).toEqual({
      uri: 'https://api.example.com/api/public/storage?url=players%2Fclub1%2Fabc123.jpg',
    });
  });

  it('shows a placeholder when the player has no photo', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    await findByTestId('player-photo-placeholder-player1');
    expect(queryByTestId('player-photo-player1')).toBeNull();
  });

  it('renders all 10 season stat fields for a player', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    expect((await findByTestId('stat-currentMatchday-player1')).props.children).toBe(6);
    expect((await findByTestId('stat-matchesPlayed-player1')).props.children).toBe(5);
    expect((await findByTestId('stat-matchesStarted-player1')).props.children).toBe(4);
    expect((await findByTestId('stat-matchesSinceLastDeconvocation-player1')).props.children).toBe(5);
    expect((await findByTestId('stat-yellowCards-player1')).props.children).toBe(2);
    expect((await findByTestId('stat-redCards-player1')).props.children).toBe(0);
    expect((await findByTestId('stat-goals-player1')).props.children).toBe(3);
    expect((await findByTestId('stat-trainingsAttended-player1')).props.children).toBe(10);
    expect((await findByTestId('stat-trainingsAbsent-player1')).props.children).toBe(2);
    expect((await findByTestId('stat-trainingsPossible-player1')).props.children).toBe(14);
  });

  it('shows the active demarcation name/code when the player has one', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    const demarcation = await findByTestId('player-demarcation-player1');
    expect(demarcation.props.children).toEqual(expect.stringContaining('Portero'));
  });

  it('renders a chip per possible demarcation when present', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    const chip1 = await findByTestId('player-possible-demarcation-player1-1');
    const chip2 = await findByTestId('player-possible-demarcation-player1-2');
    expect(chip1.props.children).toBe('POR');
    expect(chip2.props.children).toBe('DFC');
  });

  it('shows a discreet placeholder and no possible-demarcation chips for a player without a demarcation', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardTwo] });

    const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-sin-posicion'));
    const demarcation = await findByTestId('player-demarcation-player2');
    expect(demarcation.props.children).toBe('-');
    expect(queryByTestId(/player-possible-demarcation-player2-/)).toBeNull();
  });

  it('renders no edit controls for any role, read-only screen', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { queryByTestId, queryByText, findByTestId } = await render(<PlayerSeasonCardsScreen />);

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    fireEvent.press(await findByTestId('position-section-header-porteros'));
    expect(queryByTestId(/button/)).toBeNull();
    expect(queryByText(/Guardar|Editar|Confirmar/)).toBeNull();
  });

  it('Section headers render in the fixed order, only for groups that have players', async () => {
    const cards = [
      { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
      { ...cardOne, teamPlayerId: 'player3', activeDemarcation: { id: 4, name: 'Defensa Central', code: 'DFC' } },
      { ...cardOne, teamPlayerId: 'player4', activeDemarcation: { id: 11, name: 'Delantero Centro', code: 'DC' } },
      { ...cardTwo, teamPlayerId: 'player5', activeDemarcation: null },
    ];

    (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

    const { findAllByTestId } = await render(<PlayerSeasonCardsScreen />);

    const headers = await findAllByTestId(/^position-section-header-/);
    const orderedKeys = headers.map((h) => h.props.testID);
    expect(orderedKeys).toEqual([
      'position-section-header-porteros',
      'position-section-header-defensas',
      'position-section-header-delanteros',
      'position-section-header-sin-posicion',
    ]);
  });

  it('Sin posición header absent when no player lacks a demarcation', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(queryByTestId('position-section-header-sin-posicion')).toBeNull();
  });

  it('Existing per-card fields still resolve after grouping', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne, cardTwo] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    expect((await findByTestId('player-alias-player1')).props.children).toBe('John Doe');
    expect((await findByTestId('player-dorsal-player1')).props.children).toBe(7);

    fireEvent.press(await findByTestId('position-section-header-sin-posicion'));
    expect((await findByTestId('player-demarcation-player2')).props.children).toBe('-');
  });

  it('all sections start collapsed on mount', async () => {
    const cards = [
      { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
      { ...cardTwo, teamPlayerId: 'player5', activeDemarcation: null },
    ];
    (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

    const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    await findByTestId('position-section-header-porteros');
    expect(queryByTestId('player-season-card-player1')).toBeNull();
    expect(queryByTestId('player-season-card-player5')).toBeNull();
  });

  it('expands a section on tap, revealing only its own cards', async () => {
    const cards = [
      { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
      { ...cardTwo, teamPlayerId: 'player5', activeDemarcation: null },
    ];
    (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

    const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));

    await findByTestId('player-season-card-player1');
    expect(queryByTestId('player-season-card-player5')).toBeNull();
  });

  it('collapses an expanded section on a second tap', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    const header = await findByTestId('position-section-header-porteros');
    fireEvent.press(header);
    await findByTestId('player-season-card-player1');

    fireEvent.press(header);
    await waitFor(() => {
      expect(queryByTestId('player-season-card-player1')).toBeNull();
    });
  });

  it('exclusive accordion: expanding one section collapses the previously expanded one', async () => {
    const cards = [
      { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
      { ...cardOne, teamPlayerId: 'player3', activeDemarcation: { id: 4, name: 'Defensa Central', code: 'DFC' } },
    ];
    (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

    const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

    fireEvent.press(await findByTestId('position-section-header-porteros'));
    await findByTestId('player-season-card-player1');

    fireEvent.press(await findByTestId('position-section-header-defensas'));
    await findByTestId('player-season-card-player3');
    expect(queryByTestId('player-season-card-player1')).toBeNull();
  });

  it('chevron icon reflects the collapsed/expanded state', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    const chevronCollapsed = await findByTestId('position-section-chevron-porteros');
    expect(chevronCollapsed.props.name).toBe('chevron-forward-outline');

    fireEvent.press(await findByTestId('position-section-header-porteros'));

    const chevronExpanded = await findByTestId('position-section-chevron-porteros');
    expect(chevronExpanded.props.name).toBe('chevron-down-outline');
  });

  it('shows the player count in the header in both collapsed and expanded states', async () => {
    const cards = [
      { ...cardOne, activeDemarcation: { id: 4, name: 'Defensa Central', code: 'DFC' } },
      { ...cardOne, teamPlayerId: 'player3', activeDemarcation: { id: 3, name: 'Lateral Derecho', code: 'LD' } },
    ];
    (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

    const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

    const headerCollapsed = await findByTestId('position-section-header-defensas');
    expect(headerCollapsed).toHaveTextContent('Defensas (2)');

    fireEvent.press(headerCollapsed);

    const headerExpanded = await findByTestId('position-section-header-defensas');
    expect(headerExpanded).toHaveTextContent('Defensas (2)');
  });
});
