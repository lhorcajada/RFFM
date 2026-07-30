import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewsFormScreen from '../NewsFormScreen';
import { getNewsById, uploadNewsImage, createNews, updateNews } from '../../api/news';
import * as ImagePicker from 'expo-image-picker';

jest.mock('../../api/news');
jest.mock('expo-image-picker');

const mockReplace = jest.fn();
let mockRouteParams = { mode: 'create' as const };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: mockReplace }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockGetNewsById = getNewsById as jest.Mock;
const mockUploadNewsImage = uploadNewsImage as jest.Mock;
const mockCreateNews = createNews as jest.Mock;
const mockUpdateNews = updateNews as jest.Mock;

const newsDetail = {
  id: 'news1',
  title: 'Existing Title',
  subtitle: 'Existing Subtitle',
  body: 'Existing Body',
  coverImageUrl: 'https://example.com/existing.jpg',
  status: 'Draft' as const,
  publishedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('NewsFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { mode: 'create' as const };
    // Set up default mock implementations for ImagePicker
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true, // Default: user cancels
    });
  });

  it('renders create mode with draft and publish buttons', async () => {
    const { queryByTestId } = await render(<NewsFormScreen />);

    await waitFor(() => {
      expect(queryByTestId('save-draft-button')).toBeTruthy();
      expect(queryByTestId('publish-button')).toBeTruthy();
      expect(queryByTestId('save-button')).toBeNull();
    });
  });

  it('validates that all fields are required', async () => {
    mockCreateNews.mockResolvedValue({ id: 'new-id' });

    const { getByTestId, findByTestId } = await render(<NewsFormScreen />);

    const submitButton = getByTestId('save-draft-button');
    await fireEvent.press(submitButton);

    const error = await findByTestId('error-message');
    expect(error.props.children).toContain('Completa el título');
  });

  it('edit mode preloads existing news data', async () => {
    mockRouteParams = { mode: 'edit', newsId: 'news1' };
    mockGetNewsById.mockResolvedValue(newsDetail);

    const { getByTestId, queryByTestId } = await render(<NewsFormScreen />);

    await waitFor(() => {
      const titleInput = getByTestId('title-input') as any;
      expect(titleInput.props.value).toBe('Existing Title');
    });

    expect(mockGetNewsById).toHaveBeenCalledWith('news1');
    expect(queryByTestId('save-button')).toBeTruthy();
  });

  it('edit mode calls updateNews without status key', async () => {
    mockRouteParams = { mode: 'edit', newsId: 'news1' };
    mockGetNewsById.mockResolvedValue(newsDetail);
    mockUpdateNews.mockResolvedValue(undefined);

    const { getByTestId } = await render(<NewsFormScreen />);

    await waitFor(() => {
      const titleInput = getByTestId('title-input') as any;
      expect(titleInput.props.value).toBe('Existing Title');
    });

    const saveButton = getByTestId('save-button');
    await fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateNews).toHaveBeenCalled();
      const callArgs = mockUpdateNews.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('status');
    });
  });

  it('uploads the picked photo and submits the remote URL, not the local uri', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///local/photo.jpg' }],
    });
    mockUploadNewsImage.mockResolvedValue({ url: 'https://cdn.example.com/uploaded.jpg' });
    mockCreateNews.mockResolvedValue({ id: 'new-id' });

    const { getByTestId, getByPlaceholderText } = await render(<NewsFormScreen />);

    await fireEvent.press(getByTestId('pick-image-button'));

    expect(mockUploadNewsImage).toHaveBeenCalledWith('file:///local/photo.jpg');
    expect(getByTestId('news-form-cover-preview')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('Título'), 'Título');
    await fireEvent.changeText(getByPlaceholderText('Entradilla'), 'Entradilla');
    await fireEvent.changeText(getByPlaceholderText('Cuerpo de la noticia'), 'Cuerpo');

    await fireEvent.press(getByTestId('publish-button'));

    expect(mockCreateNews).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageUrl: 'https://cdn.example.com/uploaded.jpg' }),
    );
    expect(mockReplace).toHaveBeenCalledWith('NewsDetail', { newsId: 'new-id' });
  });

  it('creates the news as Published when "Publicar" is pressed', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///local/photo.jpg' }],
    });
    mockUploadNewsImage.mockResolvedValue({ url: 'https://cdn.example.com/uploaded.jpg' });
    mockCreateNews.mockResolvedValue({ id: 'new-id' });

    const { getByTestId, getByPlaceholderText } = await render(<NewsFormScreen />);

    await fireEvent.press(getByTestId('pick-image-button'));

    await fireEvent.changeText(getByPlaceholderText('Título'), 'Título');
    await fireEvent.changeText(getByPlaceholderText('Entradilla'), 'Entradilla');
    await fireEvent.changeText(getByPlaceholderText('Cuerpo de la noticia'), 'Cuerpo');

    await fireEvent.press(getByTestId('publish-button'));

    expect(mockCreateNews).toHaveBeenCalledWith(expect.objectContaining({ status: 'Published' }));
    expect(mockReplace).toHaveBeenCalledWith('NewsDetail', { newsId: 'new-id' });
  });

  it('creates the news as Draft when "Guardar borrador" is pressed', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///local/photo.jpg' }],
    });
    mockUploadNewsImage.mockResolvedValue({ url: 'https://cdn.example.com/uploaded.jpg' });
    mockCreateNews.mockResolvedValue({ id: 'new-id' });

    const { getByTestId, getByPlaceholderText } = await render(<NewsFormScreen />);

    await fireEvent.press(getByTestId('pick-image-button'));

    await fireEvent.changeText(getByPlaceholderText('Título'), 'Título');
    await fireEvent.changeText(getByPlaceholderText('Entradilla'), 'Entradilla');
    await fireEvent.changeText(getByPlaceholderText('Cuerpo de la noticia'), 'Cuerpo');

    await fireEvent.press(getByTestId('save-draft-button'));

    expect(mockCreateNews).toHaveBeenCalledWith(expect.objectContaining({ status: 'Draft' }));
    expect(mockReplace).toHaveBeenCalledWith('NewsDetail', { newsId: 'new-id' });
  });

  it('shows a Spanish fallback error when saving fails and does not navigate away', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///local/photo.jpg' }],
    });
    mockUploadNewsImage.mockResolvedValue({ url: 'https://cdn.example.com/uploaded.jpg' });
    mockCreateNews.mockRejectedValue({ response: { data: {} } });

    const { getByTestId, getByPlaceholderText, findByTestId } = await render(<NewsFormScreen />);

    await fireEvent.press(getByTestId('pick-image-button'));

    await fireEvent.changeText(getByPlaceholderText('Título'), 'Título');
    await fireEvent.changeText(getByPlaceholderText('Entradilla'), 'Entradilla');
    await fireEvent.changeText(getByPlaceholderText('Cuerpo de la noticia'), 'Cuerpo');

    await fireEvent.press(getByTestId('publish-button'));

    const error = await findByTestId('error-message');
    expect(error.props.children).toBe('No se pudo guardar la noticia');
    expect(mockReplace).not.toHaveBeenCalled();
  });

});
