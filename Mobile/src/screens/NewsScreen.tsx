import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { coachColors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { getNews, getNewsDrafts, NewsSummary } from '../api/news';
import { API_BASE_URL } from '../api/client';
import { resolvePhotoUrl } from '../utils/resolvePhotoUrl';
import ScreenHeader from '../shared/components/ScreenHeader';

const PAGE_SIZE = 20;
const COACH_ADMIN_ROLES = ['coach', 'administrator'];

interface FeedItem extends NewsSummary {
  isDraft: boolean;
}

const NewsScreen = () => {
  const navigation = useNavigation<any>();
  const { roles } = useAuth();
  const isCoachOrAdmin = (roles ?? []).some((r) => COACH_ADMIN_ROLES.includes(r.toLowerCase()));

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const publishedResultPromise = getNews(1, PAGE_SIZE);
      const draftsResultPromise = isCoachOrAdmin
        ? getNewsDrafts(1, PAGE_SIZE).catch(() => null)
        : Promise.resolve(null);

      const [publishedResult, draftsResult] = await Promise.all([
        publishedResultPromise,
        draftsResultPromise,
      ]);

      const drafts: FeedItem[] = draftsResult
        ? draftsResult.items.map((item) => ({ ...item, isDraft: true }))
        : [];
      const published: FeedItem[] = publishedResult.items.map((item) => ({ ...item, isDraft: false }));

      setItems([...drafts, ...published]);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las noticias');
    } finally {
      setLoading(false);
    }
  }, [isCoachOrAdmin]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const renderHeader = () => <ScreenHeader title="Noticias" showBack={false} />;

  if (loading) {
    return (
      <View testID="news-screen-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View testID="news-screen-container" style={styles.container}>
        {renderHeader()}
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>{error}</Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchFeed}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View testID="news-screen-container" style={styles.container}>
      {renderHeader()}
      {items.length === 0 ? (
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>No hay noticias todavía</Text>
        </View>
      ) : (
        <FlatList
          testID="news-feed-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const coverUri = resolvePhotoUrl(item.coverImageUrl, API_BASE_URL);
            return (
              <Pressable
                testID={`news-card-${item.id}`}
                style={styles.card}
                onPress={() => navigation.navigate('NewsDetail', { newsId: item.id })}
              >
                {coverUri ? (
                  <Image testID={`news-cover-${item.id}`} source={{ uri: coverUri }} style={styles.cover} />
                ) : (
                  <View testID={`news-cover-placeholder-${item.id}`} style={styles.coverPlaceholder} />
                )}
                {item.isDraft && (
                  <View testID={`news-draft-badge-${item.id}`} style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>Borrador</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text testID={`news-title-${item.id}`} style={styles.headline} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.subtitleText} numberOfLines={2}>{item.subtitle}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {isCoachOrAdmin && (
        <Pressable
          testID="news-fab"
          style={styles.fab}
          onPress={() => navigation.navigate('NewsForm', { mode: 'create' })}
        >
          <Ionicons name="add-outline" size={28} color={coachColors.contrastText} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: coachColors.background },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 88 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: coachColors.surface,
    borderWidth: 1,
    borderColor: coachColors.border,
    marginBottom: 16,
  },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverPlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: coachColors.surfaceAlt },
  draftBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: coachColors.accentOrange,
  },
  draftBadgeText: { color: coachColors.contrastText, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  cardBody: { padding: 12, gap: 4 },
  headline: { fontSize: 18, fontWeight: '800', color: coachColors.textPrimary },
  subtitleText: { fontSize: 13, color: coachColors.textSecondary },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: coachColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  errorText: { color: coachColors.error, fontSize: 16, marginBottom: 20, textAlign: 'center' },
  retryButton: { backgroundColor: coachColors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  retryButtonText: { color: coachColors.contrastText, fontWeight: '600' },
  emptyText: { fontSize: 16, color: coachColors.textSecondary, textAlign: 'center' },
});

export default NewsScreen;
