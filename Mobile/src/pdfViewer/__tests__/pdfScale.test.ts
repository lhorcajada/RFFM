import { computeDisplaySize, computeRenderScale } from '../pdfScale';

describe('computeRenderScale', () => {
  it('scales the page to fit the viewport width at devicePixelRatio 1', () => {
    expect(computeRenderScale(400, 200, 1)).toBe(2);
  });

  it('multiplies the fit-to-width scale by devicePixelRatio for a sharp backing buffer', () => {
    expect(computeRenderScale(400, 200, 3)).toBe(6);
  });

  it('falls back to devicePixelRatio when the viewport width is not known yet', () => {
    expect(computeRenderScale(0, 200, 2)).toBe(2);
  });

  it('falls back to devicePixelRatio when the page width at scale 1 is zero', () => {
    expect(computeRenderScale(400, 0, 2)).toBe(2);
  });

  it('treats a missing/zero devicePixelRatio as 1', () => {
    expect(computeRenderScale(400, 200, 0)).toBe(2);
  });
});

describe('computeDisplaySize', () => {
  it('divides the rendered size back down by devicePixelRatio', () => {
    expect(computeDisplaySize(1200, 1800, 3)).toEqual({ width: 400, height: 600 });
  });

  it('treats a missing/zero devicePixelRatio as 1', () => {
    expect(computeDisplaySize(400, 600, 0)).toEqual({ width: 400, height: 600 });
  });
});
