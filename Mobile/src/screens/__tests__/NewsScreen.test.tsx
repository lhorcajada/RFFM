import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import NewsScreen from '../NewsScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

describe('NewsScreen', () => {
  it('renders the "Noticias" title', async () => {
    const { getByTestId } = await render(<NewsScreen />);

    expect(getByTestId('screen-header-title').props.children).toBe('Noticias');
  });

  it('displays the "Próximamente..." placeholder message', async () => {
    const { getByTestId } = await render(<NewsScreen />);

    expect(getByTestId('news-placeholder').props.children).toBe('Próximamente...');
  });

  it('does not render a back button, since Noticias is a tab root screen', async () => {
    const { queryByTestId } = await render(<NewsScreen />);

    expect(queryByTestId('screen-header-back-button')).toBeNull();
  });

  it('does not center the root container, so the header renders at the top like other screens', async () => {
    const { getByTestId } = await render(<NewsScreen />);

    const flatStyle = StyleSheet.flatten(getByTestId('news-screen-container').props.style);
    expect(flatStyle.justifyContent).not.toBe('center');
    expect(flatStyle.alignItems).not.toBe('center');
  });
});
