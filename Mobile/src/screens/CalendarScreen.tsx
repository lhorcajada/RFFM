import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { api } from '../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { fetchSportEventTypeMap, SportEventTypeMap } from '../api/sportEventTypes';
import EventCard, { SportEvent } from './components/EventCard';

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

  useEffect(() => {
    fetchEvents();
  }, [teamId]);

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
          params: { pageNumber: 1, pageSize: 50, descending: false },
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

  if (loading) {
    return (
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Eventos</Text>
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Eventos</Text>
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchEvents}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Eventos</Text>
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay eventos programados</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <Text style={styles.sectionTitle}>Eventos</Text>
      <FlatList
        data={events}
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: coachColors.textPrimary,
    marginBottom: 12,
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
