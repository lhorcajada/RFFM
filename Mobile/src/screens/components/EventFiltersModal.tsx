import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { coachColors } from '../../theme/colors';

export interface EventFiltersValue {
  eventTypeId: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface EventTypeOption {
  id: number;
  name: string;
}

interface Props {
  visible: boolean;
  value: EventFiltersValue;
  eventTypeOptions: EventTypeOption[];
  onApply: (value: EventFiltersValue) => void;
  onClear: () => void;
  onClose: () => void;
}

function formatDraftDate(iso: string | null): string {
  if (!iso) return 'Seleccionar fecha';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Seleccionar fecha';
  return date.toLocaleDateString('es-ES', { dateStyle: 'medium' });
}

const DATE_RANGE_ERROR_MESSAGE = 'La fecha fin no puede ser anterior a la fecha de inicio';

function getDateRangeError(draft: EventFiltersValue): string | null {
  if (!draft.startDate || !draft.endDate) return null;
  const start = new Date(draft.startDate);
  const end = new Date(draft.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return end < start ? DATE_RANGE_ERROR_MESSAGE : null;
}

const EventFiltersModal = ({ visible, value, eventTypeOptions, onApply, onClear, onClose }: Props) => {
  const [draft, setDraft] = useState<EventFiltersValue>(value);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dateRangeError = getDateRangeError(draft);

  const handleApply = () => {
    if (dateRangeError) return;
    onApply(draft);
  };

  const handleStartChange = (_event: unknown, date?: Date) => {
    setShowStartPicker(false);
    if (date) {
      setDraft((prev) => ({ ...prev, startDate: date.toISOString() }));
    }
  };

  const handleEndChange = (_event: unknown, date?: Date) => {
    setShowEndPicker(false);
    if (date) {
      setDraft((prev) => ({ ...prev, endDate: date.toISOString() }));
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable testID="event-filters-modal-backdrop" style={styles.backdrop} onPress={onClose}>
        <View testID="event-filters-modal" style={styles.content} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Filtrar eventos</Text>

          <Text style={styles.sectionLabel}>Tipo de evento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable
              testID="filter-type-option-all"
              style={[styles.chip, draft.eventTypeId == null && styles.chipSelected]}
              onPress={() => setDraft((prev) => ({ ...prev, eventTypeId: null }))}
            >
              <Text style={[styles.chipText, draft.eventTypeId == null && styles.chipTextSelected]}>Todos</Text>
            </Pressable>
            {eventTypeOptions.map((option) => (
              <Pressable
                key={option.id}
                testID={`filter-type-option-${option.id}`}
                style={[styles.chip, draft.eventTypeId === option.id && styles.chipSelected]}
                onPress={() => setDraft((prev) => ({ ...prev, eventTypeId: option.id }))}
              >
                <Text style={[styles.chipText, draft.eventTypeId === option.id && styles.chipTextSelected]}>
                  {option.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Rango de fechas</Text>
          <View style={styles.dateRow}>
            <Pressable
              testID="filter-start-date-input"
              style={styles.dateInput}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={styles.dateInputText}>{formatDraftDate(draft.startDate)}</Text>
            </Pressable>
            <Pressable testID="filter-end-date-input" style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateInputText}>{formatDraftDate(draft.endDate)}</Text>
            </Pressable>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={draft.startDate ? new Date(draft.startDate) : new Date()}
              mode="date"
              onChange={handleStartChange}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={draft.endDate ? new Date(draft.endDate) : new Date()}
              mode="date"
              onChange={handleEndChange}
            />
          )}

          {dateRangeError && (
            <Text testID="date-range-error" style={styles.errorText}>
              {dateRangeError}
            </Text>
          )}

          <View style={styles.actionsRow}>
            <Pressable testID="clear-filters-button" style={styles.clearButton} onPress={onClear}>
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </Pressable>
            <Pressable
              testID="apply-filters-button"
              style={[styles.applyButton, !!dateRangeError && styles.applyButtonDisabled]}
              onPress={handleApply}
              disabled={!!dateRangeError}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: coachColors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: coachColors.border,
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: coachColors.textPrimary,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: coachColors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  chipSelected: {
    backgroundColor: coachColors.primary,
    borderColor: coachColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: coachColors.textPrimary,
  },
  chipTextSelected: {
    color: coachColors.contrastText,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  dateInputText: {
    fontSize: 14,
    color: coachColors.textPrimary,
  },
  errorText: {
    color: coachColors.error,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  clearButtonText: {
    color: coachColors.textPrimary,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: coachColors.primary,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: coachColors.contrastText,
    fontWeight: '700',
  },
});

export default EventFiltersModal;
