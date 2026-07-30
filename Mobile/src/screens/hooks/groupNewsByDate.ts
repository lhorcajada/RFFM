interface NewsDateLike {
  newsDate: string;
}

export interface NewsDateSubgroup<T> {
  key: string;
  title: string;
  data: T[];
}

export interface NewsDateRootGroup<T> {
  key: 'current-future' | 'past';
  title: string;
  subgroups: NewsDateSubgroup<T>[];
}

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

function parseDateParts(iso: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  const date = new Date(iso);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function dateNumber(parts: DateParts): number {
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function monthKey(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function monthTitle(parts: DateParts): string {
  const date = new Date(parts.year, parts.month - 1, 1);
  const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} ${parts.year}`;
}

function sortAscending<T extends NewsDateLike>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(a.newsDate).getTime() - new Date(b.newsDate).getTime());
}

function sortDescending<T extends NewsDateLike>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.newsDate).getTime() - new Date(a.newsDate).getTime());
}

function buildMonthSubgroups<T extends NewsDateLike>(
  items: T[],
  order: 'asc' | 'desc',
): NewsDateSubgroup<T>[] {
  const byMonth = new Map<string, { parts: DateParts; items: T[] }>();

  for (const item of items) {
    const parts = parseDateParts(item.newsDate);
    const key = monthKey(parts);
    const bucket = byMonth.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      byMonth.set(key, { parts, items: [item] });
    }
  }

  const buckets = [...byMonth.entries()].sort(([keyA], [keyB]) =>
    order === 'asc' ? keyA.localeCompare(keyB) : keyB.localeCompare(keyA),
  );

  return buckets.map(([key, bucket]) => ({
    key,
    title: monthTitle(bucket.parts),
    data: order === 'asc' ? sortAscending(bucket.items) : sortDescending(bucket.items),
  }));
}

export function groupNewsByDate<T extends NewsDateLike>(
  items: T[],
  today: Date = new Date(),
): NewsDateRootGroup<T>[] {
  const todayParts: DateParts = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  const todayNumber = dateNumber(todayParts);

  const currentFutureItems: T[] = [];
  const pastItems: T[] = [];

  for (const item of items) {
    const parts = parseDateParts(item.newsDate);
    if (dateNumber(parts) >= todayNumber) {
      currentFutureItems.push(item);
    } else {
      pastItems.push(item);
    }
  }

  const groups: NewsDateRootGroup<T>[] = [];

  if (currentFutureItems.length > 0) {
    const todayItems = currentFutureItems.filter((item) => dateNumber(parseDateParts(item.newsDate)) === todayNumber);
    const futureItems = currentFutureItems.filter((item) => dateNumber(parseDateParts(item.newsDate)) > todayNumber);

    const subgroups: NewsDateSubgroup<T>[] = [];
    if (todayItems.length > 0) {
      subgroups.push({ key: 'today', title: 'Hoy', data: sortAscending(todayItems) });
    }
    subgroups.push(...buildMonthSubgroups(futureItems, 'asc'));

    if (subgroups.length > 0) {
      groups.push({ key: 'current-future', title: 'Actuales y futuras', subgroups });
    }
  }

  if (pastItems.length > 0) {
    const subgroups = buildMonthSubgroups(pastItems, 'desc');
    if (subgroups.length > 0) {
      groups.push({ key: 'past', title: 'Anteriores', subgroups });
    }
  }

  return groups;
}
