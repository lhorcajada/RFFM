import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ScreenHeader, { ScreenHeaderAction } from '../ScreenHeader';

const mockNavigation = {
  goBack: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

describe('ScreenHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title prop as text inside testID="screen-header-title"', async () => {
    const { getByTestId } = await render(<ScreenHeader title="Eventos" />);

    expect(getByTestId('screen-header-title').props.children).toBe('Eventos');
  });

  it('always renders testID="screen-header-back-button" even when actions is omitted', async () => {
    const { getByTestId } = await render(<ScreenHeader title="Test" />);

    expect(getByTestId('screen-header-back-button')).toBeTruthy();
  });

  it('pressing the back button with no onBack prop calls navigation.goBack() exactly once', async () => {
    const { getByTestId } = await render(<ScreenHeader title="Test" />);

    fireEvent.press(getByTestId('screen-header-back-button'));

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('pressing the back button when onBack prop is supplied calls onBack and does not call navigation.goBack()', async () => {
    const mockOnBack = jest.fn();

    const { getByTestId } = await render(<ScreenHeader title="Test" onBack={mockOnBack} />);

    fireEvent.press(getByTestId('screen-header-back-button'));

    expect(mockOnBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('renders testID="screen-header-back-button" when showBack is omitted (default true)', async () => {
    const { getByTestId } = await render(<ScreenHeader title="Test" />);

    expect(getByTestId('screen-header-back-button')).toBeTruthy();
  });

  it('does not render testID="screen-header-back-button" when showBack is false', async () => {
    const { queryByTestId } = await render(<ScreenHeader title="Test" showBack={false} />);

    expect(queryByTestId('screen-header-back-button')).toBeNull();
  });

  it('still renders title and actions when showBack is false', async () => {
    const mockOnPress = jest.fn();
    const actions: ScreenHeaderAction[] = [
      {
        key: 'filter',
        icon: 'options-outline',
        label: 'Filtrar',
        onPress: mockOnPress,
      },
    ];

    const { getByTestId, getByText } = await render(
      <ScreenHeader title="Test" actions={actions} showBack={false} />
    );

    expect(getByTestId('screen-header-title').props.children).toBe('Test');
    expect(getByTestId('screen-header-action-filter')).toBeTruthy();
    expect(getByText('Filtrar')).toBeTruthy();
  });

  it('renders zero elements with testID starting screen-header-action- when actions is omitted', async () => {
    const { queryAllByTestId } = await render(<ScreenHeader title="Test" />);

    const actionElements = queryAllByTestId(/^screen-header-action-/);
    expect(actionElements).toHaveLength(0);
  });

  it('renders zero elements with testID starting screen-header-action- when actions is an empty array', async () => {
    const { queryAllByTestId } = await render(<ScreenHeader title="Test" actions={[]} />);

    const actionElements = queryAllByTestId(/^screen-header-action-/);
    expect(actionElements).toHaveLength(0);
  });

  it('renders one action button with derived testID when actions array has one element without testID', async () => {
    const mockOnPress = jest.fn();
    const actions: ScreenHeaderAction[] = [
      {
        key: 'filter',
        icon: 'options-outline',
        label: 'Filtrar',
        onPress: mockOnPress,
      },
    ];

    const { getByTestId, getByText } = await render(<ScreenHeader title="Test" actions={actions} />);

    expect(getByTestId('screen-header-action-filter')).toBeTruthy();
    expect(getByText('Filtrar')).toBeTruthy();
  });

  it('uses explicit testID when provided in action instead of derived testID', async () => {
    const mockOnPress = jest.fn();
    const actions: ScreenHeaderAction[] = [
      {
        key: 'filter',
        icon: 'options-outline',
        label: 'Filtrar',
        onPress: mockOnPress,
        testID: 'open-filters-button',
      },
    ];

    const { getByTestId, queryByTestId } = await render(<ScreenHeader title="Test" actions={actions} />);

    expect(getByTestId('open-filters-button')).toBeTruthy();
    expect(queryByTestId('screen-header-action-filter')).toBeNull();
  });

  it('pressing an action button calls that action\'s onPress', async () => {
    const mockOnPress1 = jest.fn();
    const mockOnPress2 = jest.fn();
    const actions: ScreenHeaderAction[] = [
      {
        key: 'filter',
        icon: 'options-outline',
        label: 'Filtrar',
        onPress: mockOnPress1,
      },
      {
        key: 'sort',
        icon: 'arrow-up-outline',
        label: 'Ordenar',
        onPress: mockOnPress2,
      },
    ];

    const { getByTestId } = await render(<ScreenHeader title="Test" actions={actions} />);

    fireEvent.press(getByTestId('screen-header-action-filter'));

    expect(mockOnPress1).toHaveBeenCalledTimes(1);
    expect(mockOnPress2).not.toHaveBeenCalled();
  });
});
