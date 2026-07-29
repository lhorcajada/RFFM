import { resolvePhotoUrl } from '../resolvePhotoUrl';

describe('resolvePhotoUrl', () => {
  it('returns null when given null', () => {
    expect(resolvePhotoUrl(null, 'https://api.example.com')).toBeNull();
  });

  it('returns null when given an empty string', () => {
    expect(resolvePhotoUrl('', 'https://api.example.com')).toBeNull();
  });

  it('returns absolute http(s) URLs unchanged', () => {
    expect(resolvePhotoUrl('https://cdn.supabase.co/players/abc.jpg', 'https://api.example.com'))
      .toBe('https://cdn.supabase.co/players/abc.jpg');
    expect(resolvePhotoUrl('http://cdn.example.com/photo.jpg', 'https://api.example.com'))
      .toBe('http://cdn.example.com/photo.jpg');
  });

  it('proxies a relative local-storage path through /api/public/storage', () => {
    expect(resolvePhotoUrl('players/club1/abc123.jpg', 'https://api.example.com'))
      .toBe('https://api.example.com/api/public/storage?url=players%2Fclub1%2Fabc123.jpg');
  });
});
