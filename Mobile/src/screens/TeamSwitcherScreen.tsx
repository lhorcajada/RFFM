import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { coachColors } from '../theme/colors';

interface Team {
  teamId: string;
  teamName: string;
  roleId: number;
  linkedTeamPlayerId?: string;
}

type NavigationProp = NativeStackNavigationProp<any>;

const TeamSwitcherScreen = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/mobile/me/teams');
      const teamList = response.data as Team[];

      if (teamList.length === 0) {
        setError('No tienes acceso a ningún equipo');
        setTeams([]);
      } else if (teamList.length === 1) {
        // Replace (not navigate) so TeamSwitcher is removed from the stack —
        // otherwise going back from Calendar lands on a stale, teams-less screen.
        navigation.replace('Calendar', {
          teamId: teamList[0].teamId,
          teamPlayerId: teamList[0].linkedTeamPlayerId,
        });
      } else {
        setTeams(teamList);
      }
    } catch (e: any) {
      const errorMessage = e.response?.data?.detail || 'Error al cargar equipos';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = (teamId: string, teamPlayerId?: string) => {
    navigation.navigate('Calendar', { teamId, teamPlayerId });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
      </View>
    );
  }

  if (error || teams.length === 0) {
    return (
      <View style={styles.container}>
        <Text testID="error-message" style={styles.errorText}>{error || 'Sin equipos disponibles'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selecciona un equipo</Text>

      <FlatList
        data={teams}
        keyExtractor={(item) => item.teamId}
        renderItem={({ item }) => (
          <Pressable
            testID={`team-item-${item.teamId}`}
            style={styles.teamCard}
            onPress={() => handleSelectTeam(item.teamId, item.linkedTeamPlayerId)}
          >
            <Text style={styles.teamNameText}>{item.teamName}</Text>
            <Text style={styles.teamRole}>Rol: {item.roleId === 1 ? 'Jugador' : 'Familiar'}</Text>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: coachColors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: coachColors.textPrimary,
  },
  teamCard: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: coachColors.border,
  },
  teamNameText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: coachColors.textPrimary,
  },
  teamRole: {
    fontSize: 14,
    color: coachColors.textSecondary,
  },
  errorText: {
    color: coachColors.error,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default TeamSwitcherScreen;
