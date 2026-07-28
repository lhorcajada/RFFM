import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EventCard, { SportEvent } from '../EventCard';

const baseEvent: SportEvent = {
  id: '1',
  name: 'Entrenamiento semanal',
  eveDateTime: '2026-07-27T18:00:00',
};

describe('EventCard', () => {
  it('renders title, date and location for a generic event', async () => {
    const event: SportEvent = {
      ...baseEvent,
      location: 'Campo Municipal',
    };

    const { getByText } = await render(
      <EventCard event={event} eventTypeName="Entrenamiento" onPress={jest.fn()} />,
    );

    expect(getByText('Entrenamiento semanal')).toBeTruthy();
    expect(getByText('Campo Municipal', { exact: false })).toBeTruthy();
  });

  it('renders the event time next to the date for a generic event', async () => {
    const { getByText } = await render(
      <EventCard event={baseEvent} eventTypeName="Entrenamiento" onPress={jest.fn()} />,
    );

    expect(getByText('18:00', { exact: false })).toBeTruthy();
  });

  it('converts a UTC event time to the device local time instead of showing the raw UTC hour', async () => {
    const event: SportEvent = { ...baseEvent, eveDateTime: '2026-07-27T18:00:00Z' };
    const expectedLocalTime = new Date('2026-07-27T18:00:00Z').toTimeString().slice(0, 5);

    const { getByText } = await render(
      <EventCard event={event} eventTypeName="Entrenamiento" onPress={jest.fn()} />,
    );

    expect(getByText(expectedLocalTime, { exact: false })).toBeTruthy();
  });

  it('does not render a time when the event has no time component', async () => {
    const event: SportEvent = { ...baseEvent, eveDateTime: '2026-07-27' };

    const { queryByText } = await render(
      <EventCard event={event} eventTypeName="Entrenamiento" onPress={jest.fn()} />,
    );

    expect(queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it('renders rival name for a generic event when present', async () => {
    const event: SportEvent = { ...baseEvent, rivalName: 'Barcelona' };

    const { getByText } = await render(
      <EventCard event={event} eventTypeName="Entrenamiento" onPress={jest.fn()} />,
    );

    expect(getByText('Barcelona', { exact: false })).toBeTruthy();
  });

  it('renders team names and home/away badge for a match event without a score', async () => {
    const event: SportEvent = {
      ...baseEvent,
      name: 'Jornada 3',
      teamName: 'Mi Equipo',
      rivalName: 'Real Madrid',
      isHomeMatch: true,
    };

    const { getByText } = await render(
      <EventCard event={event} eventTypeName="Partido" onPress={jest.fn()} />,
    );

    expect(getByText('Mi Equipo')).toBeTruthy();
    expect(getByText('Real Madrid')).toBeTruthy();
    expect(getByText('vs')).toBeTruthy();
    expect(getByText(/Local/i)).toBeTruthy();
    expect(getByText('18:00', { exact: false })).toBeTruthy();
  });

  it('renders the score and a "Victoria" badge when the user team wins as home', async () => {
    const event: SportEvent = {
      ...baseEvent,
      name: 'Jornada 3',
      teamName: 'Mi Equipo',
      rivalName: 'Real Madrid',
      isHomeMatch: true,
      localGoals: '3',
      visitorGoals: '1',
    };

    const { getByText } = await render(
      <EventCard event={event} eventTypeName="Partido" onPress={jest.fn()} />,
    );

    expect(getByText('3 - 1')).toBeTruthy();
    expect(getByText('Victoria')).toBeTruthy();
  });

  it('renders a "Derrota" badge when the user team loses as away', async () => {
    const event: SportEvent = {
      ...baseEvent,
      name: 'Jornada 3',
      teamName: 'Mi Equipo',
      rivalName: 'Real Madrid',
      isHomeMatch: false,
      localGoals: '2',
      visitorGoals: '0',
    };

    const { getByText } = await render(
      <EventCard event={event} eventTypeName="Partido" onPress={jest.fn()} />,
    );

    expect(getByText('Derrota')).toBeTruthy();
  });

  it('does not render a result badge when goals are absent', async () => {
    const event: SportEvent = {
      ...baseEvent,
      teamName: 'Mi Equipo',
      rivalName: 'Real Madrid',
      isHomeMatch: true,
    };

    const { queryByText } = await render(
      <EventCard event={event} eventTypeName="Partido" onPress={jest.fn()} />,
    );

    expect(queryByText('Victoria')).toBeNull();
    expect(queryByText('Empate')).toBeNull();
    expect(queryByText('Derrota')).toBeNull();
  });

  it('calls onPress with the event id when tapped', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <EventCard event={baseEvent} eventTypeName="Entrenamiento" onPress={onPress} />,
    );

    fireEvent.press(getByTestId(`event-item-${baseEvent.id}`));

    expect(onPress).toHaveBeenCalledWith(baseEvent.id);
  });
});
