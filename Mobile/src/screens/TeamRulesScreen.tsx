import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTeamRules, type TeamRules } from '../api/teamRules';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';
import ScreenHeader, { ScreenHeaderAction } from '../shared/components/ScreenHeader';

const COACH_ADMIN_ROLES = ['coach', 'administrator'];

const TeamRulesScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';
  const { roles } = useAuth();
  const isCoachOrAdmin = (roles ?? []).some((r) => COACH_ADMIN_ROLES.includes(r.toLowerCase()));

  const [rules, setRules] = useState<TeamRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getTeamRules(teamId);
      setRules(result);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las normas del equipo');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId) {
      fetchRules();
    }
  }, [teamId, fetchRules]);

  const toggleRule = (ruleId: string) => {
    setExpandedRuleId((current) => (current === ruleId ? null : ruleId));
  };

  const actions: ScreenHeaderAction[] | undefined = isCoachOrAdmin
    ? [
        {
          key: 'edit',
          icon: 'create-outline',
          label: 'Editar',
          testID: 'edit-button',
          onPress: () => navigation.navigate('TeamRulesEdit', { teamId }),
        },
      ]
    : undefined;

  const renderHeader = () => <ScreenHeader title="Normas del equipo" actions={actions} />;

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>
            {error}
          </Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchRules}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!rules) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>
            Aún no disponible
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text testID="intro-note" style={styles.noteText}>
          {rules.introNote}
        </Text>

        {rules.rules.map((rule) => {
          const isExpanded = expandedRuleId === rule.id;
          const hasDetail = Boolean(rule.longDescription || rule.bulletPoints?.length || rule.consequenceDetail);

          return (
            <Pressable
              key={rule.id}
              testID={`rule-card-${rule.id}`}
              style={styles.ruleCard}
              onPress={() => toggleRule(rule.id)}
            >
              <Text testID={`rule-order-${rule.id}`} style={styles.ruleOrder}>
                {rule.order}
              </Text>
              <Text style={styles.ruleTitle}>{rule.shortTitle}</Text>
              {rule.highlight && <Text style={styles.ruleHighlight}>{rule.highlight}</Text>}

              <View style={styles.ruleSummaryRow}>
                <Text style={styles.ruleSummaryLabel}>Incumplimiento:</Text>
                <Text style={styles.ruleSummaryValue}>{rule.violationSummary}</Text>
              </View>
              <View style={styles.ruleSummaryRow}>
                <Text style={styles.ruleSummaryLabel}>Consecuencia:</Text>
                <Text style={styles.ruleSummaryValue}>{rule.consequenceSummary}</Text>
              </View>

              {isExpanded && hasDetail && (
                <View testID={`rule-detail-${rule.id}`} style={styles.ruleDetail}>
                  {rule.longDescription && <Text style={styles.ruleDetailText}>{rule.longDescription}</Text>}
                  {rule.bulletPoints?.map((bullet, index) => (
                    <Text key={index} style={styles.ruleBullet}>
                      {'• '}
                      {bullet}
                    </Text>
                  ))}
                  {rule.consequenceDetail && (
                    <Text style={styles.ruleDetailText}>{rule.consequenceDetail}</Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}

        {rules.closingNote && (
          <Text testID="closing-note" style={styles.noteText}>
            {rules.closingNote}
          </Text>
        )}
        {rules.applicationNote && (
          <Text testID="application-note" style={styles.noteText}>
            {rules.applicationNote}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: coachColors.background,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingBottom: 32,
    gap: 12,
  },
  noteText: {
    color: coachColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  ruleCard: {
    backgroundColor: coachColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coachColors.border,
    padding: 14,
    gap: 6,
  },
  ruleOrder: {
    color: coachColors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  ruleTitle: {
    color: coachColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  ruleHighlight: {
    color: coachColors.primaryLight,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  ruleSummaryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ruleSummaryLabel: {
    color: coachColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  ruleSummaryValue: {
    color: coachColors.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  ruleDetail: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: coachColors.border,
    gap: 6,
  },
  ruleDetailText: {
    color: coachColors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  ruleBullet: {
    color: coachColors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
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

export default TeamRulesScreen;
