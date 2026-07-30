import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import ScreenSectionHeader from '../ScreenSectionHeader';

describe('ScreenSectionHeader', () => {
  it('renders the given title', async () => {
    const { getByText } = await render(<ScreenSectionHeader title="Eventos" />);

    expect(getByText('Eventos')).toBeTruthy();
  });

  it('renders optional trailing content next to the title', async () => {
    const { getByTestId } = await render(
      <ScreenSectionHeader title="Eventos">
        <Text testID="extra-action">Filtrar</Text>
      </ScreenSectionHeader>,
    );

    expect(getByTestId('extra-action')).toBeTruthy();
  });

  it('exposes the title with a stable testID for cross-screen assertions', async () => {
    const { getByTestId } = await render(<ScreenSectionHeader title="Lesiones" />);

    expect(getByTestId('screen-section-title').props.children).toBe('Lesiones');
  });
});
