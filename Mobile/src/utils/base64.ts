const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const encodeBase64 = (bytes: Uint8Array): string => {
  let result = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    result += ALPHABET[b0 >> 2];
    result += ALPHABET[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? '=' : ALPHABET[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? '=' : ALPHABET[b2 & 0x3f];
  }

  return result;
};
