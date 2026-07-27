import { coachColors } from '../colors';

describe('coachColors', () => {
  it('matches the Coach web theme values (Front/src/apps/coach/muiCoachTheme.ts)', () => {
    expect(coachColors.background).toBe('#07071a');
    expect(coachColors.surface).toBe('#1c1c30');
    expect(coachColors.surfaceAlt).toBe('#252545');
    expect(coachColors.primary).toBe('#4d9de0');
    expect(coachColors.primaryLight).toBe('#7ab8f5');
    expect(coachColors.secondary).toBe('#4ec9b0');
    expect(coachColors.textPrimary).toBe('#e8e8e8');
    expect(coachColors.textSecondary).toBe('rgba(255,255,255,0.55)');
    expect(coachColors.border).toBe('rgba(255,255,255,0.08)');
    expect(coachColors.error).toBe('#ff9b9b');
    expect(coachColors.accentOrange).toBe('#ff9800');
    expect(coachColors.contrastText).toBe('#0d0d1f');
  });

  it('exposes exactly the 12 documented tokens (no drift)', () => {
    expect(Object.keys(coachColors).sort()).toEqual(
      [
        'background',
        'surface',
        'surfaceAlt',
        'primary',
        'primaryLight',
        'secondary',
        'textPrimary',
        'textSecondary',
        'border',
        'error',
        'accentOrange',
        'contrastText',
      ].sort(),
    );
  });
});
