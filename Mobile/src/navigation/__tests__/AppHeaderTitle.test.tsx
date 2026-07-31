import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AppHeaderTitle from '../AppHeaderTitle';
import { fetchTeamSummary } from '../../api/team';
import { fetchClubEmblemDataUri } from '../../api/clubEmblem';

jest.mock('../../api/team', () => ({
  fetchTeamSummary: jest.fn(),
}));

jest.mock('../../api/clubEmblem', () => ({
  fetchClubEmblemDataUri: jest.fn(),
}));

const mockFetchTeamSummary = fetchTeamSummary as jest.Mock;
const mockFetchClubEmblemDataUri = fetchClubEmblemDataUri as jest.Mock;

describe('AppHeaderTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the FutbolBase brand text', async () => {
    const { getByText } = await render(<AppHeaderTitle />);

    expect(getByText('FutbolBase')).toBeTruthy();
  });

  it('renders the brand logo image', async () => {
    const { getByTestId } = await render(<AppHeaderTitle />);

    expect(getByTestId('app-header-logo')).toBeTruthy();
  });

  it('does not render a team subtitle when no teamId is provided', async () => {
    const { queryByTestId } = await render(<AppHeaderTitle />);

    expect(queryByTestId('team-shield')).toBeNull();
    expect(mockFetchTeamSummary).not.toHaveBeenCalled();
  });

  it('renders a single row with the club shield and the concatenated club + team name when teamId is provided', async () => {
    mockFetchTeamSummary.mockResolvedValue({
      name: 'Alevin A',
      shieldUrl: 'https://example.com/shield.png',
      clubName: 'FC Example',
      clubShieldUrl: 'https://example.com/club-shield.png',
    });

    const { getByTestId, findByText, queryByTestId } = await render(<AppHeaderTitle teamId="team1" />);

    expect(mockFetchTeamSummary).toHaveBeenCalledWith('team1');
    await findByText('FC Example Alevin A');
    expect(getByTestId('team-shield')).toBeTruthy();
    expect(queryByTestId('club-shield')).toBeNull();
  });

  it('does not render the subtitle when the team request fails', async () => {
    mockFetchTeamSummary.mockResolvedValue(null);

    const { queryByTestId, queryByText } = await render(<AppHeaderTitle teamId="team1" />);

    await waitFor(() => expect(mockFetchTeamSummary).toHaveBeenCalled());
    expect(queryByTestId('team-shield')).toBeNull();
    expect(queryByText('Alevin A')).toBeNull();
  });

  it('does not render the club/team row next to the title when no teamId is provided', async () => {
    const { queryByTestId, queryByText } = await render(<AppHeaderTitle />);

    expect(queryByTestId('team-shield')).toBeNull();
    expect(queryByText('FC Example')).toBeNull();
    expect(queryByText(/FC Example/)).toBeNull();
  });

  it('resolves the emblem via the authenticated download endpoint when the club shield is a relative storage path', async () => {
    mockFetchTeamSummary.mockResolvedValue({
      name: 'Alevin A',
      shieldUrl: 'clubs/club1.png',
      clubId: 'club1',
      clubName: 'FC Example',
      clubShieldUrl: 'clubs/club1.png',
    });
    mockFetchClubEmblemDataUri.mockResolvedValue('data:image/png;base64,AAA=');

    const { getByTestId, findByText } = await render(<AppHeaderTitle teamId="team1" />);

    await findByText('FC Example Alevin A');
    expect(mockFetchClubEmblemDataUri).toHaveBeenCalledWith('club1');
    expect(getByTestId('team-shield').props.source).toEqual({ uri: 'data:image/png;base64,AAA=' });
  });
});
