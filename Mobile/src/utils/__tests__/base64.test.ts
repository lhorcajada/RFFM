import { encodeBase64 } from '../base64';

const toBytes = (str: string) => new Uint8Array(str.split('').map((c) => c.charCodeAt(0)));

describe('encodeBase64', () => {
  it('encodes a 3-byte-aligned string', () => {
    expect(encodeBase64(toBytes('Man'))).toBe('TWFu');
  });

  it('pads with = for a 1-byte remainder', () => {
    expect(encodeBase64(toBytes('Ma'))).toBe('TWE=');
  });

  it('pads with == for a 2-byte remainder', () => {
    expect(encodeBase64(toBytes('M'))).toBe('TQ==');
  });

  it('returns an empty string for empty input', () => {
    expect(encodeBase64(new Uint8Array())).toBe('');
  });

  it('encodes a longer string spanning multiple chunks', () => {
    expect(encodeBase64(toBytes('Hello, World!'))).toBe('SGVsbG8sIFdvcmxkIQ==');
  });
});
