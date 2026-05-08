import { formatDateISO, formatShortDate, calculateEffectivePrice } from '../../lib/utils';

describe('formatDateISO', () => {
  it('formats date to YYYY-MM-DD', () => {
    expect(formatDateISO('2023-05-15')).toBe('2023-05-15');
  });
  it('returns empty for invalid date', () => {
    expect(formatDateISO('invalid')).toBe('');
  });
});

describe('formatShortDate', () => {
  it('formats date in MM/DD/YYYY', () => {
    const result = formatShortDate('2023-05-15');
    expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});

describe('calculateEffectivePrice', () => {
  it('uses daily rate by default', () => {
    const result = calculateEffectivePrice(100, '2023-01-01', '2023-01-08');
    expect(result.totalPrice).toBe(700); // 7 days * $100
    expect(result.term).toBe('day');
  });

  it('applies weekly rate when better', () => {
    const result = calculateEffectivePrice(
      100, // $100/day
      '2023-01-01',
      '2023-01-08', // 7 days
      'percentage', // weekly rate type
      10, // 10% off weekly
      undefined,
      undefined,
      undefined,
      undefined
    );
    // 7 * 100 * 0.9 = $630 (10% off weekly)
    expect(result.totalPrice).toBe(630);
    expect(result.term).toBe('week');
  });

  it('applies fixed weekly rate', () => {
    const result = calculateEffectivePrice(
      100, // $100/day
      '2023-01-01',
      '2023-01-08', // 7 days
      'fixed', // fixed weekly rate
      600, // $600/week
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result.totalPrice).toBe(600);
    expect(result.term).toBe('week');
  });

  it('applies monthly rate when better', () => {
    const result = calculateEffectivePrice(
      100, // $100/day
      '2023-01-01',
      '2023-01-30', // 29 days
      undefined,
      undefined,
      'percentage', // monthly rate type
      15, // 15% off monthly
      undefined,
      undefined
    );
    // 30 * 100 * 0.85 = $2550 (15% off monthly)
    expect(result.totalPrice).toBe(2550);
    expect(result.term).toBe('month');
  });

  it('applies fixed monthly rate', () => {
    const result = calculateEffectivePrice(
      100, // $100/day
      '2023-01-01',
      '2023-01-31', // 30 days
      undefined,
      undefined,
      'fixed', // fixed monthly rate
      2500, // $2500/month
      undefined,
      undefined
    );
    expect(result.totalPrice).toBe(2500);
    expect(result.term).toBe('month');
  });

  it('applies yearly rate when best', () => {
    const result = calculateEffectivePrice(
      100, // $100/day
      '2023-01-01',
      '2023-12-31', // ~1 year
      'percentage',
      10, // 10% off weekly
      'percentage',
      15, // 15% off monthly
      'percentage',
      20 // 20% off yearly
    );
    // 365 * 100 * 0.8 = $29,200 (20% off yearly)
    expect(result.term).toBe('year');
    expect(result.totalPrice).toBeLessThan(30000);
  });
});
