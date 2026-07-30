import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TeamRulesScreen from '../TeamRulesScreen';
import { getTeamRulesDocument, uploadTeamRulesDocument } from '../../api/teamRulesDocument';
import { preparePdfViewerAssets } from '../../pdfViewer/preparePdfViewer';
import { useAuth } from '../../auth/AuthContext';
import * as DocumentPicker from 'expo-document-picker';

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({ params: { teamId: 'team1' } })),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../../api/teamRulesDocument');
jest.mock('../../pdfViewer/preparePdfViewer');
jest.mock('../../auth/AuthContext');
jest.mock('expo-document-picker');

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: (props: any) =>
      React.createElement(View, {
        testID: 'rules-pdf-viewer',
        'data-uri': props.source?.uri,
        'data-origin-whitelist': JSON.stringify(props.originWhitelist),
      }),
  };
});

jest.mock('../../shared/components/ScreenHeader', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockScreenHeader({ title }: any) {
    return React.createElement(View, { testID: 'screen-header' }, React.createElement(Text, null, title));
  };
});

const mockGetTeamRulesDocument = getTeamRulesDocument as jest.Mock;
const mockUploadTeamRulesDocument = uploadTeamRulesDocument as jest.Mock;
const mockPreparePdfViewerAssets = preparePdfViewerAssets as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

