import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TeamRulesEditScreen from '../TeamRulesEditScreen';
import { getTeamRules, saveTeamRules, deleteTeamRules } from '../../api/teamRules';

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: { teamId: 'team1' } })),
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
}));

jest.mock('../../api/teamRules');

jest.mock('../../shared/components/ScreenHeader', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockScreenHeader({ title }: any) {
    return React.createElement(View, { testID: 'screen-header' }, React.createElement(Text, null, title));
  };
});

const mockGetTeamRules = getTeamRules as jest.Mock;
const mockSaveTeamRules = saveTeamRules as jest.Mock;
const mockDeleteTeamRules = deleteTeamRules as jest.Mock;

const existingRules = {
  teamId: 'team1',
  title: 'NORMAS DE EQUIPO',
  subtitle: 'Compromiso, respeto y equipo',
  introNote: 'Nota inicial.',
  closingNote: 'Nota de cierre.',
  applicationNote: 'Nota de aplicación.',
  rules: [
    {
      id: 'rule1',
      order: 1,
      shortTitle: 'Puntualidad',
      highlight: 'Llegar a tiempo.',
      violationSummary: 'Llegar tarde.',
      consequenceSummary: 'Aportar 1€.',
      longDescription: null,
      bulletPoints: null,
      consequenceDetail: null,
    },
  ],
  updatedAt: '2026-08-05T10:00:00Z',
};

