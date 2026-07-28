import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ToastProvider, useToast } from '../ToastContext';

const TriggerButton = ({ message, type }: { message: string; type?: 'error' | 'success' | 'info' }) => {
  const { showToast } = useToast();
  return (
    <Pressable testID="trigger" onPress={() => showToast(message, type)}>
      <Text>trigger</Text>
    </Pressable>
  );
};

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows no toast by default', async () => {
    const { queryByTestId } = await render(
      <ToastProvider>
        <TriggerButton message="Hola" />
      </ToastProvider>,
    );

    expect(queryByTestId('toast')).toBeNull();
  });

  it('shows the toast with the given message when showToast is called', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ToastProvider>
        <TriggerButton message="Error de red" type="error" />
      </ToastProvider>,
    );

    await fireEvent.press(getByTestId('trigger'));

    await waitFor(() => expect(queryByTestId('toast')).toBeTruthy());
    expect(getByTestId('toast-message').props.children).toBe('Error de red');
  });

  it('auto-hides the toast after a few seconds', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ToastProvider>
        <TriggerButton message="Se guardó correctamente" type="success" />
      </ToastProvider>,
    );

    await fireEvent.press(getByTestId('trigger'));
    await waitFor(() => expect(queryByTestId('toast')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    await waitFor(() => expect(queryByTestId('toast')).toBeNull());
  });

  it('throws a clear error when useToast is used outside a ToastProvider', async () => {
    const BrokenConsumer = () => {
      useToast();
      return null;
    };

    const originalError = console.error;
    console.error = jest.fn();
    await expect(render(<BrokenConsumer />)).rejects.toThrow('useToast must be used within a ToastProvider');
    console.error = originalError;
  });
});
