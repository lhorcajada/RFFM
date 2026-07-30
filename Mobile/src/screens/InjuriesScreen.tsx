import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { api, API_BASE_URL } from '../api/client';
import { getTeamPlayerInjuries, type InjuryRecord } from '../api/injuries';
import { coachColors } from '../theme/colors';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenSectionHeader from '../shared/components/ScreenSectionHeader';

interface Demarcation {
  id: number;
  name: string;
  code: string;
}

interface PlayerRosterItem {
  teamPlayerId: string;
  alias: string | null;
  urlPhoto: string | null;
  activeDemarcation: Demarcation | null;
}

interface InjuryWithPlayer {
  player: PlayerRosterItem;
  injury: InjuryRecord;
}

const InjuriesScreen = () => {
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';

  const [injuryRecords, setInjuryRecords] = useState<InjuryWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      fetchInjuries();
    }
  }, [teamId]);

  const fetchInjuries = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch roster
      const rosterResponse = await api.get(`/api/mobile/teams/${teamId}/season-player-cards`);
      const roster: PlayerRosterItem[] = rosterResponse.data || [];

      // Fetch injuries for each player
      const injuriesPromises = roster.map((player) =>
        getTeamPlayerInjuries(player.teamPlayerId)
          .then((injuries) =>
            injuries.map((injury) => ({
              player,
              injury,
            }))
          )
          .catch(() => []) // If individual player fetch fails, treat as empty
      );

      const allInjuryArrays = await Promise.all(injuriesPromises);
      const merged = allInjuryArrays.flat();

      // Sort by startDate descending
      merged.sort((a, b) => new Date(b.injury.startDate).getTime() - new Date(a.injury.startDate).getTime());

      setInjuryRecords(merged);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar las lesiones');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (endDate: string | null | undefined): string => {
    return endDate == null ? 'De baja' : 'De alta';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const renderInjuryItem = (item: InjuryWithPlayer) => {
    const photoUri = resolvePhotoUrl(item.player.urlPhoto, API_BASE_URL);
    const status = getStatusText(item.injury.endDate);
    const statusColor = status === 'De baja' ? coachColors.error : coachColors.success;

    return (
      <View testID={`injury-item-${item.injury.id}`} style={styles.card}>
        <View style={styles.header}>
          <View style={styles.photoArea}>
            {photoUri ? (
              <Image
                testID={`player-photo-${item.injury.id}`}
                source={{ uri: photoUri }}
                style={styles.photo}
              />
            ) : (
              <View
                testID={`player-photo-placeholder-${item.injury.id}`}
                style={styles.photoPlaceholder}
              />
            )}
          </View>

          <View style={styles.headerBody}>
            <Text testID={`player-alias-${item.injury.id}`} style={styles.playerName} numberOfLines={1}>
              {item.player.alias}
            </Text>
            <Text testID={`player-position-${item.injury.id}`} style={styles.positionText}>
              {item.player.activeDemarcation
                ? `${item.player.activeDemarcation.name} (${item.player.activeDemarcation.code})`
                : '-'}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text testID={`status-${item.injury.id}`} style={styles.statusText}>
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo:</Text>
            <Text style={styles.detailValue}>{item.injury.injuryType}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Inicio:</Text>
            <Text testID={`injury-date-${item.injury.id}`} style={styles.detailValue}>
              {formatDate(item.injury.startDate)}
            </Text>
          </View>

          {item.injury.description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Descripción:</Text>
              <Text style={styles.detailValue}>{item.injury.description}</Text>
            </View>
          )}

          {item.injury.estimatedRecovery && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recuperación estimada:</Text>
              <Text style={styles.detailValue}>{item.injury.estimatedRecovery}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fin:</Text>
            <Text style={styles.detailValue}>
              {item.injury.endDate ? formatDate(item.injury.endDate) : 'Sin definir'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => <ScreenSectionHeader title="Lesiones" />;

  if (loading) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>
            {error}
          </Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchInjuries}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (injuryRecords.length === 0) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>
            No hay lesiones registradas
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {renderHeader()}
      <FlatList
        contentContainerStyle={styles.contentContainer}
        data={injuryRecords}
        keyExtractor={(item) => item.injury.id}
        renderItem={({ item }) => renderInjuryItem(item)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: coachColors.background,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    paddingTop: 4,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: coachColors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderColor: coachColors.border,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: coachColors.border,
    borderBottomWidth: 1,
  },
  photoArea: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: coachColors.surfaceAlt,
  },
  headerBody: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: coachColors.textPrimary,
  },
  positionText: {
    fontSize: 13,
    color: coachColors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  detailsContainer: {
    padding: 12,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: coachColors.textSecondary,
    flex: 0.35,
  },
  detailValue: {
    fontSize: 13,
    color: coachColors.textPrimary,
    flex: 0.65,
    textAlign: 'right',
  },
  errorText: {
    color: coachColors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: coachColors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: coachColors.primary,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default InjuriesScreen;
