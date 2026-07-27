import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { api } from '../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';

interface SportEvent {
  id: string;
  name: string;
  eveDateTime: string;
  rivalName?: string;
}

const CalendarScreen = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = route.params as { teamId: string; teamPlayerId?: string } | undefined;
  const teamId = params?.teamId || '';
  const teamPlayerId = params?.teamPlayerId;

  const [events, setEvents] = useState<SportEvent[]>([]);
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
      const response = await api.get(`/api/sport-events/${teamId}`, {
        params: { pageNumber: 1, pageSize: 50, descending: false },
      });
      setEvents(response.data || []);
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
      <View style={styles.container}>
        <ActivityIndicator testID="loading-indicator" size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text testID="error-message" style={styles.errorText}>{error}</Text>
        <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchEvents}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.container}>
        <Text testID="empty-message" style={styles.emptyText}>No hay eventos programados</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            testID={`event-item-${item.id}`}
            style={styles.eventCard}
            onPress={() =>
              navigation.navigate('EventDetail', { eventId: item.id, teamId, teamPlayerId })
            }
          >
            <Text style={styles.eventTitle}>{item.name}</Text>
            <Text style={styles.eventDate}>{item.eveDateTime}</Text>
            {item.rivalName && <Text style={styles.eventOpponent}>vs {item.rivalName}</Text>}
          </Pressable>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  eventCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  eventOpponent: {
    fontSize: 14,
    color: '#007AFF',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default CalendarScreen;
