import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EventFiltersModal, { EventFiltersValue } from '../EventFiltersModal';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => ReactActual.createElement(View, { testID: 'mock-date-time-picker', ...props }),
  };
});

const eventTypeOptions = [
  { id: 1, name: 'Entrenamiento' },
  { id: 2, name: 'Partido' },
];

const defaultValue: EventFiltersValue = { eventTypeId: null, startDate: null, endDate: null };

const noop = () => {};

describe('EventFiltersModal', () => {
  it('is not in the tree when not visible', async () => {
    const { queryByTestId } = await render(
      <EventFiltersModal
        visible={false}
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={noop}
        onClear={noop}
        onClose={noop}
      />,
    );

    expect(queryByTestId('event-filters-modal')).toBeNull();
  });

  it('renders the "all" chip plus one chip per event type option when visible', async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventFiltersModal
        visible
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={noop}
        onClear={noop}
        onClose={noop}
      />,
    );

    expect(queryByTestId('event-filters-modal')).toBeTruthy();
    expect(getByTestId('filter-type-option-all')).toBeTruthy();
    expect(getByTestId('filter-type-option-1')).toBeTruthy();
    expect(getByTestId('filter-type-option-2')).toBeTruthy();
  });

  it('calls onApply with the selected draft type when Apply is pressed', async () => {
    const onApply = jest.fn();
    const { getByTestId } = await render(
      <EventFiltersModal
        visible
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={noop}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByTestId('filter-type-option-2'));
    await fireEvent.press(getByTestId('apply-filters-button'));

    expect(onApply).toHaveBeenCalledWith({ eventTypeId: 2, startDate: null, endDate: null });
  });

  it('does not call onApply when only selecting a type option (draft only)', async () => {
    const onApply = jest.fn();
    const { getByTestId } = await render(
      <EventFiltersModal
        visible
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={noop}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByTestId('filter-type-option-1'));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('calls onClear and not onApply when Clear is pressed', async () => {
    const onApply = jest.fn();
    const onClear = jest.fn();
    const { getByTestId } = await render(
      <EventFiltersModal
        visible
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={onClear}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByTestId('clear-filters-button'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('calls onClose and not onApply when the backdrop is pressed', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <EventFiltersModal
        visible
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={noop}
        onClose={onClose}
      />,
    );

    await fireEvent.press(getByTestId('filter-type-option-2'));
    await fireEvent.press(getByTestId('event-filters-modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('opens pre-populated with the current applied value as the draft', async () => {
    const onApply = jest.fn();
    const { getByTestId } = await render(
      <EventFiltersModal
        visible
        value={{ eventTypeId: 2, startDate: '2026-08-01T00:00:00.000Z', endDate: null }}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={noop}
        onClose={noop}
      />,
    );

    await fireEvent.press(getByTestId('apply-filters-button'));

    expect(onApply).toHaveBeenCalledWith({
      eventTypeId: 2,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: null,
    });
  });

  it('shows a validation error and does not call onApply when end date is before start date', async () => {
    const onApply = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EventFiltersModal
        visible
        value={{
          eventTypeId: null,
          startDate: '2026-08-15T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
        }}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={noop}
        onClose={noop}
      />,
    );

    expect(queryByTestId('date-range-error')).toBeTruthy();

    await fireEvent.press(getByTestId('apply-filters-button'));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('does not show a validation error when the end date is on or after the start date', async () => {
    const { queryByTestId } = await render(
      <EventFiltersModal
        visible
        value={{
          eventTypeId: null,
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-15T00:00:00.000Z',
        }}
        eventTypeOptions={eventTypeOptions}
        onApply={noop}
        onClear={noop}
        onClose={noop}
      />,
    );

    expect(queryByTestId('date-range-error')).toBeNull();
  });

  it('updates the validation error as the draft dates change via the pickers', async () => {
    const onApply = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EventFiltersModal
        visible
        value={defaultValue}
        eventTypeOptions={eventTypeOptions}
        onApply={onApply}
        onClear={noop}
        onClose={noop}
      />,
    );

    expect(queryByTestId('date-range-error')).toBeNull();

    await fireEvent.press(getByTestId('filter-start-date-input'));
    await fireEvent(getByTestId('mock-date-time-picker'), 'change', {}, new Date('2026-08-15T00:00:00.000Z'));

    await fireEvent.press(getByTestId('filter-end-date-input'));
    await fireEvent(getByTestId('mock-date-time-picker'), 'change', {}, new Date('2026-08-01T00:00:00.000Z'));

    expect(queryByTestId('date-range-error')).toBeTruthy();
    await fireEvent.press(getByTestId('apply-filters-button'));
    expect(onApply).not.toHaveBeenCalled();
  });
});
