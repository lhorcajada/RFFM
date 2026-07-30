import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LeagueScreen from '../LeagueScreen';
import { fetchTeamClassification, fetchTeamCalendar, fetchTeamNextMatch } from '../../api/competitions';
import { fetchTeamSummary } from '../../api/team';

jest.mock('../../api/competitions', () => ({
  fetchTeamClassification: jest.fn(),
  fetchTeamCalendar: jest.fn(),
  fetchTeamNextMatch: jest.fn(),
}));

jest.mock('../../api/team', () => ({
  fetchTeamSummary: jest.fn(),
}));

const mockUseRoute = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

const mockFetchTeamClassification = fetchTeamClassification as jest.Mock;
const mockFetchTeamCalendar = fetchTeamCalendar as jest.Mock;
const mockFetchTeamNextMatch = fetchTeamNextMatch as jest.Mock;
const mockFetchTeamSummary = fetchTeamSummary as jest.Mock;

const classificationRow = {
  position: 1,
  teamId: 'team1',
  teamName: 'Equipo A',
  imageUrl: '',
  played: 10,
  won: 8,
  drawn: 1,
  lost: 1,
  goalsFor: 20,
  goalsAgainst: 5,
  points: 25,
};

const playedMatch = {
  date: '2026-01-10T00:00:00',
  time: '10:00',
  localTeamName: 'Equipo A',
  localTeamImageUrl: '',
  localGoals: 3,
  visitorTeamName: 'Equipo B',
  visitorTeamImageUrl: '',
  visitorGoals: 1,
  status: 'Jugado',
};

const nextMatch = {
  date: '2026-02-01T00:00:00',
  time: '11:00',
  localTeamName: 'Equipo A',
  localTeamImageUrl: '',
  localGoals: null,
  visitorTeamName: 'Equipo C',
  visitorTeamImageUrl: '',
  visitorGoals: null,
  status: 'Programado',
};

const teamSummary = {
  name: 'Equipo A',
  shieldUrl: null,
  clubId: null,
  clubName: null,
  clubShieldUrl: null,
};

const mockFullSuccess = () => {
  mockFetchTeamClassification.mockResolvedValue({ teams: [classificationRow] });
  mockFetchTeamCalendar.mockResolvedValue({ matchDays: [{ date: '2026-01-10T00:00:00', matchDayNumber: 1, matches: [playedMatch] }] });
  mockFetchTeamNextMatch.mockResolvedValue({ match: nextMatch });
  mockFetchTeamSummary.mockResolvedValue(teamSummary);
};

