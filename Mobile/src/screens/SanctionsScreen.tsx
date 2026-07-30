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
import { getTeamPlayerSanctions, type SanctionRecord } from '../api/sanctions';
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

interface SanctionWithPlayer {
  player: PlayerRosterItem;
  sanction: SanctionRecord;
}

type SanctionCategory = 'Competition' | 'InternalDiscipline';

interface SanctionsByCategory {
  Competition: SanctionWithPlayer[];
  InternalDiscipline: SanctionWithPlayer[];
}

const SanctionsScreen = () => {
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';

  const [sanctionsByCategory, setSanctionsByCategory] = useState<SanctionsByCategory>({
    Competition: [],
    InternalDiscipline: [],
  });
  const [activeCategory, setActiveCategory] = useState<SanctionCategory>('Competition');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      fetchSanctions();
    }
  }, [teamId]);

  const fetchSanctions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch roster
      const rosterResponse = await api.get(`/api/mobile/teams/${teamId}/season-player-cards`);
      const roster: PlayerRosterItem[] = rosterResponse.data || [];

      // Fetch sanctions for each player and both categories
      const competitionPromises = roster.map((player) =>
        getTeamPlayerSanctions(player.teamPlayerId, 'Competition')
          .then((sanctions) =>
            sanctions.map((sanction) => ({
              player,
              sanction,
            }))
          )
          .catch(() => [])
      );

      const internalDisciplinePromises = roster.map((player) =>
        getTeamPlayerSanctions(player.teamPlayerId, 'InternalDiscipline')
          .then((sanctions) =>
            sanctions.map((sanction) => ({
              player,
              sanction,
            }))
          )
          .catch(() => [])
      );

      const competitionArrays = await Promise.all(competitionPromises);
      const internalArrays = await Promise.all(internalDisciplinePromises);

      const mergedCompetition = competitionArrays.flat().sort(
        (a, b) =>
          new Date(b.sanction.startDate).getTime() -
          new Date(a.sanction.startDate).getTime()
      );

      const mergedInternal = internalArrays.flat().sort(
        (a, b) =>
          new Date(b.sanction.startDate).getTime() -
          new Date(a.sanction.startDate).getTime()
      );

      setSanctionsByCategory({
        Competition: mergedCompetition,
        InternalDiscipline: mergedInternal,
      });
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar las sanciones');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (endDate: string | null | undefined): string => {
    return endDate == null ? 'Activa' : 'Resuelta';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const renderSanctionItem = (item: SanctionWithPlayer) => {
    const photoUri = resolvePhotoUrl(item.player.urlPhoto, API_BASE_URL);
    const status = getStatusText(item.sanction.endDate);
    const statusColor = status === 'Activa' ? coachColors.error : coachColors.success;

    return (
      <View testID={`sanction-item-${item.sanction.id}`} style={styles.card}>
        <View style={styles.header}>
          <View style={styles.photoArea}>
            {photoUri ? (
              <Image
                testID={`player-photo-${item.sanction.id}`}
                source={{ uri: photoUri }}
                style={styles.photo}
              />
            ) : (
              <View
                testID={`player-photo-placeholder-${item.sanction.id}`}
                style={styles.photoPlaceholder}
              />
            )}
          </View>

          <View style={styles.headerBody}>
            <Text testID={`player-alias-${item.sanction.id}`} style={styles.playerName} numberOfLines={1}>
              {item.player.alias}
            </Text>
            <Text testID={`player-position-${item.sanction.id}`} style={styles.positionText}>
              {item.player.activeDemarcation
                ? `${item.player.activeDemarcation.name} (${item.player.activeDemarcation.code})`
                : '-'}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text testID={`status-${item.sanction.id}`} style={styles.statusText}>
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo:</Text>
            <Text style={styles.detailValue}>{item.sanction.sanctionType}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Inicio:</Text>
            <Text testID={`sanction-date-${item.sanction.id}`} style={styles.detailValue}>
              {formatDate(item.sanction.startDate)}
            </Text>
          </View>

          {item.sanction.description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Descripción:</Text>
              <Text style={styles.detailValue}>{item.sanction.description}</Text>
            </View>
          )}

          {item.sanction.estimatedEnd && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fin estimado:</Text>
              <Text style={styles.detailValue}>{formatDate(item.sanction.estimatedEnd)}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fin:</Text>
            <Text style={styles.detailValue}>
              {item.sanction.endDate ? formatDate(item.sanction.endDate) : 'Sin definir'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => <ScreenSectionHeader title="Sanciones" />;

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <Pressable
        testID="tab-competition"
        style={[styles.tab, activeCategory === 'Competition' && styles.tabActive]}
        onPress={() => setActiveCategory('Competition')}
      >
        <Text style={[styles.tabLabel, activeCategory === 'Competition' && styles.tabLabelActive]}>
          En competición
        </Text>
      </Pressable>
      <Pressable
        testID="tab-internal"
        style={[styles.tab, activeCategory === 'InternalDiscipline' && styles.tabActive]}
        onPress={() => setActiveCategory('InternalDiscipline')}
      >
        <Text style={[styles.tabLabel, activeCategory === 'InternalDiscipline' && styles.tabLabelActive]}>
          Por normas internas
        </Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.fullContainer}>
        <View style={styles.headerWrapper}>{renderHeader()}</View>
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullContainer}>
        <View style={styles.headerWrapper}>{renderHeader()}</View>
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>
            {error}
          </Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchSanctions}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const visibleSanctions = sanctionsByCategory[activeCategory];

  if (sanctionsByCategory.Competition.length === 0 && sanctionsByCategory.InternalDiscipline.length === 0) {
    return (
      <View style={styles.fullContainer}>
        <View style={styles.headerWrapper}>{renderHeader()}</View>
        {renderTabs()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>
            No hay sanciones registradas
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <View style={styles.headerWrapper}>{renderHeader()}</View>
      {renderTabs()}

      {visibleSanctions.length === 0 ? (
        <View style={styles.centeredContent}>
          <Text testID="empty-category-message" style={styles.emptyText}>
            No hay sanciones en esta categoría
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          data={visibleSanctions}
          keyExtractor={(item) => item.sanction.id}
          renderItem={({ item }) => renderSanctionItem(item)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: coachColors.background,
  },
  headerWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: {
    flex: 1,
    backgroundColor: coachColors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomColor: coachColors.border,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: coachColors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: coachColors.textSecondary,
  },
  tabLabelActive: {
    color: coachColors.primary,
  },
  contentContainer: {
    padding: 16,
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

export default SanctionsScreen;
