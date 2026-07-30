import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewsScreen from '../NewsScreen';
import { getNews, getNewsDrafts } from '../../api/news';
import { useAuth } from '../../auth/AuthContext';

jest.mock('../../api/news');
jest.mock('../../auth/AuthContext');

const mockNavigationNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigationNavigate }),
}));

const mockGetNews = getNews as jest.Mock;
const mockGetNewsDrafts = getNewsDrafts as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const publishedItem = {
  id: 'news1',
  title: 'Published Title',
  subtitle: 'Published Subtitle',
  coverImageUrl: 'https://example.com/cover.jpg',
  status: 'Published' as const,
  publishedAt: '2026-01-01T00:00:00Z',
};

const draftItem = {
  id: 'draft1',
  title: 'Draft Title',
  subtitle: 'Draft Subtitle',
  coverImageUrl: 'https://example.com/draft-cover.jpg',
  status: 'Draft' as const,
  publishedAt: null,
};

describe('NewsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationNavigate.mockClear();
  });

  it('shows a loading indicator before data resolves', async () => {
    mockGetNews.mockReturnValue(new Promise(() => {}));
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { getByTestId } = await render(<NewsScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('calls only getNews for non-coach roles', async () => {
    mockGetNews.mockResolvedValue({ items: [publishedItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    await render(<NewsScreen />);

    await waitFor(() => {
      expect(mockGetNews).toHaveBeenCalledWith(1, 20);
      expect(mockGetNewsDrafts).not.toHaveBeenCalled();
    });
  });

  it('calls getNews and getNewsDrafts for Coach roles', async () => {
    mockGetNews.mockResolvedValue({ items: [publishedItem], totalCount: 1 });
    mockGetNewsDrafts.mockResolvedValue({ items: [draftItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });

    const { getAllByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      const cards = getAllByTestId(/^news-card-/);
      expect(cards.length).toBe(2);
    });
  });

  it('shows draft badge for draft items', async () => {
    mockGetNews.mockResolvedValue({ items: [], totalCount: 0 });
    mockGetNewsDrafts.mockResolvedValue({ items: [draftItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });

    const { getByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(getByTestId(`news-draft-badge-${draftItem.id}`)).toBeTruthy();
    });
  });

  it('shows empty state when no items', async () => {
    mockGetNews.mockResolvedValue({ items: [], totalCount: 0 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { findByTestId } = await render(<NewsScreen />);

    const emptyMessage = await findByTestId('empty-message');
    expect(emptyMessage.props.children).toBe('No hay noticias todavía');
  });

  it('shows error message on fetch failure', async () => {
    mockGetNews.mockRejectedValueOnce({ response: { data: { detail: 'Error del servidor' } } });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { findByTestId } = await render(<NewsScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Error del servidor');
  });

  it('shows fallback error message when detail is missing', async () => {
    mockGetNews.mockRejectedValueOnce(new Error('Unknown error'));
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { findByTestId } = await render(<NewsScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('No se pudieron cargar las noticias');
  });

  it('soft-fails drafts fetch for Coach', async () => {
    mockGetNews.mockResolvedValue({ items: [publishedItem], totalCount: 1 });
    mockGetNewsDrafts.mockRejectedValue(new Error('Forbidden'));
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });

    const { queryByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(queryByTestId('error-message')).toBeNull();
    });
  });

  it('renders FAB only for Coach/Administrator roles', async () => {
    mockGetNews.mockResolvedValue({ items: [], totalCount: 0 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { queryByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(queryByTestId('news-fab')).toBeNull();
    });
  });

  it('navigates to NewsDetail on card press', async () => {
    mockGetNews.mockResolvedValue({ items: [publishedItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { getByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      const card = getByTestId(`news-card-${publishedItem.id}`);
      fireEvent.press(card);
    });

    expect(mockNavigationNavigate).toHaveBeenCalledWith('NewsDetail', { newsId: publishedItem.id });
  });

  it('navigates to NewsForm create on FAB press', async () => {
    mockGetNews.mockResolvedValue({ items: [], totalCount: 0 });
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });

    const { getByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      const fab = getByTestId('news-fab');
      fireEvent.press(fab);
    });

    expect(mockNavigationNavigate).toHaveBeenCalledWith('NewsForm', { mode: 'create' });
  });
});
