import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TabMenuCard from '../TabMenuCard';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, testID }: any) => {
      return ReactActual.createElement(Text, { testID }, name);
    },
  };
});

describe('TabMenuCard', () => {
  it('renders the label text', async () => {
    const { getByTestId } = await render(
      <TabMenuCard
        label="Plantilla"
        icon="shirt-outline"
        onPress={() => {}}
        testID="menu-card-1"
      />,
    );

    expect(getByTestId('menu-card-1-label')).toBeTruthy();
    expect(getByTestId('menu-card-1-label').props.children).toBe('Plantilla');
  });

  it('renders the leading icon with the given name', async () => {
    const { getByTestId } = await render(
      <TabMenuCard
        label="Plantilla"
        icon="shirt-outline"
        onPress={() => {}}
        testID="menu-card-1"
      />,
    );

    expect(getByTestId('menu-card-1-leading-icon')).toBeTruthy();
    expect(getByTestId('menu-card-1-leading-icon').props.children).toBe('shirt-outline');
  });

  it('renders the trailing chevron-forward-outline icon', async () => {
    const { getByTestId } = await render(
      <TabMenuCard
        label="Plantilla"
        icon="shirt-outline"
        onPress={() => {}}
        testID="menu-card-1"
      />,
    );

    expect(getByTestId('menu-card-1-trailing-icon')).toBeTruthy();
    expect(getByTestId('menu-card-1-trailing-icon').props.children).toBe('chevron-forward-outline');
  });

  it('calls onPress when pressed', async () => {
    const onPressMock = jest.fn();
    const { getByTestId } = await render(
      <TabMenuCard
        label="Plantilla"
        icon="shirt-outline"
        onPress={onPressMock}
        testID="menu-card-1"
      />,
    );

    fireEvent.press(getByTestId('menu-card-1'));

    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
});
