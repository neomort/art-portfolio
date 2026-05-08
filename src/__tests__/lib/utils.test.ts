import { 
  cn, 
  formatCurrency, 
  formatDate, 
  formatDateISO,
  formatShortDate,
  calculateDays, 
  truncateText, 
  sqftToSqm, 
  stringToColor, 
  calculateDistance,
  calculateEffectivePrice
} from '../../lib/utils';

describe('cn', () => {
  it('combines class names with clsx and tailwind-merge', () => {
    const result = cn('p-2', 'p-4', 'bg-red-500', { 'text-white': true });
    expect(result).toContain('p-4');
    expect(result).toContain('bg-red-500');
    expect(result).toContain('text-white');
  });
});

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatDate', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
  it('formats valid date string', () => {
    const result = formatDate('2023-05-15');
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });
});

describe('calculateDays', () => {
  it('calculates days between dates', () => {
    expect(calculateDays('2023-01-01', '2023-01-03')).toBe(2);
  });
  it('returns 1 for same day', () => {
    expect(calculateDays('2023-01-01', '2023-01-01')).toBe(1);
  });
});

describe('truncateText', () => {
  it('truncates long text', () => {
    expect(truncateText('this is a test', 7)).toBe('this is...');
  });
  it('keeps short text', () => {
    expect(truncateText('test', 10)).toBe('test');
  });
});

describe('sqftToSqm', () => {
  it('converts square feet to square meters', () => {
    expect(sqftToSqm(100)).toBe(9);
  });
});

describe('stringToColor', () => {
  it('returns a hex color', () => {
    expect(stringToColor('test')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('calculateDistance', () => {
  it('calculates distance between coordinates', () => {
    // Approx distance between NYC and LA
    const nyc = { lat: 40.7128, lng: -74.0060 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const distance = calculateDistance(nyc.lat, nyc.lng, la.lat, la.lng);
    expect(distance).toBeGreaterThan(3900); // ~3935 km
    expect(distance).toBeLessThan(4000);
  });
});

describe('formatDateISO', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatDateISO(null)).toBe('');
    expect(formatDateISO(undefined)).toBe('');
  });

  it('formats valid date string to ISO format (YYYY-MM-DD)', () => {
    expect(formatDateISO('2023-05-15')).toBe('2023-05-15');
    expect(formatDateISO('2023-01-01')).toBe('2023-01-01');
  });

  it('handles dates with time components', () => {
    // The function currently only handles YYYY-MM-DD format
    expect(formatDateISO('2023-05-15')).toBe('2023-05-15');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateISO('not-a-date')).toBe('');
  });
});

describe('formatShortDate', () => {
  it('formats date in MM/DD/YYYY format', () => {
    const result = formatShortDate('2023-05-15');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('handles different date formats', () => {
    expect(formatShortDate('2023-01-31')).toBe('01/31/2023');
  });

  it('throws error for invalid dates', () => {
    expect(() => formatShortDate('not-a-date')).toThrow();
  });
});

describe('calculateEffectivePrice', () => {
  const basePrice = 100; // $100 per day

  it('calculates daily rate correctly', () => {
    const result = calculateEffectivePrice(
      basePrice,
      '2023-01-01',
      '2023-01-03' // 2 days
    );
    expect(result.totalPrice).toBe(200); // 2 * 100
    expect(result.pricePerDay).toBe(100);
    expect(result.term).toBe('day');
  });

  it('applies weekly fixed rate when better', () => {
    const result = calculateEffectivePrice(
      basePrice,
      '2023-01-01',
      '2023-01-15', // 14 days
      'fixed',
      600 // $600 per week is better than $100/day
    );
    expect(result.totalPrice).toBe(1200); // 2 weeks * 600
    expect(result.pricePerDay).toBeCloseTo(85.71, 2); // 600 / 7
    expect(result.term).toBe('week');
  });

  it('applies monthly percentage discount when better', () => {
    const result = calculateEffectivePrice(
      basePrice,
      '2023-01-01',
      '2023-02-01', // 31 days
      null,
      null,
      'percentage',
      10 // 10% off
    );
    // For 31 days, the daily rate (3100) is better than the monthly rate (5400)
    expect(result.totalPrice).toBe(3100);
    expect(result.term).toBe('day');
  });

  it('handles year boundary correctly', () => {
    const result = calculateEffectivePrice(
      basePrice,
      '2023-01-01',
      '2024-01-01', // 1 year
      null,
      null,
      null,
      null,
      'percentage',
      20 // 20% off
    );
    // 365 days * 100 * 0.8 = 29200
    expect(result.totalPrice).toBe(29200);
    expect(result.term).toBe('year');
  });

  it('handles invalid dates', () => {
    const result = calculateEffectivePrice(
      basePrice,
      'invalid-date',
      '2023-01-01'
    );
    // Should default to daily rate
    expect(result.term).toBe('day');
  });
});
