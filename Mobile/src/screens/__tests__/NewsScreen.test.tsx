import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import NewsScreen from '../NewsScreen';
import { getNews, getNewsDrafts } from '../../api/news';
import { useAuth } from '../../auth/AuthContext';

jest.mock('../../api/news');
jest.mock('../../auth/AuthContext');

const mockNavigationNavigate = jest.fn();
let capturedFocusCallback: (() => void) | null = null;
jest.mock('@react-navigation/native', () => {
  const actualReact = require('react');
  return {
    useNavigation: () => ({ navigate: mockNavigationNavigate }),
    useFocusEffect: (cb: () => void) => {
      capturedFocusCallback = cb;
      actualReact.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

const mockGetNews = getNews as jest.Mock;
const mockGetNewsDrafts = getNewsDrafts as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

function isoDaysFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

const todayIso = isoDaysFromToday(0);
const futureIso = isoDaysFromToday(60); // ~2 months ahead, guaranteed different month bucket than today
const pastIso = isoDaysFromToday(-60); // ~2 months in the past

const publishedItem = {
  id: 'news1',
  title: 'Published Title',
  subtitle: 'Published Subtitle',
  coverImageUrl: 'https://example.com/cover.jpg',
  status: 'Published' as const,
  publishedAt: '2026-01-01T00:00:00Z',
  newsDate: todayIso,
};

const futureItem = {
  id: 'news2',
  title: 'Future Title',
  subtitle: 'Future Subtitle',
  coverImageUrl: 'https://example.com/future-cover.jpg',
  status: 'Published' as const,
  publishedAt: '2026-01-01T00:00:00Z',
  newsDate: futureIso,
};

const pastItem = {
  id: 'news3',
  title: 'Past Title',
  subtitle: 'Past Subtitle',
  coverImageUrl: 'https://example.com/past-cover.jpg',
  status: 'Published' as const,
  publishedAt: '2026-01-01T00:00:00Z',
  newsDate: pastIso,
};

const draftItem = {
  id: 'draft1',
  title: 'Draft Title',
  subtitle: 'Draft Subtitle',
  coverImageUrl: 'https://example.com/draft-cover.jpg',
  status: 'Draft' as const,
  publishedAt: null,
  newsDate: futureIso,
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

    const { getByTestId, getAllByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(getByTestId('news-root-header-current-future')).toBeTruthy();
    });

    const monthKey = futureIso.slice(0, 7);
    await fireEvent.press(getByTestId(`news-sub-header-current-future-${monthKey}`));

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
      expect(getByTestId('news-root-header-current-future')).toBeTruthy();
    });

    const monthKey = futureIso.slice(0, 7);
    await fireEvent.press(getByTestId(`news-sub-header-current-future-${monthKey}`));

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

  it('renders the "Actuales y futuras" root group expanded by default with today\'s item visible', async () => {
    mockGetNews.mockResolvedValue({ items: [publishedItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { getByTestId, queryByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(getByTestId('news-root-header-current-future')).toBeTruthy();
      expect(getByTestId('news-sub-header-current-future-today')).toBeTruthy();
      expect(getByTestId(`news-card-${publishedItem.id}`)).toBeTruthy();
    });
    expect(queryByTestId('news-root-header-past')).toBeNull();
  });

  it('keeps a non-"Hoy" month subgroup collapsed by default within current/future', async () => {
    mockGetNews.mockResolvedValue({ items: [futureItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { getByTestId, queryByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(getByTestId('news-root-header-current-future')).toBeTruthy();
    });

    // The month sub-header is rendered, but the item itself should not be, since the
    // month subgroup is not the "today" one and starts collapsed.
    expect(queryByTestId(`news-card-${futureItem.id}`)).toBeNull();
  });

  it('shows the "Anteriores" root group collapsed by default; expanding it reveals its items', async () => {
    mockGetNews.mockResolvedValue({ items: [pastItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { getByTestId, queryByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(getByTestId('news-root-header-past')).toBeTruthy();
    });

    expect(queryByTestId(`news-card-${pastItem.id}`)).toBeNull();

    await fireEvent.press(getByTestId('news-root-header-past'));

    await waitFor(() => {
      // Root expanded reveals the month sub-header, but the month subgroup itself is
      // still collapsed, so the item is still not visible yet.
      expect(queryByTestId(`news-card-${pastItem.id}`)).toBeNull();
    });
  });

  it('toggling a collapsed month sub-header reveals its items', async () => {
    mockGetNews.mockResolvedValue({ items: [futureItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    const { getByTestId, queryByTestId } = await render(<NewsScreen />);

    let subHeaderTestId = '';
    await waitFor(() => {
      const found = queryByTestId(/^news-sub-header-current-future-/);
      expect(found).toBeTruthy();
    });

    const monthKey = futureIso.slice(0, 7);
    subHeaderTestId = `news-sub-header-current-future-${monthKey}`;

    expect(queryByTestId(`news-card-${futureItem.id}`)).toBeNull();

    await fireEvent.press(getByTestId(subHeaderTestId));

    await waitFor(() => {
      expect(getByTestId(`news-card-${futureItem.id}`)).toBeTruthy();
    });
  });

  it('refetches the feed when the screen regains focus', async () => {
    mockGetNews.mockResolvedValue({ items: [publishedItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['FamilyMember'] });

    await render(<NewsScreen />);

    await waitFor(() => {
      expect(mockGetNews).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      capturedFocusCallback?.();
    });

    await waitFor(() => {
      expect(mockGetNews).toHaveBeenCalledTimes(2);
    });
  });

  it('places a draft item within the group/subgroup matching its own news date', async () => {
    mockGetNews.mockResolvedValue({ items: [], totalCount: 0 });
    mockGetNewsDrafts.mockResolvedValue({ items: [draftItem], totalCount: 1 });
    mockUseAuth.mockReturnValue({ roles: ['Coach'] });

    const { getByTestId } = await render(<NewsScreen />);

    await waitFor(() => {
      expect(getByTestId('news-root-header-current-future')).toBeTruthy();
    });

    const monthKey = futureIso.slice(0, 7);
    await fireEvent.press(getByTestId(`news-sub-header-current-future-${monthKey}`));

    await waitFor(() => {
      expect(getByTestId(`news-card-${draftItem.id}`)).toBeTruthy();
      expect(getByTestId(`news-draft-badge-${draftItem.id}`)).toBeTruthy();
    });
  });
});