describe('TeamRulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });
    mockPreparePdfViewerAssets.mockImplementation(
      async (localUri: string) => `file:///cache/pdfjs-viewer/viewer.html?file=${encodeURIComponent(localUri)}`,
    );
  });

  it('renders loading indicator while fetching the document', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    mockGetTeamRulesDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId } = await render(<TeamRulesScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
    resolveRequest(null);
  });

  it('shows "Aún no disponible" when no document exists', async () => {
    mockGetTeamRulesDocument.mockResolvedValue(null);

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('empty-message');
    expect(getByText('Aún no disponible')).toBeTruthy();
  });

  it('renders the PDF viewer when a document exists', async () => {
    mockGetTeamRulesDocument.mockResolvedValue({ localUri: 'file:///cache/rules.pdf' });

    const { findByTestId } = await render(<TeamRulesScreen />);

    const viewer = await findByTestId('rules-pdf-viewer');
    expect(viewer).toBeTruthy();
  });

  it('prepares the local PDF.js viewer and points the WebView at it instead of the raw PDF file', async () => {
    mockGetTeamRulesDocument.mockResolvedValue({ localUri: 'file:///cache/rules.pdf' });

    const { findByTestId } = await render(<TeamRulesScreen />);

    const viewer = await findByTestId('rules-pdf-viewer');
    expect(mockPreparePdfViewerAssets).toHaveBeenCalledWith('file:///cache/rules.pdf');
    expect(viewer.props['data-uri']).toBe(
      'file:///cache/pdfjs-viewer/viewer.html?file=file%3A%2F%2F%2Fcache%2Frules.pdf',
    );
  });

  it('shows an error message when preparing the local PDF.js viewer fails', async () => {
    mockGetTeamRulesDocument.mockResolvedValue({ localUri: 'file:///cache/rules.pdf' });
    mockPreparePdfViewerAssets.mockRejectedValue(new Error('disk full'));

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('error-message');
    expect(getByText('No se pudo cargar el documento')).toBeTruthy();
  });

  it('whitelists the file:// origin so the local PDF is not blocked by ERR_ACCESS_DENIED', async () => {
    mockGetTeamRulesDocument.mockResolvedValue({ localUri: 'file:///cache/rules.pdf' });

    const { findByTestId } = await render(<TeamRulesScreen />);

    const viewer = await findByTestId('rules-pdf-viewer');
    expect(viewer.props['data-origin-whitelist']).toBe(JSON.stringify(['*']));
  });

  it('shows an error message with a retry button when the fetch fails without backend detail', async () => {
    mockGetTeamRulesDocument.mockRejectedValue({ response: undefined });

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('error-message');
    expect(getByText('No se pudo cargar el documento')).toBeTruthy();
    expect(await findByTestId('retry-button')).toBeTruthy();
  });

  it('shows the backend-provided error detail when available', async () => {
    mockGetTeamRulesDocument.mockRejectedValue({ response: { data: { detail: 'Equipo no encontrado' } } });

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    await findByTestId('error-message');
    expect(getByText('Equipo no encontrado')).toBeTruthy();
  });

  it('does not show the upload control for Player/FamilyMember roles in the empty state', async () => {
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });
    mockGetTeamRulesDocument.mockResolvedValue(null);

    const { findByTestId, queryByTestId } = await render(<TeamRulesScreen />);

    await findByTestId('empty-message');
    expect(queryByTestId('upload-button')).toBeNull();
  });

  it('shows the upload control for Coach role in the empty state', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });
    mockGetTeamRulesDocument.mockResolvedValue(null);

    const { findByTestId } = await render(<TeamRulesScreen />);

    expect(await findByTestId('upload-button')).toBeTruthy();
  });

  it('shows the replace control for Administrator role when a document exists', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Administrator'] });
    mockGetTeamRulesDocument.mockResolvedValue({ localUri: 'file:///cache/rules.pdf' });

    const { findByTestId } = await render(<TeamRulesScreen />);

    expect(await findByTestId('replace-button')).toBeTruthy();
  });

  it('does not show the replace control for Player role when a document exists', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Player'] });
    mockGetTeamRulesDocument.mockResolvedValue({ localUri: 'file:///cache/rules.pdf' });

    const { findByTestId, queryByTestId } = await render(<TeamRulesScreen />);

    await findByTestId('rules-pdf-viewer');
    expect(queryByTestId('replace-button')).toBeNull();
  });

  it('rejects a non-PDF pick client-side without calling the upload API', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });
    mockGetTeamRulesDocument.mockResolvedValue(null);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/image.png', name: 'image.png', mimeType: 'image/png', size: 1024 }],
    });

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('upload-button'));

    await waitFor(() => expect(getByText('El archivo debe ser un PDF')).toBeTruthy());
    expect(mockUploadTeamRulesDocument).not.toHaveBeenCalled();
  });

  it('rejects a PDF larger than 20MB client-side without calling the upload API', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });
    mockGetTeamRulesDocument.mockResolvedValue(null);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked/rules.pdf',
          name: 'rules.pdf',
          mimeType: 'application/pdf',
          size: 21 * 1024 * 1024,
        },
      ],
    });

    const { findByTestId, getByText } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('upload-button'));

    await waitFor(() => expect(getByText('El archivo no puede superar los 20 MB')).toBeTruthy());
    expect(mockUploadTeamRulesDocument).not.toHaveBeenCalled();
  });

  it('uploads a valid PDF pick and refreshes the displayed document', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });
    mockGetTeamRulesDocument
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ localUri: 'file:///cache/rules-new.pdf' });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked/rules.pdf',
          name: 'rules.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      ],
    });
    mockUploadTeamRulesDocument.mockResolvedValue({ url: 'https://storage/rules.pdf', uploadedAt: '2026-07-30T10:00:00Z' });

    const { findByTestId } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('upload-button'));

    await waitFor(() => expect(mockUploadTeamRulesDocument).toHaveBeenCalledWith('team1', 'file:///picked/rules.pdf', 'rules.pdf'));
    expect(await findByTestId('rules-pdf-viewer')).toBeTruthy();
  });

  it('does nothing when the document picker is canceled', async () => {
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });
    mockGetTeamRulesDocument.mockResolvedValue(null);
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    const { findByTestId } = await render(<TeamRulesScreen />);

    fireEvent.press(await findByTestId('upload-button'));

    await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
    expect(mockUploadTeamRulesDocument).not.toHaveBeenCalled();
  });
});
