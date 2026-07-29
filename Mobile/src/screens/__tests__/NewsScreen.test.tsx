import React from 'react';
import { render } from '@testing-library/react-native';
import NewsScreen from '../NewsScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

describe('NewsScreen', () => {
  it('renders the "Noticias" title', async () => {
    const { getByTestId } = await render(<NewsScreen />);

    expect(getByTestId('news-title').props.children).toBe('Noticias');
  });

  it('displays the "Próximamente..." placeholder message', async () => {
    const { getByTestId } = await render(<NewsScreen />);

    expect(getByTestId('news-placeholder').props.children).toBe('Próximamente...');
  });
});
