import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { coachColors } from '../theme/colors';
import { fetchTeamSummary, TeamSummary } from '../api/team';
import { fetchClubEmblemDataUri } from '../api/clubEmblem';

interface Props {
  teamId?: string;
}

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const AppHeaderTitle = ({ teamId }: Props) => {
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [emblemUri, setEmblemUri] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setTeam(null);
      setEmblemUri(null);
      return;
    }

    let mounted = true;
    fetchTeamSummary(teamId).then((summary) => {
      if (mounted) setTeam(summary);
    });

    return () => {
      mounted = false;
    };
  }, [teamId]);

  useEffect(() => {
    const shieldUrl = team?.clubShieldUrl;

    if (!shieldUrl) {
      setEmblemUri(null);
      return;
    }

    if (isAbsoluteUrl(shieldUrl)) {
      setEmblemUri(shieldUrl);
      return;
    }

    if (!team?.clubId) {
      setEmblemUri(null);
      return;
    }

    let mounted = true;
    fetchClubEmblemDataUri(team.clubId).then((dataUri) => {
      if (mounted) setEmblemUri(dataUri);
    });

    return () => {
      mounted = false;
    };
  }, [team?.clubShieldUrl, team?.clubId]);

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Image testID="app-header-logo" source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>FutbolBase</Text>
        {team?.clubName && (
          <View style={styles.clubGroup}>
            {emblemUri && (
              <Image testID="club-shield" source={{ uri: emblemUri }} style={styles.clubShield} resizeMode="contain" />
            )}
            <Text style={styles.clubName}>{team.clubName}</Text>
          </View>
        )}
      </View>
      {team && (
        <View style={styles.teamRow}>
          {emblemUri && (
            <Image testID="team-shield" source={{ uri: emblemUri }} style={styles.shield} resizeMode="contain" />
          )}
          <Text style={styles.teamName}>{team.name}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  title: {
    color: coachColors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  clubGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  clubShield: {
    width: 18,
    height: 18,
    marginRight: 4,
  },
  clubName: {
    color: coachColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  shield: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  teamName: {
    color: coachColors.textSecondary,
    fontSize: 13,
  },
});

export default AppHeaderTitle;
