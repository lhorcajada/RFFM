import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { getOrCreateDeviceId } from '../notifications/pushToken';
import { updatePushPreferences } from '../notifications/api';
import { coachColors } from '../theme/colors';

const NotificationSettingsScreen = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [newsEnabled, setNewsEnabled] = useState(true);
  const [calendarEnabled, setCalendarEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);
  }, []);

  const handleSave = async () => {
    if (!deviceId) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await updatePushPreferences(deviceId, newsEnabled, calendarEnabled);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudieron guardar las preferencias');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Noticias</Text>
        <Switch
          testID="news-switch"
          value={newsEnabled}
          onValueChange={setNewsEnabled}
          trackColor={{ false: coachColors.border, true: coachColors.primary }}
          thumbColor={coachColors.contrastText}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Calendario</Text>
        <Switch
          testID="calendar-switch"
          value={calendarEnabled}
          onValueChange={setCalendarEnabled}
          trackColor={{ false: coachColors.border, true: coachColors.primary }}
          thumbColor={coachColors.contrastText}
        />
      </View>

      {error && (
        <Text testID="error-message" style={styles.errorText}>
          {error}
        </Text>
      )}

      <Pressable testID="save-button" style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator testID="saving-indicator" color={coachColors.contrastText} />
        ) : (
          <Text style={styles.saveButtonText}>Guardar</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    backgroundColor: coachColors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: coachColors.border,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: coachColors.textPrimary,
  },
  errorText: {
    color: coachColors.error,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: coachColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: coachColors.contrastText,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default NotificationSettingsScreen;
