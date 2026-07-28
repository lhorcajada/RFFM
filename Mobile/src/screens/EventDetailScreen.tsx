import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { api, API_BASE_URL } from '../api/client';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';
import { t } from '../i18n';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';

interface AttendanceRosterRow {
  teamPlayerId: string;
  alias: string | null;
  urlPhoto: string | null;
  dorsal: number | null;
  status: string;
  statusId: number;
}

const PRIVILEGED_ROLES = ['administrator', 'coach'];
const GROUP_ORDER = ['Pending', 'Going', 'NotGoing'] as const;
type GroupStatus = (typeof GROUP_ORDER)[number];

function statusLabel(status: string): string {
  if (status === 'Going') return t('attendance.going');
  if (status === 'NotGoing') return t('attendance.notGoing');
  return t('attendance.pending');
}

function groupLabel(status: GroupStatus): string {
  if (status === 'Going') return t('attendanceGroups.going');
  if (status === 'NotGoing') return t('attendanceGroups.notGoing');
  return t('attendanceGroups.pending');
}

const EventDetailScreen = () => {
  const route = useRoute();
  const params = route.params as {
    eventId: string;
    teamId: string;
    teamPlayerId?: string;
  } | undefined;
  const { roles } = useAuth();

  const [roster, setRoster] = useState<AttendanceRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingTeamPlayerId, setConfirmingTeamPlayerId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Partial<Record<GroupStatus, boolean>>>({});
  const expansionInitialized = useRef(false);

  const eventId = params?.eventId || '';
  const teamId = params?.teamId || '';
  const myTeamPlayerId = params?.teamPlayerId || '';
  const isPrivileged = (roles ?? []).some((role) => PRIVILEGED_ROLES.includes(role.toLowerCase()));

  useEffect(() => {
    if (eventId) {
      fetchRoster();
    }
  }, [eventId]);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/mobile/events/${eventId}/attendance-roster`);
      const data = (response.data || []) as AttendanceRosterRow[];
      setRoster(data);
      if (!expansionInitialized.current) {
        expansionInitialized.current = true;
        const myRow = data.find((row) => row.teamPlayerId === myTeamPlayerId);
        const initialGroup: GroupStatus = isPrivileged
          ? 'Pending'
          : ((myRow?.status as GroupStatus) ?? 'Pending');
        setExpandedGroups({ [initialGroup]: true });
      }
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar la convocatoria');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (status: GroupStatus) => {
    setExpandedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const handleConfirmAttendance = async (rowTeamPlayerId: string, status: string) => {
    try {
      setConfirmingTeamPlayerId(rowTeamPlayerId);
      await api.post(`/api/mobile/events/${eventId}/attendance`, {
        teamId,
        teamPlayerId: rowTeamPlayerId,
        status,
      });
      setRoster((prev) =>
        prev.map((row) =>
          row.teamPlayerId === rowTeamPlayerId ? { ...row, status } : row,
        ),
      );
      setExpandedGroups((prev) => ({ ...prev, [status as GroupStatus]: true }));
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al confirmar asistencia');
    } finally {
      setConfirmingTeamPlayerId(null);
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
        <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchRoster}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (roster.length === 0) {
    return (
      <View style={styles.container}>
        <Text testID="empty-message" style={styles.emptyText}>No hay información disponible</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {GROUP_ORDER.map((status) => {
        const groupRows = roster
          .filter((row) => row.status === status)
          .sort((a, b) => {
            if (a.teamPlayerId === myTeamPlayerId) return -1;
            if (b.teamPlayerId === myTeamPlayerId) return 1;
            return 0;
          });
        const isExpanded = Boolean(expandedGroups[status]);

        return (
          <View key={status} style={styles.group}>
            <Pressable
              testID={`group-header-${status}`}
              style={styles.groupHeader}
              onPress={() => toggleGroup(status)}
            >
              <Text testID={`group-label-${status}`} style={styles.groupLabel}>
                {groupLabel(status)} ({groupRows.length})
              </Text>
              <Text style={styles.groupChevron}>{isExpanded ? '▾' : '▸'}</Text>
            </Pressable>

            {isExpanded && groupRows.map((row) => {
              const canEdit = isPrivileged || row.teamPlayerId === myTeamPlayerId;
              const photoUri = resolvePhotoUrl(row.urlPhoto, API_BASE_URL);
              return (
                <View key={row.teamPlayerId} testID={`roster-row-${row.teamPlayerId}`} style={styles.card}>
                  <View style={styles.photoArea}>
                    {photoUri ? (
                      <Image
                        testID={`player-photo-${row.teamPlayerId}`}
                        source={{ uri: photoUri }}
                        style={styles.photo}
                      />
                    ) : (
                      <View
                        testID={`player-photo-placeholder-${row.teamPlayerId}`}
                        style={styles.photoPlaceholder}
                      />
                    )}
                    {row.dorsal != null && (
                      <View style={styles.dorsalBadge}>
                        <Text style={styles.dorsalBadgeText}>{row.dorsal}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.accentLine} />
                    <Text style={styles.playerName} numberOfLines={1}>{row.alias}</Text>
                    <Text testID={`status-${row.teamPlayerId}`} style={styles.status}>{statusLabel(row.status)}</Text>

                    {canEdit && (
                      <View style={styles.buttonGroup}>
                        <Pressable
                          testID={`going-button-${row.teamPlayerId}`}
                          style={[styles.button, styles.buttonPrimary]}
                          onPress={() => handleConfirmAttendance(row.teamPlayerId, 'Going')}
                          disabled={confirmingTeamPlayerId === row.teamPlayerId}
                        >
                          <Text style={styles.buttonText}>{t('attendance.going')}</Text>
                        </Pressable>

                        <Pressable
                          testID={`not-going-button-${row.teamPlayerId}`}
                          style={[styles.button, styles.buttonSecondary]}
                          onPress={() => handleConfirmAttendance(row.teamPlayerId, 'NotGoing')}
                          disabled={confirmingTeamPlayerId === row.teamPlayerId}
                        >
                          <Text style={styles.buttonTextSecondary}>{t('attendance.notGoing')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
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
  group: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: coachColors.border,
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: coachColors.textPrimary,
  },
  groupChevron: {
    fontSize: 14,
    color: coachColors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    marginBottom: 12,
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
  cardBody: {
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
  status: {
    fontSize: 12,
    color: coachColors.textSecondary,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: coachColors.secondary,
  },
  buttonSecondary: {
    backgroundColor: coachColors.background,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  buttonText: {
    color: coachColors.contrastText,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonTextSecondary: {
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

export default EventDetailScreen;