describe('LeagueScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { teamId: 'team1' } });
  });

  it('shows a loading indicator before the league data request resolves', async () => {
    let resolveClassification: (value: unknown) => void = () => {};
    mockFetchTeamClassification.mockReturnValue(
      new Promise((resolve) => {
        resolveClassification = resolve;
      }),
    );
    mockFetchTeamCalendar.mockResolvedValue({ matchDays: [] });
    mockFetchTeamNextMatch.mockResolvedValue({ match: null });
    mockFetchTeamSummary.mockResolvedValue(teamSummary);

    const { getByTestId } = await render(<LeagueScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveClassification({ teams: [] });

    await waitFor(() => expect(mockFetchTeamClassification).toHaveBeenCalled());
  });

  it('shows the "Liga" section title', async () => {
    mockFullSuccess();

    const { getByTestId } = await render(<LeagueScreen />);

    expect(getByTestId('screen-header-title').props.children).toBe('Liga');
  });

  it('fetches classification, calendar and next match for the team from route params on mount', async () => {
    mockFullSuccess();

    await render(<LeagueScreen />);

    await waitFor(() => {
      expect(mockFetchTeamClassification).toHaveBeenCalledWith('team1');
      expect(mockFetchTeamCalendar).toHaveBeenCalledWith('team1');
      expect(mockFetchTeamNextMatch).toHaveBeenCalledWith('team1');
    });
  });

  it('shows an error and lets the user retry when loading fails', async () => {
    mockFetchTeamClassification.mockRejectedValueOnce({ response: { data: { detail: 'Error del servidor' } } });
    mockFetchTeamCalendar.mockResolvedValue({ matchDays: [] });
    mockFetchTeamNextMatch.mockResolvedValue({ match: null });
    mockFetchTeamSummary.mockResolvedValue(teamSummary);

    const { findByTestId } = await render(<LeagueScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error del servidor');

    mockFullSuccess();
    await fireEvent.press(await findByTestId('retry-button'));

    await waitFor(() => expect(mockFetchTeamClassification).toHaveBeenCalledTimes(2));
    await findByTestId('classification-table');
  });

  it('falls back to a league-worded error when the server sends no detail', async () => {
    mockFetchTeamClassification.mockRejectedValueOnce({ response: { data: {} } });
    mockFetchTeamCalendar.mockResolvedValue({ matchDays: [] });
    mockFetchTeamNextMatch.mockResolvedValue({ match: null });
    mockFetchTeamSummary.mockResolvedValue(teamSummary);

    const { findByTestId } = await render(<LeagueScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error al cargar la información de la liga');
  });

  it('shows a "sin competición asociada" state when the team has no competition linked', async () => {
    mockFetchTeamClassification.mockResolvedValue({ teams: [] });
    mockFetchTeamCalendar.mockResolvedValue({ matchDays: [] });
    mockFetchTeamNextMatch.mockResolvedValue({ match: null });
    mockFetchTeamSummary.mockResolvedValue(teamSummary);

    const { findByTestId } = await render(<LeagueScreen />);

    const message = await findByTestId('no-competition-message');
    expect(message.props.children).toBe('Este equipo todavía no tiene una competición asociada');
  });

  it('renders the classification table with position, team name and stats', async () => {
    mockFullSuccess();

    const { findByTestId } = await render(<LeagueScreen />);

    await findByTestId('classification-table');
    expect((await findByTestId('classification-position-team1')).props.children).toBe(1);
    expect((await findByTestId('classification-team-team1')).props.children).toBe('Equipo A');
    expect((await findByTestId('classification-played-team1')).props.children).toBe(10);
    expect((await findByTestId('classification-won-team1')).props.children).toBe(8);
    expect((await findByTestId('classification-drawn-team1')).props.children).toBe(1);
    expect((await findByTestId('classification-lost-team1')).props.children).toBe(1);
    expect((await findByTestId('classification-goals-team1')).props.children).toBe('20:5');
    expect((await findByTestId('classification-points-team1')).props.children).toBe(25);
  });

  it('renders the calendar with matchday results for played matches', async () => {
    mockFullSuccess();

    const { findByTestId } = await render(<LeagueScreen />);

    await findByTestId('calendar-matchday-1');
    expect((await findByTestId('calendar-match-1-0-score')).props.children).toBe('3 - 1');
  });

  it('renders the highlighted next match with rival and home indicator', async () => {
    mockFullSuccess();

    const { findByTestId } = await render(<LeagueScreen />);

    const card = await findByTestId('next-match-card');
    expect(card).toBeTruthy();
    expect((await findByTestId('next-match-rival')).props.children).toBe('Equipo C');
    expect((await findByTestId('next-match-venue')).props.children).toBe('Local');
  });

  it('shows no next match highlight when there is none scheduled', async () => {
    mockFetchTeamClassification.mockResolvedValue({ teams: [classificationRow] });
    mockFetchTeamCalendar.mockResolvedValue({ matchDays: [{ date: '2026-01-10T00:00:00', matchDayNumber: 1, matches: [playedMatch] }] });
    mockFetchTeamNextMatch.mockResolvedValue({ match: null });
    mockFetchTeamSummary.mockResolvedValue(teamSummary);

    const { queryByTestId, findByTestId } = await render(<LeagueScreen />);

    await findByTestId('classification-table');
    expect(queryByTestId('next-match-card')).toBeNull();
  });
});
