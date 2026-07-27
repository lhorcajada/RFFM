import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { api } from '../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';

interface ConvocationResponse {
  convocationId: string;
  teamPlayerId: string;
  alias: string;
  status: string;
}

const EventDetailScreen = () => {
  const route = useRoute();
  const params = route.params as {
    eventId: string;
    teamId: string;
    teamPlayerId?: string;
  } | undefined;
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();

  const [convocation, setConvocation] = useState<ConvocationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingAttendance, setConfirmingAttendance] = useState(false);

  const eventId = params?.eventId || '';
  const teamId = params?.teamId || '';
  const teamPlayerId = params?.teamPlayerId || '';

  useEffect(() => {
    if (eventId) {
      fetchConvocation();
    }
  }, [eventId]);

  const fetchConvocation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/events/${eventId}/convocations`);
      const all = (response.data || []) as ConvocationResponse[];
      const mine = all.find((c) => c.teamPlayerId === teamPlayerId) || null;
      setConvocation(mine);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar convocatoria');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAttendance = async (status: string) => {
    try {
      setConfirmingAttendance(true);
      await api.post(`/api/mobile/events/${eventId}/attendance`, {
        teamId,
        teamPlayerId,
        status,
      });
      // Update convocation state to reflect new status
      if (convocation) {
        setConvocation({ ...convocation, status });
      }
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al confirmar asistencia');
    } finally {
      setConfirmingAttendance(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text testID="error-message" style={styles.errorText}>{error}</Text>
        <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchConvocation}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!convocation) {
    return (
      <View style={styles.container}>
        <Text testID="empty-message" style={styles.emptyText}>No hay información disponible</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.playerName}>{convocation.alias}</Text>
        <Text testID="status-text" style={styles.status}>Estado: {convocation.status}</Text>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable
          testID="going-button"
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => handleConfirmAttendance('Going')}
          disabled={confirmingAttendance}
        >
          <Text style={styles.buttonText}>Voy</Text>
        </Pressable>

        <Pressable
          testID="not-going-button"
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => handleConfirmAttendance('NotGoing')}
          disabled={confirmingAttendance}
        >
          <Text style={styles.buttonTextSecondary}>No voy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coachColors.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 30,
  },
  playerName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: coachColors.textPrimary,
  },
  status: {
    fontSize: 14,
    color: coachColors.textSecondary,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: coachColors.secondary,
  },
  buttonSecondary: {
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  buttonText: {
    color: coachColors.contrastText,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: coachColors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
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

export default EventDetailScreen;