describe('TeamRulesEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading indicator while fetching existing rules', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    mockGetTeamRules.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId } = await render(<TeamRulesEditScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
    resolveRequest(null);
  });

  it('pre-fills metadata and rule fields when rules already exist', async () => {
    mockGetTeamRules.mockResolvedValue(existingRules);

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    expect((await findByTestId('title-input')).props.value).toBe('NORMAS DE EQUIPO');
    expect((await findByTestId('subtitle-input')).props.value).toBe('Compromiso, respeto y equipo');
    expect((await findByTestId('intro-note-input')).props.value).toBe('Nota inicial.');
    expect((await findByTestId('rule-shortTitle-0')).props.value).toBe('Puntualidad');
    expect((await findByTestId('rule-violation-0')).props.value).toBe('Llegar tarde.');
    expect((await findByTestId('rule-consequence-0')).props.value).toBe('Aportar 1€.');
  });

  it('starts with empty metadata fields and no rule rows when creating for the first time', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId, queryByTestId } = await render(<TeamRulesEditScreen />);

    expect((await findByTestId('title-input')).props.value).toBe('');
    expect(queryByTestId('rule-shortTitle-0')).toBeNull();
  });

  it('does not show the delete-rules control when creating for the first time', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId, queryByTestId } = await render(<TeamRulesEditScreen />);

    await findByTestId('title-input');
    expect(queryByTestId('delete-rules-button')).toBeNull();
  });

  it('shows the delete-rules control when editing an existing rules set', async () => {
    mockGetTeamRules.mockResolvedValue(existingRules);

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    expect(await findByTestId('delete-rules-button')).toBeTruthy();
  });

  it('adds a new blank rule row when the add-rule control is pressed', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    fireEvent.press(await findByTestId('add-rule-button'));

    expect(await findByTestId('rule-shortTitle-0')).toBeTruthy();
  });

  it('removes a rule row when its remove control is pressed', async () => {
    mockGetTeamRules.mockResolvedValue(existingRules);

    const { findByTestId, queryByTestId } = await render(<TeamRulesEditScreen />);

    fireEvent.press(await findByTestId('remove-rule-0'));

    await waitFor(() => expect(queryByTestId('rule-shortTitle-0')).toBeNull());
  });

  it('reorders rule rows when move-down is pressed', async () => {
    const twoRules = {
      ...existingRules,
      rules: [
        existingRules.rules[0],
        {
          id: 'rule2',
          order: 2,
          shortTitle: 'Segunda norma',
          highlight: null,
          violationSummary: 'Incumplimiento 2',
          consequenceSummary: 'Consecuencia 2',
          longDescription: null,
          bulletPoints: null,
          consequenceDetail: null,
        },
      ],
    };
    mockGetTeamRules.mockResolvedValue(twoRules);

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    expect((await findByTestId('rule-shortTitle-0')).props.value).toBe('Puntualidad');

    fireEvent.press(await findByTestId('move-down-0'));

    await waitFor(async () => {
      expect((await findByTestId('rule-shortTitle-0')).props.value).toBe('Segunda norma');
    });
  });

  it('blocks submit and shows an error when required metadata fields are empty', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId, getByText } = await render(<TeamRulesEditScreen />);

    fireEvent.press(await findByTestId('save-button'));

    await waitFor(() => expect(getByText('Completa el título, el subtítulo y la nota inicial')).toBeTruthy());
    expect(mockSaveTeamRules).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an error when there are no rules', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId, getByText } = await render(<TeamRulesEditScreen />);

    fireEvent.changeText(await findByTestId('title-input'), 'NORMAS');
    fireEvent.changeText(await findByTestId('subtitle-input'), 'Subtítulo');
    fireEvent.changeText(await findByTestId('intro-note-input'), 'Nota inicial');

    fireEvent.press(await findByTestId('save-button'));

    await waitFor(() => expect(getByText('Añade al menos una norma')).toBeTruthy());
    expect(mockSaveTeamRules).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an error when a rule is missing required fields', async () => {
    mockGetTeamRules.mockResolvedValue(null);

    const { findByTestId, getByText } = await render(<TeamRulesEditScreen />);

    fireEvent.changeText(await findByTestId('title-input'), 'NORMAS');
    fireEvent.changeText(await findByTestId('subtitle-input'), 'Subtítulo');
    fireEvent.changeText(await findByTestId('intro-note-input'), 'Nota inicial');
    fireEvent.press(await findByTestId('add-rule-button'));

    fireEvent.press(await findByTestId('save-button'));

    await waitFor(() =>
      expect(
        getByText('Completa el título, el incumplimiento y la consecuencia de cada norma'),
      ).toBeTruthy(),
    );
    expect(mockSaveTeamRules).not.toHaveBeenCalled();
  });

  it('saves the full rules payload and navigates back to the read screen on success', async () => {
    mockGetTeamRules.mockResolvedValue(null);
    mockSaveTeamRules.mockResolvedValue(existingRules);

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    fireEvent.changeText(await findByTestId('title-input'), 'NORMAS DE EQUIPO');
    fireEvent.changeText(await findByTestId('subtitle-input'), 'Compromiso, respeto y equipo');
    fireEvent.changeText(await findByTestId('intro-note-input'), 'Nota inicial.');
    fireEvent.press(await findByTestId('add-rule-button'));
    fireEvent.changeText(await findByTestId('rule-shortTitle-0'), 'Puntualidad');
    fireEvent.changeText(await findByTestId('rule-violation-0'), 'Llegar tarde.');
    fireEvent.changeText(await findByTestId('rule-consequence-0'), 'Aportar 1€.');

    fireEvent.press(await findByTestId('save-button'));

    await waitFor(() =>
      expect(mockSaveTeamRules).toHaveBeenCalledWith('team1', {
        title: 'NORMAS DE EQUIPO',
        subtitle: 'Compromiso, respeto y equipo',
        introNote: 'Nota inicial.',
        closingNote: null,
        applicationNote: null,
        rules: [
          {
            id: undefined,
            shortTitle: 'Puntualidad',
            highlight: null,
            violationSummary: 'Llegar tarde.',
            consequenceSummary: 'Aportar 1€.',
            longDescription: null,
            bulletPoints: null,
            consequenceDetail: null,
          },
        ],
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('RulesTab', { teamId: 'team1' });
  });

  it('shows an error message when saving fails', async () => {
    mockGetTeamRules.mockResolvedValue(existingRules);
    mockSaveTeamRules.mockRejectedValue({ response: { data: { detail: 'No autorizado' } } });

    const { findByTestId, getByText } = await render(<TeamRulesEditScreen />);

    fireEvent.press(await findByTestId('save-button'));

    await waitFor(() => expect(getByText('No autorizado')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('deletes the rules set after confirmation and navigates back to the read screen', async () => {
    mockGetTeamRules.mockResolvedValue(existingRules);
    mockDeleteTeamRules.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirmButton = buttons?.find((b) => b.style === 'destructive');
      confirmButton?.onPress?.();
    });

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    fireEvent.press(await findByTestId('delete-rules-button'));

    await waitFor(() => expect(mockDeleteTeamRules).toHaveBeenCalledWith('team1'));
    expect(mockReplace).toHaveBeenCalledWith('RulesTab', { teamId: 'team1' });
  });

  it('does not delete when the confirmation dialog is dismissed', async () => {
    mockGetTeamRules.mockResolvedValue(existingRules);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByTestId } = await render(<TeamRulesEditScreen />);

    fireEvent.press(await findByTestId('delete-rules-button'));

    expect(mockDeleteTeamRules).not.toHaveBeenCalled();
  });
});
