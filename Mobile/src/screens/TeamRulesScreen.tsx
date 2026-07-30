import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import { getTeamRulesDocument, uploadTeamRulesDocument } from '../api/teamRulesDocument';
import { preparePdfViewerAssets } from '../pdfViewer/preparePdfViewer';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';
import ScreenHeader from '../shared/components/ScreenHeader';

const COACH_ADMIN_ROLES = ['coach', 'administrator'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const TeamRulesScreen = () => {
  const route = useRoute();
  const params = route.params as { teamId?: string } | undefined;
  const teamId = params?.teamId || '';
  const { roles } = useAuth();
  const isCoachOrAdmin = (roles ?? []).some((r) => COACH_ADMIN_ROLES.includes(r.toLowerCase()));

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getTeamRulesDocument(teamId);
      if (!result) {
        setLocalUri(null);
        setViewerUri(null);
        return;
      }
      setLocalUri(result.localUri);
      setViewerUri(await preparePdfViewerAssets(result.localUri));
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudo cargar el documento');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId) {
      fetchDocument();
    }
  }, [teamId, fetchDocument]);

  const handleUpload = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];

    if (asset.mimeType !== 'application/pdf') {
      setError('El archivo debe ser un PDF');
      return;
    }

    if ((asset.size ?? 0) > MAX_FILE_SIZE_BYTES) {
      setError('El archivo no puede superar los 20 MB');
      return;
    }

    try {
      setUploading(true);
      await uploadTeamRulesDocument(teamId, asset.uri, asset.name);
      await fetchDocument();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'No se pudo subir el documento');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Normas del equipo" />
        <View style={styles.centeredContent}>
          <ActivityIndicator testID="loading-indicator" size="large" color={coachColors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Normas del equipo" />
        <View style={styles.centeredContent}>
          <Text testID="error-message" style={styles.errorText}>
            {error}
          </Text>
          <Pressable testID="retry-button" style={styles.retryButton} onPress={fetchDocument}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!localUri) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Normas del equipo" />
        <View style={styles.centeredContent}>
          <Text testID="empty-message" style={styles.emptyText}>
            Aún no disponible
          </Text>
          {isCoachOrAdmin && (
            <Pressable
              testID="upload-button"
              style={styles.uploadButton}
              onPress={handleUpload}
              disabled={uploading}
            >
              <Text style={styles.uploadButtonText}>
                {uploading ? 'Subiendo...' : 'Subir documento'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Normas del equipo" />
      <View style={styles.viewerContainer}>
        <WebView
          testID="rules-pdf-viewer"
          source={{ uri: viewerUri ?? undefined }}
          style={styles.webview}
          originWhitelist={['*']}
          allowFileAccess
          allowUniversalAccessFromFileURLs
        />
      </View>
      {isCoachOrAdmin && (
        <Pressable
          testID="replace-button"
          style={styles.replaceButton}
          onPress={handleUpload}
          disabled={uploading}
        >
          <Text style={styles.uploadButtonText}>
            {uploading ? 'Subiendo...' : 'Reemplazar documento'}
          </Text>
        </Pressable>
      )}
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
  viewerContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: coachColors.surface,
  },
  webview: {
    flex: 1,
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
  uploadButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: coachColors.primary,
    borderRadius: 8,
    alignSelf: 'center',
  },
  replaceButton: {
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: coachColors.primary,
    borderRadius: 8,
    alignSelf: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default TeamRulesScreen;
