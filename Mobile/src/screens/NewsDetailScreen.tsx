import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView, Alert, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { getNewsById, deleteNews, NewsDetail } from '../api/news';
import { API_BASE_URL } from '../api/client';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenHeader, { ScreenHeaderAction } from '../shared/components/ScreenHeader';

const COACH_ADMIN_ROLES = ['coach', 'administrator'];

function formatPublishDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatNewsDate(iso: string): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso);
  const formatted = date
    .toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .replace(',', '');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const NewsDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { newsId?: string } | undefined;
  const newsId = params?.newsId || '';
  const { roles } = useAuth();
  const isCoachOrAdmin = (roles ?? []).some((r) => COACH_ADMIN_ROLES.includes(r.toLowerCase()));

  const [news, setNews] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNewsById(newsId);
      setNews(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudo cargar la noticia');
    } finally {
      setLoading(false);
    }
  }, [newsId]);

  useEffect(() => {
    if (newsId) fetchDetail();
  }, [newsId, fetchDetail]);

  const handleDelete = () => {
    Alert.alert('Eliminar noticia', '¿Seguro que quieres eliminar esta noticia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNews(newsId);
            navigation.goBack();
          } catch (e: any) {
            setError(e.response?.data?.detail || 'No se pudo eliminar la noticia');
          }
        },
      },
    ]);
  };

  const actions: ScreenHeaderAction[] | undefined = isCoachOrAdmin
    ? [
        {
          key: 'edit',
          icon: 'create-outline',
          label: 'Editar',
          testID: 'edit-button',
          onPress: () => navigation.navigate('NewsForm', { mode: 'edit', newsId }),
        },
        {
          key: 'delete',
          icon: 'trash-outline',
          label: 'Eliminar',
          testID: 'delete-button',
          onPress: handleDelete,
        },
      ]
    : undefined;

  const renderHeader = () => <ScreenHeader title="Noticia" actions={actions} />;

  if (loading) {
    return (
      <View testID="news-detail-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View testID="news-detail-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchDetail}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!news) {
    return (
      <View testID="news-detail-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay información disponible</Text>
        </View>
      </View>
    );
  }

  const coverUri = resolvePhotoUrl(news.coverImageUrl, API_BASE_URL);

  return (
    <View testID="news-detail-container" style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {coverUri && <Image testID="news-detail-cover" source={{ uri: coverUri }} style={styles.cover} />}
        <Text testID="news-detail-title" style={styles.title}>{news.title}</Text>
        <Text testID="news-detail-subtitle" style={styles.subtitle}>{news.subtitle}</Text>
        <Text style={styles.dateRow}>
          <Text testID="news-detail-date-label" style={styles.dateLabel}>{'Fecha de publicación: '}</Text>
          <Text testID="news-detail-date-value" style={styles.date}>{formatPublishDate(news.publishedAt)}</Text>
        </Text>
        <Text style={styles.dateRow}>
          <Text testID="news-detail-newsdate-label" style={styles.dateLabel}>{'Fecha de la noticia: '}</Text>
          <Text testID="news-detail-newsdate-value" style={styles.date}>{formatNewsDate(news.newsDate)}</Text>
        </Text>
        <Text testID="news-detail-body" style={styles.body}>{news.body}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: coachColors.background },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { paddingBottom: 32 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: coachColors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: coachColors.textSecondary, marginBottom: 6 },
  dateRow: { marginBottom: 16 },
  dateLabel: { fontSize: 12, color: coachColors.primary, fontWeight: '600' },
  date: { fontSize: 12, color: coachColors.textSecondary, textTransform: 'capitalize' },
  body: { fontSize: 15, color: coachColors.textPrimary, lineHeight: 22 },
  errorText: { color: coachColors.error, fontSize: 16, marginBottom: 20, textAlign: 'center' },
  retryButton: { backgroundColor: coachColors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  retryButtonText: { color: coachColors.contrastText, fontWeight: '600' },
  emptyText: { fontSize: 16, color: coachColors.textSecondary, textAlign: 'center' },
});

export default NewsDetailScreen;
