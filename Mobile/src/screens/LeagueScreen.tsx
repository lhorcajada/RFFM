import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import {
  fetchTeamClassification,
  fetchTeamCalendar,
  fetchTeamNextMatch,
  ClassificationRow,
  MatchDay,
  Match,
} from '../api/competitions';
import { fetchTeamSummary } from '../api/team';
import ScreenHeader from '../shared/components/ScreenHeader';

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-ES', { dateStyle: 'medium' });
}

function isPlayed(match: Match): boolean {
  return match.localGoals != null && match.visitorGoals != null;
}

const LeagueScreen = () => {
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';

  const [classification, setClassification] = useState<ClassificationRow[]>([]);
  const [matchDays, setMatchDays] = useState<MatchDay[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      fetchLeagueData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const fetchLeagueData = async () => {
    try {
      setLoading(true);
      const [classificationRes, calendarRes, nextMatchRes, teamSummary] = await Promise.all([
        fetchTeamClassification(teamId),
        fetchTeamCalendar(teamId),
        fetchTeamNextMatch(teamId),
        fetchTeamSummary(teamId),
      ]);
      setClassification(classificationRes.teams);
      setMatchDays(calendarRes.matchDays);
      setNextMatch(nextMatchRes.match);
      setTeamName(teamSummary?.name ?? null);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar la información de la liga');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => <ScreenHeader title="Liga" />;

  if (loading) {
    return (
      <View style={styles.screenContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screenContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchLeagueData}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const noCompetition = classification.length === 0 && matchDays.length === 0 && nextMatch === null;

  if (noCompetition) {
    return (
      <View style={styles.screenContainer}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="no-competition-message" style={styles.emptyText}>
            Este equipo todavía no tiene una competición asociada
          </Text>
        </View>
      </View>
    );
  }

  const isNextMatchHome = nextMatch != null && teamName != null && nextMatch.localTeamName === teamName;
  const nextMatchRival = nextMatch
    ? isNextMatchHome
      ? nextMatch.visitorTeamName
      : nextMatch.localTeamName
    : null;

  return (
    <View style={styles.screenContainer}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      {nextMatch && (
        <View testID="next-match-card" style={styles.card}>
          <Text style={styles.sectionTitle}>Próximo partido</Text>
          <Text testID="next-match-date" style={styles.nextMatchDate}>{formatDate(nextMatch.date)}</Text>
          <Text testID="next-match-rival" style={styles.nextMatchRival}>{nextMatchRival}</Text>
          {teamName != null && (
            <Text testID="next-match-venue" style={styles.nextMatchVenue}>
              {isNextMatchHome ? 'Local' : 'Visitante'}
            </Text>
          )}
        </View>
      )}

      <View testID="classification-table" style={styles.card}>
        <Text style={styles.sectionTitle}>Clasificación</Text>
        <View style={styles.classificationHeaderRow}>
          <Text style={[styles.classificationHeaderCell, styles.positionCell]}>#</Text>
          <Text style={[styles.classificationHeaderCell, styles.teamCell]}>Equipo</Text>
          <Text style={[styles.classificationHeaderCell, styles.statCell]}>PJ</Text>
          <Text style={[styles.classificationHeaderCell, styles.statCell]}>PG</Text>
          <Text style={[styles.classificationHeaderCell, styles.statCell]}>PE</Text>
          <Text style={[styles.classificationHeaderCell, styles.statCell]}>PP</Text>
          <Text style={[styles.classificationHeaderCell, styles.statCell]}>Goles</Text>
          <Text style={[styles.classificationHeaderCell, styles.statCell]}>Pts</Text>
        </View>
        {classification.map((row) => (
          <View key={row.teamId} testID={`classification-row-${row.teamId}`} style={styles.classificationRow}>
            <Text testID={`classification-position-${row.teamId}`} style={[styles.classificationCell, styles.positionCell]}>
              {row.position}
            </Text>
            <Text
              testID={`classification-team-${row.teamId}`}
              style={[styles.classificationCell, styles.teamCell]}
              numberOfLines={1}
            >
              {row.teamName}
            </Text>
            <Text testID={`classification-played-${row.teamId}`} style={[styles.classificationCell, styles.statCell]}>
              {row.played}
            </Text>
            <Text testID={`classification-won-${row.teamId}`} style={[styles.classificationCell, styles.statCell]}>
              {row.won}
            </Text>
            <Text testID={`classification-drawn-${row.teamId}`} style={[styles.classificationCell, styles.statCell]}>
              {row.drawn}
            </Text>
            <Text testID={`classification-lost-${row.teamId}`} style={[styles.classificationCell, styles.statCell]}>
              {row.lost}
            </Text>
            <Text testID={`classification-goals-${row.teamId}`} style={[styles.classificationCell, styles.statCell]}>
              {`${row.goalsFor}:${row.goalsAgainst}`}
            </Text>
            <Text testID={`classification-points-${row.teamId}`} style={[styles.classificationCell, styles.statCell, styles.pointsCell]}>
              {row.points}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Calendario</Text>
        {matchDays.map((matchDay) => (
          <View key={matchDay.matchDayNumber} testID={`calendar-matchday-${matchDay.matchDayNumber}`} style={styles.matchDay}>
            <Text style={styles.matchDayTitle}>Jornada {matchDay.matchDayNumber}</Text>
            {matchDay.matches.map((match, index) => (
              <View
                key={`${matchDay.matchDayNumber}-${index}`}
                testID={`calendar-match-${matchDay.matchDayNumber}-${index}`}
                style={styles.matchRow}
              >
                <Text style={styles.matchTeamName} numberOfLines={1}>{match.localTeamName}</Text>
                {isPlayed(match) ? (
                  <Text testID={`calendar-match-${matchDay.matchDayNumber}-${index}-score`} style={styles.matchScore}>
                    {`${match.localGoals} - ${match.visitorGoals}`}
                  </Text>
                ) : (
                  <Text testID={`calendar-match-${matchDay.matchDayNumber}-${index}-vs`} style={styles.matchVs}>
                    vs
                  </Text>
                )}
                <Text style={styles.matchTeamName} numberOfLines={1}>{match.visitorTeamName}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: coachColors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingVertical: 4,
    paddingBottom: 20,
    gap: 16,
  },
  card: {
    borderRadius: 14,
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: coachColors.textPrimary,
    marginBottom: 10,
  },
  nextMatchDate: {
    fontSize: 13,
    color: coachColors.textSecondary,
  },
  nextMatchRival: {
    fontSize: 18,
    fontWeight: '700',
    color: coachColors.textPrimary,
    marginTop: 4,
  },
  nextMatchVenue: {
    fontSize: 12,
    fontWeight: '600',
    color: coachColors.primaryLight,
    marginTop: 4,
  },
  classificationHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: coachColors.border,
    paddingBottom: 6,
    marginBottom: 4,
  },
  classificationHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: coachColors.textSecondary,
  },
  classificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  classificationCell: {
    fontSize: 12,
    color: coachColors.textPrimary,
  },
  positionCell: {
    width: 24,
  },
  teamCell: {
    flex: 1,
  },
  statCell: {
    width: 34,
    textAlign: 'center',
  },
  pointsCell: {
    fontWeight: '700',
  },
  matchDay: {
    marginBottom: 10,
  },
  matchDayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: coachColors.textSecondary,
    marginBottom: 6,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  matchTeamName: {
    flex: 1,
    fontSize: 12,
    color: coachColors.textPrimary,
  },
  matchScore: {
    fontSize: 13,
    fontWeight: '700',
    color: coachColors.textPrimary,
    marginHorizontal: 8,
  },
  matchVs: {
    fontSize: 12,
    color: coachColors.textSecondary,
    marginHorizontal: 8,
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

export default LeagueScreen;
