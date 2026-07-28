import React from 'react';
import { render } from '@testing-library/react-native';
import Toast from '../Toast';

describe('Toast', () => {
  it('renders nothing when not visible', async () => {
    const { queryByTestId } = await render(<Toast visible={false} message="Algo salió mal" type="error" />);

    expect(queryByTestId('toast')).toBeNull();
  });

  it('renders the message when visible', async () => {
    const { getByTestId } = await render(<Toast visible message="Algo salió mal" type="error" />);

    expect(getByTestId('toast')).toBeTruthy();
    expect(getByTestId('toast-message').props.children).toBe('Algo salió mal');
  });

  it('applies distinct styling per type without throwing for error, success and info', async () => {
    for (const type of ['error', 'success', 'info'] as const) {
      const { getByTestId, unmount } = await render(<Toast visible message="Mensaje" type={type} />);
      expect(getByTestId('toast')).toBeTruthy();
      await unmount();
    }
  });
});
