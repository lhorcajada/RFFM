import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TeamRulesScreen from '../TeamRulesScreen';
import { getTeamRules } from '../../api/teamRules';
import { useAuth } from '../../auth/AuthContext';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: { teamId: 'team1' } })),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

jest.mock('../../api/teamRules');
jest.mock('../../auth/AuthContext');

jest.mock('../../shared/components/ScreenHeader', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return function MockScreenHeader({ title, actions }: any) {
    return React.createElement(
      View,
      { testID: 'screen-header' },
      React.createElement(Text, null, title),
      (actions || []).map((action: any) =>
        React.createElement(
          Pressable,
          { key: action.key, testID: action.testID, onPress: action.onPress },
          React.createElement(Text, null, action.label),
        ),
      ),
    );
  };
});

const mockGetTeamRules = getTeamRules as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const teamRules = {
  teamId: 'team1',
  title: 'NORMAS DE EQUIPO',
  subtitle: 'Compromiso, respeto y equipo',
  introNote: 'Nota inicial: las consecuencias tendrán una finalidad educativa.',
  closingNote: 'Nota sobre aportaciones al fondo del equipo.',
  applicationNote: 'El incumplimiento de estas normas tendrá consecuencias.',
  rules: [
    {
      id: 'rule1',
      order: 1,
      shortTitle: 'Asistencia y preparación',
      highlight: 'Entrenar suma preparación, compromiso y prioridad deportiva.',
      violationSummary: 'No entrenar, entrenar solo un día o faltar parte de la pretemporada.',
      consequenceSummary: 'Podrá afectar a la convocatoria, minutos o prioridad deportiva.',
      longDescription: 'El equipo entrena dos días a la semana.',
      bulletPoints: ['Asistencia semanal: entrenar con regularidad podrá influir en la convocatoria.'],
      consequenceDetail: null,
    },
    {
      id: 'rule2',
      order: 2,
      shortTitle: 'Puntualidad',
      highlight: 'Llegar a tiempo es una muestra de respeto al equipo.',
      violationSummary: 'Llegar tarde sin justificación.',
      consequenceSummary: 'Aportar 1€ al fondo del equipo.',
      longDescription: null,
      bulletPoints: null,
      consequenceDetail: 'Si llega tarde sin justificación, deberá aportar 1€ al fondo del equipo.',
    },
  ],
  updatedAt: '2026-08-05T10:00:00Z',
};

describe('TeamRulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });
  });

  it('renders loading indicator while fetching the rules', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    mockGetTeamRules.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId } = await render(<TeamRulesScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
    resolveRequest(null);
  });

  it('shows "Aún no disponible" when no rules set exists', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('empty-message');
    expect(getByText('Aún no disponible')).toBeTruthy();
  });

  it('shows an error message with a retry button when the fetch fails without backend detail', async () => {
    mockGetTeamRules.mockRejectedValue({ response: undefined });

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('error-message');
    expect(getByText('No se pudieron cargar las normas del equipo')).toBeTruthy();
    expect(await findByTestId('retry-button')).toBeTruthy();
  });

  it('shows the backend-provided error detail when available', async () => {
    mockGetTeamRules.mockRejectedValue({ response: { data: { detail: 'Equipo no encontrado' } } });

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('error-message');
    expect(getByText('Equipo no encontrado')).toBeTruthy();
  });

  it('retries the fetch when the retry button is pressed', async () => {
    mockGetTeamRules.mockRejectedValueOnce({ response: undefined }).mockResolvedValueOnce(null);

    const { findByTestId } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('retry-button'));

    await findByTestId('empty-message');
    expect(mockGetTeamRules).toHaveBeenCalledTimes(2);
  });

  it('renders the intro note and the ordered rule cards with their summaries', async () => {
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('intro-note');
    expect(getByText(teamRules.introNote)).toBeTruthy();

    expect(await findByTestId('rule-card-rule1')).toBeTruthy();
    expect(await findByTestId('rule-card-rule2')).toBeTruthy();
    expect(getByText('Asistencia y preparación')).toBeTruthy();
    expect(getByText('Puntualidad')).toBeTruthy();
  });

  it('renders the closing and application notes when present', async () => {
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('closing-note');
    expect(getByText(teamRules.closingNote)).toBeTruthy();
    expect(await findByTestId('application-note')).toBeTruthy();
    expect(getByText(teamRules.applicationNote)).toBeTruthy();
  });

  it('does not render optional notes when absent', async () => {
    mockGetTeamRules.mockResolvedValue({ ...teamRules, closingNote: null, applicationNote: null });

    const { findByTestId, queryByTestId } = await render(<TeamRulesScreen />);

    await findByTestId('rule-card-rule1');
    expect(queryByTestId('closing-note')).toBeNull();
    expect(queryByTestId('application-note')).toBeNull();
  });

  it('expands a rule card to show its long description and bullet points', async () => {
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId, queryByTestId, getByText } = await render(<TeamRulesScreen />);

    expect(queryByTestId('rule-detail-rule1')).toBeNull();

    fireEvent.press(await findByTestId('rule-card-rule1'));

    await waitFor(() => expect(queryByTestId('rule-detail-rule1')).toBeTruthy());
    expect(getByText('El equipo entrena dos días a la semana.')).toBeTruthy();
    expect(
      getByText('• Asistencia semanal: entrenar con regularidad podrá influir en la convocatoria.'),
    ).toBeTruthy();
  });

  it('expands a rule card that only has a consequence detail (no long description or bullets)', async () => {
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId, queryByTestId, getByText } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('rule-card-rule2'));

    await waitFor(() => expect(queryByTestId('rule-detail-rule2')).toBeTruthy());
    expect(getByText('Si llega tarde sin justificación, deberá aportar 1€ al fondo del equipo.')).toBeTruthy();
  });

  it('collapses an expanded rule card when pressed again', async () => {
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId, queryByTestId } = await render(<TeamRulesScreen />);

    const card = await findByTestId('rule-card-rule1');
    fireEvent.press(card);
    await waitFor(() => expect(queryByTestId('rule-detail-rule1')).toBeTruthy());

    fireEvent.press(card);
    await waitFor(() => expect(queryByTestId('rule-detail-rule1')).toBeNull());
  });

  it('does not show the edit control for Player/FamilyMember roles', async () => {
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId, queryByTestId } = await render(<TeamRulesScreen />);

    await findByTestId('rule-card-rule1');
    expect(queryByTestId('edit-button')).toBeNull();
  });

  it('shows the edit control for Coach role and navigates to the edit screen', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });
    mockGetTeamRules.mockResolvedValue(teamRules);

    const { findByTestId } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('edit-button'));

    expect(mockNavigate).toHaveBeenCalledWith('TeamRulesEdit', { teamId: 'team1' });
  });

  it('shows the edit control for Administrator role in the empty state, to create the rules set', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Administrator'] });
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId } = await render(<TeamRulesScreen />);

    await findByTestId('empty-message');
    expect(await findByTestId('edit-button')).toBeTruthy();
  });

  it('does not import WebView or DocumentPicker (structured rules replace the PDF viewer)', () => {
    const screenSource = require('fs').readFileSync(
      require('path').join(__dirname, '../TeamRulesScreen.tsx'),
      'utf-8',
    );

    expect(screenSource).not.toContain('react-native-webview');
    expect(screenSource).not.toContain('expo-document-picker');
    expect(screenSource).not.toContain('WebView');
    expect(screenSource).not.toContain('DocumentPicker');
  });
});
