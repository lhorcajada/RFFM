import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { coachColors } from '../../theme/colors';
import { API_BASE_URL } from '../../api/client';
import { resolvePhotoUrl } from '../../utils/resolvePhotoUrl';

export interface SportEvent {
  id: string;
  name: string;
  eveDateTime: string;
  rivalName?: string;
  location?: string;
  isHomeMatch?: boolean;
  teamName?: string;
  teamPhotoUrl?: string;
  rivalPhotoUrl?: string;
  localGoals?: string;
  visitorGoals?: string;
  eventTypeId?: number;
}

interface Props {
  event: SportEvent;
  eventTypeName?: string | null;
  onPress: (eventId: string) => void;
}

type MatchResult = 'won' | 'draw' | 'lost' | null;

function getMatchResult(event: SportEvent): MatchResult {
  const lg = event.localGoals;
  const vg = event.visitorGoals;
  if (lg == null || lg === '' || vg == null || vg === '') return null;
  const lNum = parseInt(lg, 10);
  const vNum = parseInt(vg, 10);
  if (isNaN(lNum) || isNaN(vNum)) return null;
  const isHome = event.isHomeMatch !== false;
  const myGoals = isHome ? lNum : vNum;
  const theirGoals = isHome ? vNum : lNum;
  if (myGoals > theirGoals) return 'won';
  if (myGoals === theirGoals) return 'draw';
  return 'lost';
}

function getHeaderStyle(eventTypeName?: string | null) {
  const name = (eventTypeName ?? '').toLowerCase();
  if (name.includes('entrenamiento')) {
    return { emoji: '⚽', backgroundColor: '#2e7d32' };
  }
  if (name.includes('torneo') || name.includes('competici')) {
    return { emoji: '🏆', backgroundColor: '#c62828' };
  }
  return { emoji: '📅', backgroundColor: '#455a64' };
}

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-ES', { dateStyle: 'medium' });
}

function formatTime(raw: string): string | null {
  if (!raw.includes('T')) return null;
  const date = new Date(raw);
  if (isNaN(date.getTime())) return null;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function EventCard({ event, eventTypeName, onPress }: Props) {
  const isMatch = (eventTypeName ?? '').toLowerCase().includes('partido');
  const isAway = event.isHomeMatch === false;
  const hasScore =
    event.localGoals != null && event.localGoals !== '' &&
    event.visitorGoals != null && event.visitorGoals !== '';

  const leftTeamName = isAway ? (event.rivalName ?? 'Rival') : (event.teamName ?? 'Mi equipo');
  const rightTeamName = isAway ? (event.teamName ?? 'Mi equipo') : (event.rivalName ?? 'Rival');
  const leftShield = isAway ? event.rivalPhotoUrl : event.teamPhotoUrl;
  const rightShield = isAway ? event.teamPhotoUrl : event.rivalPhotoUrl;

  const matchResult = isMatch ? getMatchResult(event) : null;
  const resultLabel =
    matchResult === 'won' ? 'Victoria' :
    matchResult === 'draw' ? 'Empate' :
    matchResult === 'lost' ? 'Derrota' : null;

  const header = getHeaderStyle(eventTypeName);
  const time = formatTime(event.eveDateTime);

  return (
    <Pressable
      testID={`event-item-${event.id}`}
      style={styles.card}
      onPress={() => onPress(event.id)}
    >
      {isMatch ? (
        <View style={styles.matchHeader}>
          <Text style={styles.homeBadge}>{isAway ? '✈️ Visitante' : '🏠 Local'}</Text>
          <View style={styles.matchTeamBlock}>
            <ShieldImage src={leftShield} testIDPrefix="shield-left" />
            <Text style={styles.matchTeamName} numberOfLines={2}>{leftTeamName}</Text>
          </View>
          <View style={styles.matchCenter}>
            {hasScore ? (
              <Text style={styles.matchScore}>{event.localGoals} - {event.visitorGoals}</Text>
            ) : (
              <>
                <Text style={styles.matchVs}>vs</Text>
                {time && <Text style={styles.matchKickoff}>{time}</Text>}
              </>
            )}
            {resultLabel && (
              <Text style={[styles.resultBadge, resultBadgeStyle(matchResult)]}>{resultLabel}</Text>
            )}
          </View>
          <View style={styles.matchTeamBlock}>
            <ShieldImage src={rightShield} testIDPrefix="shield-right" />
            <Text style={styles.matchTeamName} numberOfLines={2}>{rightTeamName}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { backgroundColor: header.backgroundColor }]}>
          <Text style={styles.avatar}>{header.emoji}</Text>
          {eventTypeName && <Text style={styles.typeChip}>{eventTypeName}</Text>}
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{event.name}</Text>
        <Text style={styles.meta}>
          {formatDate(event.eveDateTime)}
          {time && !isMatch ? ` · ${time}` : ''}
        </Text>
        {event.location && (
          <Text style={styles.meta} numberOfLines={1}>📍 {event.location}</Text>
        )}
        {!isMatch && event.rivalName && (
          <Text style={styles.meta} numberOfLines={1}>Rival: {event.rivalName}</Text>
        )}
      </View>
    </Pressable>
  );
}

function ShieldImage({ src, testIDPrefix }: { src?: string; testIDPrefix: string }) {
  const resolved = resolvePhotoUrl(src, API_BASE_URL);
  if (!resolved) return <View testID={`${testIDPrefix}-placeholder`} style={styles.shieldPlaceholder} />;
  return <Image testID={testIDPrefix} source={{ uri: resolved }} style={styles.shield} />;
}

function resultBadgeStyle(result: MatchResult) {
  if (result === 'won') return { backgroundColor: '#1b5e20', color: '#a5d6a7' };
  if (result === 'draw') return { backgroundColor: '#e65100', color: '#ffcc80' };
  if (result === 'lost') return { backgroundColor: '#b71c1c', color: '#ef9a9a' };
  return {};
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    marginBottom: 12,
  },
  header: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  avatar: {
    fontSize: 32,
  },
  typeChip: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchHeader: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 18,
    backgroundColor: '#0d3d0d',
  },
  homeBadge: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  matchTeamBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  matchTeamName: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
  shield: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  shieldPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  matchCenter: {
    minWidth: 60,
    alignItems: 'center',
    gap: 4,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  matchVs: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.75)',
  },
  matchKickoff: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  resultBadge: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  body: {
    padding: 12,
    gap: 4,
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
    color: coachColors.textPrimary,
  },
  meta: {
    fontSize: 13,
    color: coachColors.textSecondary,
  },
});
