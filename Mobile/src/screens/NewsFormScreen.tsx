import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { getNewsById, uploadNewsImage, createNews, updateNews } from '../api/news';
import { API_BASE_URL } from '../api/client';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenHeader from '../shared/components/ScreenHeader';

type FormMode = 'create' | 'edit';

// newsDate is a pure calendar date with no time-of-day meaning, so all date math here
// must use local date components (never toISOString()/UTC parsing, which shift the
// resulting day near local midnight depending on the timezone offset).
const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayIsoDate = () => toLocalIsoDate(new Date());

const parseLocalDateOnly = (isoDateOnly: string): Date => {
  const source = isoDateOnly && isoDateOnly.length >= 10 ? isoDateOnly.slice(0, 10) : todayIsoDate();
  const [year, month, day] = source.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const capitalize = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const formatNewsDateLabel = (isoDateOnly: string): string => {
  if (!isoDateOnly) return 'Selecciona una fecha';
  return capitalize(
    parseLocalDateOnly(isoDateOnly).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
  );
};

const NewsFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { mode: FormMode; newsId?: string };
  const mode = params?.mode || 'create';
  const newsId = params?.newsId;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [newsDate, setNewsDate] = useState(todayIsoDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && newsId) {
      (async () => {
        try {
          setLoading(true);
          const data = await getNewsById(newsId);
          setTitle(data.title);
          setSubtitle(data.subtitle);
          setBody(data.body);
          setCoverImageUrl(data.coverImageUrl);
          setNewsDate(data.newsDate ? data.newsDate.slice(0, 10) : '');
        } catch (e: any) {
          setError(e.response?.data?.detail || 'No se pudo cargar la noticia');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [mode, newsId]);

  const handlePickImage = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Se necesita acceso a la galería para elegir una foto');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    try {
      setUploadingImage(true);
      const { url } = await uploadNewsImage(result.assets[0].uri);
      setCoverImageUrl(url);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudo subir la foto');
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (status?: 'Draft' | 'Published') => {
      if (!title.trim() || !subtitle.trim() || !body.trim() || !coverImageUrl) {
        setError('Completa el título, la entradilla, el cuerpo y elige una foto de portada');
        return;
      }
      if (!newsDate.trim()) {
        setError('Indica la fecha de la noticia');
        return;
      }

      try {
        setSaving(true);
        setError(null);
        if (mode === 'create') {
          const { id } = await createNews({
            title: title.trim(),
            subtitle: subtitle.trim(),
            body,
            coverImageUrl,
            status: status ?? 'Draft',
            newsDate,
          });
          navigation.replace('NewsDetail', { newsId: id });
        } else if (newsId) {
          await updateNews(newsId, {
            title: title.trim(),
            subtitle: subtitle.trim(),
            body,
            coverImageUrl,
            newsDate,
          });
          navigation.replace('NewsDetail', { newsId });
        }
      } catch (e: any) {
        setError(e.response?.data?.detail || 'No se pudo guardar la noticia');
      } finally {
        setSaving(false);
      }
    },
    [title, subtitle, body, coverImageUrl, newsDate, mode, newsId, navigation],
  );

  const handleDateChange = useCallback((_event: unknown, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setNewsDate(toLocalIsoDate(date));
    }
  }, []);

  const renderHeader = () => (
    <ScreenHeader title={mode === 'create' ? 'Nueva noticia' : 'Editar noticia'} />
  );

  if (loading) {
    return (
      <View testID="news-form-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  const coverUri = coverImageUrl ? resolvePhotoUrl(coverImageUrl, API_BASE_URL) : null;

  return (
    <View testID="news-form-container" style={styles.container}>
      {renderHeader()}
      <KeyboardAvoidingView
        testID="news-form-keyboard-avoiding"
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Pressable testID="pick-image-button" style={styles.imagePicker} onPress={handlePickImage}>
          {coverUri ? (
            <Image testID="news-form-cover-preview" source={{ uri: coverUri }} style={styles.coverPreview} />
          ) : (
            <Text style={styles.imagePickerText}>
              {uploadingImage ? 'Subiendo foto...' : 'Elegir foto de portada'}
            </Text>
          )}
        </Pressable>

        <TextInput
          testID="title-input"
          style={styles.input}
          placeholder="Título"
          placeholderTextColor={coachColors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          testID="subtitle-input"
          style={styles.input}
          placeholder="Entradilla"
          placeholderTextColor={coachColors.textSecondary}
          value={subtitle}
          onChangeText={setSubtitle}
        />
        <Text style={styles.label}>Fecha de la noticia</Text>
        <Pressable testID="news-date-input" style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateInputText}>{formatNewsDateLabel(newsDate)}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker value={parseLocalDateOnly(newsDate)} mode="date" onChange={handleDateChange} />
        )}
        <TextInput
          testID="body-input"
          style={[styles.input, styles.bodyInput]}
          placeholder="Cuerpo de la noticia"
          placeholderTextColor={coachColors.textSecondary}
          value={body}
          onChangeText={setBody}
          multiline
        />

        {error && <Text testID="error-message" style={styles.errorText}>{error}</Text>}

        {mode === 'create' ? (
          <View style={styles.buttonRow}>
            <Pressable
              testID="save-draft-button"
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => handleSubmit('Draft')}
              disabled={saving}
            >
              <Text style={styles.buttonTextSecondary}>Guardar borrador</Text>
            </Pressable>
            <Pressable
              testID="publish-button"
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => handleSubmit('Published')}
              disabled={saving}
            >
              <Text style={styles.buttonTextPrimary}>Publicar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID="save-button"
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => handleSubmit()}
            disabled={saving}
          >
            <Text style={styles.buttonTextPrimary}>Guardar cambios</Text>
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
  contentContainer: { paddingBottom: 32, gap: 12 },
  imagePicker: {
    height: 160,
    borderRadius: 14,
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPreview: { width: '100%', height: '100%' },
  imagePickerText: { color: coachColors.textSecondary },
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
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  dateInputText: { color: coachColors.textPrimary },
  errorText: { color: coachColors.error, fontSize: 14, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonPrimary: { backgroundColor: coachColors.primary },
  buttonSecondary: { backgroundColor: coachColors.surfaceAlt, borderWidth: 1, borderColor: coachColors.border },
  buttonTextPrimary: { color: coachColors.contrastText, fontWeight: '700' },
  buttonTextSecondary: { color: coachColors.textPrimary, fontWeight: '700' },
});

export default NewsFormScreen;
