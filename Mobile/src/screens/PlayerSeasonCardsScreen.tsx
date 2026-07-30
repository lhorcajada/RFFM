import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, API_BASE_URL } from '../api/client';
import { useRoute } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import { groupPlayersByPosition, PlayerPositionSection } from './hooks/groupPlayersByPosition';
import ScreenHeader from '../shared/components/ScreenHeader';

interface Demarcation {
  id: number;
  name: string;
  code: string;
}

interface PlayerSeasonCard {
  teamPlayerId: string;
  alias: string | null;
  urlPhoto: string | null;
  dorsal: number | null;
  currentMatchday: number;
  matchesPlayed: number;
  matchesStarted: number;
  matchesSinceLastDeconvocation: number;
  yellowCards: number;
  redCards: number;
  goals: number;
  trainingsAttended: number;
  trainingsAbsent: number;
  trainingsPossible: number;
  activeDemarcation: Demarcation | null;
  possibleDemarcations: Demarcation[];
}

interface StatField {
  key: keyof Pick<
    PlayerSeasonCard,
    | 'currentMatchday'
    | 'matchesPlayed'
    | 'matchesStarted'
    | 'matchesSinceLastDeconvocation'
    | 'yellowCards'
    | 'redCards'
    | 'goals'
    | 'trainingsAttended'
    | 'trainingsAbsent'
    | 'trainingsPossible'
  >;
  label: string;
}

const STAT_FIELDS: StatField[] = [
  { key: 'currentMatchday', label: 'Jornada actual' },
  { key: 'matchesPlayed', label: 'Partidos jugados' },
  { key: 'matchesStarted', label: 'Partidos titular' },
  { key: 'matchesSinceLastDeconvocation', label: 'Desde desconvocatoria' },
  { key: 'yellowCards', label: 'Tarjetas amarillas' },
  { key: 'redCards', label: 'Tarjetas rojas' },
  { key: 'goals', label: 'Goles' },
  { key: 'trainingsAttended', label: 'Entrenos asistidos' },
  { key: 'trainingsAbsent', label: 'Entrenos ausentes' },
  { key: 'trainingsPossible', label: 'Entrenos posibles' },
];

const PlayerSeasonCardsScreen = () => {
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';

  const [cards, setCards] = useState<PlayerSeasonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      fetchCards();
    }
  }, [teamId]);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/mobile/teams/${teamId}/season-player-cards`);
      setCards((response.data || []) as PlayerSeasonCard[]);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSectionKey((current) => (current === key ? null : key));
  };

  const renderPlayerCard = (card: PlayerSeasonCard) => {
    const photoUri = resolvePhotoUrl(card.urlPhoto, API_BASE_URL);
    return (
      <View key={card.teamPlayerId} testID={`player-season-card-${card.teamPlayerId}`} style={styles.card}>
        <View style={styles.header}>
          <View style={styles.photoArea}>
            {photoUri ? (
              <Image
                testID={`player-photo-${card.teamPlayerId}`}
                source={{ uri: photoUri }}
                style={styles.photo}
              />
            ) : (
              <View
                testID={`player-photo-placeholder-${card.teamPlayerId}`}
                style={styles.photoPlaceholder}
              />
            )}
            {card.dorsal != null && (
              <View style={styles.dorsalBadge}>
                <Text testID={`player-dorsal-${card.teamPlayerId}`} style={styles.dorsalBadgeText}>
                  {card.dorsal}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.headerBody}>
            <View style={styles.accentLine} />
            <Text testID={`player-alias-${card.teamPlayerId}`} style={styles.playerName} numberOfLines={1}>
              {card.alias}
            </Text>
            <Text testID={`player-demarcation-${card.teamPlayerId}`} style={styles.demarcationText}>
              {card.activeDemarcation
                ? `${card.activeDemarcation.name} (${card.activeDemarcation.code})`
                : '-'}
            </Text>
            {card.possibleDemarcations.length > 0 && (
              <View style={styles.possibleDemarcationsRow}>
                {card.possibleDemarcations.map((demarcation) => (
                  <View key={demarcation.id} style={styles.demarcationChip}>
                    <Text
                      testID={`player-possible-demarcation-${card.teamPlayerId}-${demarcation.id}`}
                      style={styles.demarcationChipText}
                    >
                      {demarcation.code}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsGrid}>
          {STAT_FIELDS.map((field) => (
            <View key={field.key} style={styles.statItem}>
              <Text
                testID={`stat-${field.key}-${card.teamPlayerId}`}
                style={styles.statValue}
              >
                {card[field.key]}
              </Text>
              <Text style={styles.statLabel}>{field.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const sections = useMemo(
    () => groupPlayersByPosition(cards) as PlayerPositionSection<PlayerSeasonCard>[],
    [cards],
  );

  const visibleSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        data: section.key === expandedSectionKey ? section.data : [],
      })),
    [sections, expandedSectionKey],
  );

  const renderHeader = () => <ScreenHeader title="Plantilla" />;

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
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchCards}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.listContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay información disponible</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {renderHeader()}
      <SectionList
      contentContainerStyle={styles.contentContainer}
      sections={visibleSections}
      keyExtractor={(card) => card.teamPlayerId}
      renderSectionHeader={({ section }) => {
        const isExpanded = section.key === expandedSectionKey;
        const fullSection = sections.find((s) => s.key === section.key);
        const count = fullSection ? fullSection.data.length : 0;
        return (
          <Pressable
            testID={`position-section-header-${section.key}`}
            onPress={() => toggleSection(section.key)}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionHeaderTitle}>
              {section.title} ({count})
            </Text>
            <Ionicons
              testID={`position-section-chevron-${section.key}`}
              name={isExpanded ? 'chevron-down-outline' : 'chevron-forward-outline'}
              size={18}
              color={coachColors.primaryLight}
            />
          </Pressable>
        );
      }}
      renderItem={({ item }) => renderPlayerCard(item)}
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: coachColors.surfaceAlt,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: coachColors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
  },
  photoArea: {
    width: 88,
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: coachColors.background,
  },
  dorsalBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dorsalBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  headerBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
    gap: 4,
  },
  accentLine: {
    height: 2,
    width: 28,
    borderRadius: 1,
    backgroundColor: coachColors.primary,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: coachColors.textPrimary,
  },
  demarcationText: {
    fontSize: 12,
    color: coachColors.textSecondary,
  },
  possibleDemarcationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  demarcationChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: coachColors.background,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  demarcationChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: coachColors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: coachColors.border,
  },
  statItem: {
    width: '33.33%',
    paddingVertical: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: coachColors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: coachColors.textSecondary,
    textAlign: 'center',
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

export default PlayerSeasonCardsScreen;
