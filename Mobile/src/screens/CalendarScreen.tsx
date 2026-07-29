import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { api } from '../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { fetchSportEventTypeMap, SportEventTypeMap } from '../api/sportEventTypes';
import EventCard, { SportEvent } from './components/EventCard';
import EventFiltersModal, { EventFiltersValue } from './components/EventFiltersModal';
import { useEventFilters } from './hooks/useEventFilters';
import { useToast } from '../shared/context/ToastContext';

const CalendarScreen = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = route.params as { teamId: string; teamPlayerId?: string } | undefined;
  const teamId = params?.teamId || '';
  const teamPlayerId = params?.teamPlayerId;

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [eventTypeMap, setEventTypeMap] = useState<SportEventTypeMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const { filters, isLoaded, saveFilters, clearFilters } = useEventFilters();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isLoaded) return;
    fetchEvents();
    // filters.eventTypeId is intentionally excluded: it is applied client-side only
    // and must not trigger a re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, isLoaded, filters.startDate, filters.endDate]);

  const fetchEvents = async () => {
    try {
      if (!teamId) {
        setError('Team ID not provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      const [eventsResponse, typeMap] = await Promise.all([
        api.get(`/api/sport-events/${teamId}`, {
          params: {
            pageNumber: 1,
            pageSize: 50,
            descending: false,
            startDate: filters.startDate ?? undefined,
            endDate: filters.endDate ?? undefined,
          },
        }),
        fetchSportEventTypeMap(),
      ]);
      setEvents(eventsResponse.data || []);
      setEventTypeMap(typeMap);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const visibleEvents =
    filters.eventTypeId == null ? events : events.filter((e) => e.eventTypeId === filters.eventTypeId);

  const eventTypeOptions = Object.entries(eventTypeMap).map(([id, name]) => ({ id: Number(id), name }));

  const handleApplyFilters = async (value: EventFiltersValue) => {
    const persisted = await saveFilters(value);
    setFiltersModalVisible(false);
    if (!persisted) {
      showToast('Los filtros se han aplicado, pero no se pudieron guardar para la próxima vez', 'error');
    }
  };

  const handleClearFilters = async () => {
    const persisted = await clearFilters();
    setFiltersModalVisible(false);
    if (!persisted) {
      showToast('Los filtros se han limpiado, pero no se pudo guardar el cambio', 'error');
    }
  };

  const renderFiltersModal = () => (
    <EventFiltersModal
      visible={filtersModalVisible}
      value={filters}
      eventTypeOptions={eventTypeOptions}
      onApply={handleApplyFilters}
      onClear={handleClearFilters}
      onClose={() => setFiltersModalVisible(false)}
    />
  );

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <Text style={styles.sectionTitle}>Eventos</Text>
      <Pressable testID="open-filters-button" style={styles.filterButton} onPress={() => setFiltersModalVisible(true)}>
        <Text style={styles.filterButtonText}>Filtrar</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
        {renderFiltersModal()}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchEvents}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
        {renderFiltersModal()}
      </View>
    );
  }

  if (visibleEvents.length === 0) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay eventos programados</Text>
        </View>
        {renderFiltersModal()}
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {renderHeader()}
      <FlatList
        data={visibleEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            eventTypeName={eventTypeMap[item.eventTypeId ?? -1]}
            onPress={(eventId) => navigation.navigate('EventDetail', { eventId, teamId, teamPlayerId })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      {renderFiltersModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: coachColors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: coachColors.textPrimary,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  filterButtonText: {
    color: coachColors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  errorText: {
    color: coachColors.error,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: coachColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: coachColors.contrastText,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: coachColors.textSecondary,
    textAlign: 'center',
  },
});

export default CalendarScreen;
