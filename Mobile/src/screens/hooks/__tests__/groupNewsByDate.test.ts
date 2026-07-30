import { groupNewsByDate } from '../groupNewsByDate';

interface NewsLike {
  id: string;
  newsDate: string;
}

const TODAY = new Date(2026, 6, 30); // 2026-07-30 (month is 0-indexed)

function item(id: string, newsDate: string): NewsLike {
  return { id, newsDate };
}

describe('groupNewsByDate', () => {
  it('puts an item with newsDate equal to today into the "today" subgroup titled "Hoy"', () => {
    const items = [item('a', '2026-07-30T10:00:00Z')];

    const groups = groupNewsByDate(items, TODAY);

    const currentFuture = groups.find((g) => g.key === 'current-future');
    expect(currentFuture).toBeTruthy();
    expect(currentFuture!.subgroups[0].key).toBe('today');
    expect(currentFuture!.subgroups[0].title).toBe('Hoy');
    expect(currentFuture!.subgroups[0].data.map((i) => i.id)).toEqual(['a']);
  });

  it('orders "Hoy" subgroup before other current/future month subgroups', () => {
    const items = [item('future', '2026-09-01'), item('today', '2026-07-30')];

    const groups = groupNewsByDate(items, TODAY);
    const currentFuture = groups.find((g) => g.key === 'current-future')!;

    expect(currentFuture.subgroups[0].key).toBe('today');
    expect(currentFuture.subgroups[1].key).toBe('2026-09');
  });

  it('sorts current/future month subgroups ascending', () => {
    const items = [item('sep', '2026-09-05'), item('aug', '2026-08-05')];

    const groups = groupNewsByDate(items, TODAY);
    const currentFuture = groups.find((g) => g.key === 'current-future')!;

    expect(currentFuture.subgroups.map((s) => s.key)).toEqual(['2026-08', '2026-09']);
  });

  it('sorts items ascending by newsDate within a current/future month subgroup', () => {
    const items = [item('later', '2026-09-20'), item('earlier', '2026-09-05')];

    const groups = groupNewsByDate(items, TODAY);
    const currentFuture = groups.find((g) => g.key === 'current-future')!;
    const septemberSubgroup = currentFuture.subgroups.find((s) => s.key === '2026-09')!;

    expect(septemberSubgroup.data.map((i) => i.id)).toEqual(['earlier', 'later']);
  });

  it('groups past items under the "past" root titled "Anteriores", months sorted descending', () => {
    const items = [item('june', '2026-06-10'), item('july', '2026-07-10')];

    const groups = groupNewsByDate(items, TODAY);
    const past = groups.find((g) => g.key === 'past')!;

    expect(past.title).toBe('Anteriores');
    expect(past.subgroups.map((s) => s.key)).toEqual(['2026-07', '2026-06']);
  });

  it('sorts items descending (closest-to-today first) within a past month subgroup', () => {
    const items = [item('early', '2026-07-01'), item('late', '2026-07-20')];

    const groups = groupNewsByDate(items, TODAY);
    const past = groups.find((g) => g.key === 'past')!;
    const julySubgroup = past.subgroups.find((s) => s.key === '2026-07')!;

    expect(julySubgroup.data.map((i) => i.id)).toEqual(['late', 'early']);
  });

  it('omits the "past" root group entirely when there are no past items', () => {
    const items = [item('today', '2026-07-30')];

    const groups = groupNewsByDate(items, TODAY);

    expect(groups.find((g) => g.key === 'past')).toBeUndefined();
  });

  it('omits the "current-future" root group entirely when there are no current/future items', () => {
    const items = [item('past', '2026-06-10')];

    const groups = groupNewsByDate(items, TODAY);

    expect(groups.find((g) => g.key === 'current-future')).toBeUndefined();
  });

  it('omits the "today" subgroup when no item has newsDate equal to today', () => {
    const items = [item('future', '2026-09-01')];

    const groups = groupNewsByDate(items, TODAY);
    const currentFuture = groups.find((g) => g.key === 'current-future')!;

    expect(currentFuture.subgroups.find((s) => s.key === 'today')).toBeUndefined();
  });

  it('returns an empty array when there are no items', () => {
    expect(groupNewsByDate([], TODAY)).toEqual([]);
  });

  it('formats month subgroup titles in Spanish, capitalized', () => {
    const items = [item('sep', '2026-09-05')];

    const groups = groupNewsByDate(items, TODAY);
    const currentFuture = groups.find((g) => g.key === 'current-future')!;
    const septemberSubgroup = currentFuture.subgroups.find((s) => s.key === '2026-09')!;

    expect(septemberSubgroup.title).toBe('Septiembre 2026');
  });

  it('defaults "today" to the current system date when not provided', () => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const items = [item('now', nowIso)];

    const groups = groupNewsByDate(items);
    const currentFuture = groups.find((g) => g.key === 'current-future')!;

    expect(currentFuture.subgroups[0].key).toBe('today');
  });
});
