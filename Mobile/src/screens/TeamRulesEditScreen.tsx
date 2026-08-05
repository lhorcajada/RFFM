import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getTeamRules, saveTeamRules, deleteTeamRules, type SaveTeamRuleInput } from '../api/teamRules';
import { coachColors } from '../theme/colors';
import ScreenHeader from '../shared/components/ScreenHeader';

interface RuleFormRow {
  id?: string;
  shortTitle: string;
  highlight: string;
  violationSummary: string;
  consequenceSummary: string;
  longDescription: string;
  bulletPoints: string;
  consequenceDetail: string;
}

const emptyRuleRow = (): RuleFormRow => ({
  shortTitle: '',
  highlight: '',
  violationSummary: '',
  consequenceSummary: '',
  longDescription: '',
  bulletPoints: '',
  consequenceDetail: '',
});

const nullableTrim = (value: string): string | null => (value.trim() ? value.trim() : null);

const TeamRulesEditScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingRules, setHasExistingRules] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [introNote, setIntroNote] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [applicationNote, setApplicationNote] = useState('');
  const [rules, setRules] = useState<RuleFormRow[]>([]);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const existing = await getTeamRules(teamId);
        if (existing) {
          setHasExistingRules(true);
          setTitle(existing.title);
          setSubtitle(existing.subtitle);
          setIntroNote(existing.introNote);
          setClosingNote(existing.closingNote ?? '');
          setApplicationNote(existing.applicationNote ?? '');
          setRules(
            existing.rules.map((rule) => ({
              id: rule.id,
              shortTitle: rule.shortTitle,
              highlight: rule.highlight ?? '',
              violationSummary: rule.violationSummary,
              consequenceSummary: rule.consequenceSummary,
              longDescription: rule.longDescription ?? '',
              bulletPoints: rule.bulletPoints?.join('\n') ?? '',
              consequenceDetail: rule.consequenceDetail ?? '',
            })),
          );
        } else {
          setHasExistingRules(false);
        }
      } catch (e: any) {
        setError(e.response?.data?.detail || 'No se pudieron cargar las normas del equipo');
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const updateRule = useCallback((index: number, patch: Partial<RuleFormRow>) => {
    setRules((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const addRule = useCallback(() => {
    setRules((current) => [...current, emptyRuleRow()]);
  }, []);

  const removeRule = useCallback((index: number) => {
    setRules((current) => current.filter((_, i) => i !== index));
  }, []);

  const moveRule = useCallback((index: number, direction: -1 | 1) => {
    setRules((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);

    if (!title.trim() || !subtitle.trim() || !introNote.trim()) {
      setError('Completa el título, el subtítulo y la nota inicial');
      return;
    }

    if (rules.length === 0) {
      setError('Añade al menos una norma');
      return;
    }

    const hasInvalidRule = rules.some(
      (rule) => !rule.shortTitle.trim() || !rule.violationSummary.trim() || !rule.consequenceSummary.trim(),
    );
    if (hasInvalidRule) {
      setError('Completa el título, el incumplimiento y la consecuencia de cada norma');
      return;
    }

    const normalizedPayloadRules: SaveTeamRuleInput[] = rules.map((rule) => {
      const bulletLines = rule.bulletPoints
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return {
        id: rule.id,
        shortTitle: rule.shortTitle.trim(),
        highlight: nullableTrim(rule.highlight),
        violationSummary: rule.violationSummary.trim(),
        consequenceSummary: rule.consequenceSummary.trim(),
        longDescription: nullableTrim(rule.longDescription),
        bulletPoints: bulletLines.length > 0 ? bulletLines : null,
        consequenceDetail: nullableTrim(rule.consequenceDetail),
      };
    });

    try {
      setSaving(true);
      await saveTeamRules(teamId, {
        title: title.trim(),
        subtitle: subtitle.trim(),
        introNote: introNote.trim(),
        closingNote: nullableTrim(closingNote),
        applicationNote: nullableTrim(applicationNote),
        rules: normalizedPayloadRules,
      });
      navigation.replace('RulesTab', { teamId });
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudieron guardar las normas del equipo');
    } finally {
      setSaving(false);
    }
  }, [title, subtitle, introNote, closingNote, applicationNote, rules, teamId, navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert('Eliminar normas', '¿Seguro que quieres eliminar las normas del equipo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTeamRules(teamId);
            navigation.replace('RulesTab', { teamId });
          } catch (e: any) {
            setError(e.response?.data?.detail || 'No se pudieron eliminar las normas del equipo');
          }
        },
      },
    ]);
  }, [teamId, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Editar normas" />
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Editar normas" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Título</Text>
          <TextInput
            testID="title-input"
            style={styles.input}
            placeholder="Título"
            placeholderTextColor={coachColors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Subtítulo</Text>
          <TextInput
            testID="subtitle-input"
            style={styles.input}
            placeholder="Subtítulo"
            placeholderTextColor={coachColors.textSecondary}
            value={subtitle}
            onChangeText={setSubtitle}
          />

          <Text style={styles.label}>Nota inicial</Text>
          <TextInput
            testID="intro-note-input"
            style={[styles.input, styles.multilineInput]}
            placeholder="Nota inicial"
            placeholderTextColor={coachColors.textSecondary}
            value={introNote}
            onChangeText={setIntroNote}
            multiline
          />

          <Text style={styles.label}>Nota de cierre (opcional)</Text>
          <TextInput
            testID="closing-note-input"
            style={[styles.input, styles.multilineInput]}
            placeholder="Nota de cierre"
            placeholderTextColor={coachColors.textSecondary}
            value={closingNote}
            onChangeText={setClosingNote}
            multiline
          />

          <Text style={styles.label}>Nota de aplicación (opcional)</Text>
          <TextInput
            testID="application-note-input"
            style={[styles.input, styles.multilineInput]}
            placeholder="Nota de aplicación"
            placeholderTextColor={coachColors.textSecondary}
            value={applicationNote}
            onChangeText={setApplicationNote}
            multiline
          />

          <View style={styles.rulesHeaderRow}>
            <Text style={styles.sectionTitle}>Normas</Text>
            <Pressable testID="add-rule-button" style={styles.addButton} onPress={addRule}>
              <Ionicons name="add-circle-outline" size={20} color={coachColors.primary} />
              <Text style={styles.addButtonText}>Añadir norma</Text>
            </Pressable>
          </View>

          {rules.map((rule, index) => (
            <View key={index} style={styles.ruleRow} testID={`rule-row-${index}`}>
              <View style={styles.ruleRowHeader}>
                <Text style={styles.ruleRowIndex}>{index + 1}</Text>
                <Pressable testID={`move-up-${index}`} onPress={() => moveRule(index, -1)} style={styles.iconButton}>
                  <Ionicons name="arrow-up-outline" size={18} color={coachColors.textSecondary} />
                </Pressable>
                <Pressable
                  testID={`move-down-${index}`}
                  onPress={() => moveRule(index, 1)}
                  style={styles.iconButton}
                >
                  <Ionicons name="arrow-down-outline" size={18} color={coachColors.textSecondary} />
                </Pressable>
                <Pressable
                  testID={`remove-rule-${index}`}
                  onPress={() => removeRule(index)}
                  style={styles.iconButton}
                >
                  <Ionicons name="trash-outline" size={18} color={coachColors.error} />
                </Pressable>
              </View>

              <TextInput
                testID={`rule-shortTitle-${index}`}
                style={styles.input}
                placeholder="Título de la norma"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.shortTitle}
                onChangeText={(text) => updateRule(index, { shortTitle: text })}
              />
              <TextInput
                testID={`rule-highlight-${index}`}
                style={styles.input}
                placeholder="Frase destacada (opcional)"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.highlight}
                onChangeText={(text) => updateRule(index, { highlight: text })}
              />
              <TextInput
                testID={`rule-violation-${index}`}
                style={styles.input}
                placeholder="Incumplimiento"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.violationSummary}
                onChangeText={(text) => updateRule(index, { violationSummary: text })}
              />
              <TextInput
                testID={`rule-consequence-${index}`}
                style={styles.input}
                placeholder="Consecuencia"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.consequenceSummary}
                onChangeText={(text) => updateRule(index, { consequenceSummary: text })}
              />
              <TextInput
                testID={`rule-longDescription-${index}`}
                style={[styles.input, styles.multilineInput]}
                placeholder="Descripción larga (opcional)"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.longDescription}
                onChangeText={(text) => updateRule(index, { longDescription: text })}
                multiline
              />
              <TextInput
                testID={`rule-bulletPoints-${index}`}
                style={[styles.input, styles.multilineInput]}
                placeholder="Puntos (uno por línea, opcional)"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.bulletPoints}
                onChangeText={(text) => updateRule(index, { bulletPoints: text })}
                multiline
              />
              <TextInput
                testID={`rule-consequenceDetail-${index}`}
                style={[styles.input, styles.multilineInput]}
                placeholder="Detalle de la consecuencia (opcional)"
                placeholderTextColor={coachColors.textSecondary}
                value={rule.consequenceDetail}
                onChangeText={(text) => updateRule(index, { consequenceDetail: text })}
                multiline
              />
            </View>
          ))}

          {error && (
            <Text testID="error-message" style={styles.errorText}>
              {error}
            </Text>
          )}

          <Pressable
            testID="save-button"
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonTextPrimary}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </Pressable>

          {hasExistingRules && (
            <Pressable
              testID="delete-rules-button"
              style={[styles.button, styles.buttonDanger]}
              onPress={handleDelete}
            >
              <Text style={styles.buttonTextDanger}>Eliminar normas</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: coachColors.background },
  keyboardAvoiding: { flex: 1 },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { paddingBottom: 32, gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: coachColors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: coachColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: coachColors.textPrimary,
    backgroundColor: coachColors.surface,
  },
  multilineInput: { minHeight: 60, textAlignVertical: 'top' },
  rulesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: coachColors.textPrimary },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addButtonText: { color: coachColors.primary, fontWeight: '600' },
  ruleRow: {
    borderWidth: 1,
    borderColor: coachColors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: coachColors.surface,
  },
  ruleRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleRowIndex: { color: coachColors.primary, fontWeight: '700', flex: 1 },
  iconButton: { padding: 4 },
  errorText: { color: coachColors.error, fontSize: 14, textAlign: 'center' },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonPrimary: { backgroundColor: coachColors.primary },
  buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: coachColors.error },
  buttonTextPrimary: { color: coachColors.contrastText, fontWeight: '700' },
  buttonTextDanger: { color: coachColors.error, fontWeight: '700' },
});

export default TeamRulesEditScreen;
