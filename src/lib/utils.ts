import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combines tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Format date with error handling
export function formatDate(dateString: string | null | undefined, locale: string = 'en-US'): string {
  if (!dateString) {
    return '';
  }
  // Only append T00:00:00 if the string is exactly 10 characters (YYYY-MM-DD)
  const date =
    dateString.length === 10
      ? new Date(dateString + 'T00:00:00')  // This creates a local date at midnight
      : new Date(dateString);
  if (isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'  // Use UTC to avoid timezone shifts
  }).format(date);
}


// Format date as yyyy-mm-dd (ISO format) for invoices and formal documents
export function formatDateISO(dateString: string | null | undefined): string {
  if (!dateString) {
    return '';
  }
  // Force date to be interpreted as local date by appending T00:00:00
  const date = new Date(dateString + 'T00:00:00');
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return '';
  }
  // Return in yyyy-mm-dd format
  return date.toISOString().split('T')[0];
}

// Format short date (MM/DD/YYYY)
export function formatShortDate(dateString: string) {
  // Force date to be interpreted as local date by appending T00:00:00
  const date = new Date(dateString + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Calculate number of days between two dates
export function calculateDays(startDateString: string, endDateString: string) {
  // Force dates to be interpreted as local dates by appending T00:00:00
  const startDate = new Date(startDateString + 'T00:00:00');
  const endDate = new Date(endDateString + 'T00:00:00');
  
  // Check if dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.warn('Invalid date in calculateDays:', { startDateString, endDateString });
    return 1; // Default to 1 day if dates are invalid
  }
  
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // For booking purposes, minimum should be 1 day (same-day bookings count as 1 day)
  return Math.max(diffDays, 1);
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Convert square feet to square meters
export function sqftToSqm(sqft: number) {
  return Math.round(sqft * 0.092903);
}

// Generate a random color from a string (for map markers, etc.)
export function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate the effective price based on duration and available rate options
export function calculateEffectivePrice(
  basePricePerDay: number,
  startDate: string | Date,
  endDate: string | Date,
  weeklyRateType?: 'fixed' | 'percentage' | null,
  weeklyRateValue?: number | null,
  monthlyRateType?: 'fixed' | 'percentage' | null,
  monthlyRateValue?: number | null,
  yearlyRateType?: 'fixed' | 'percentage' | null,
  yearlyRateValue?: number | null
): { totalPrice: number; pricePerDay: number; term: 'day' | 'week' | 'month' | 'year' } {
  // Convert dates to Date objects if they're strings
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  // Calculate duration in days
  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  
  // Calculate duration in weeks, months, and years
  const durationWeeks = durationDays / 7;
  const durationMonths = durationDays / 30; // Approximate
  const durationYears = durationDays / 365; // Approximate
  
  
  // Initialize with daily rate
  let bestTotalPrice = basePricePerDay * durationDays;
  let bestPricePerDay = basePricePerDay;
  let bestTerm: 'day' | 'week' | 'month' | 'year' = 'day';
  
  // Check weekly rate if available
  if (weeklyRateType && weeklyRateValue) {
    let weeklyTotal: number;
    
    if (weeklyRateType === 'fixed') {
      // Fixed weekly rate
      weeklyTotal = Math.ceil(durationWeeks) * weeklyRateValue;
    } else {
      // Percentage discount on daily rate
      const weeklyDiscountMultiplier = 1 - (weeklyRateValue / 100);
      weeklyTotal = Math.ceil(durationWeeks) * 7 * basePricePerDay * weeklyDiscountMultiplier;
    }
    
    // If weekly rate is better, update best price
    if (weeklyTotal < bestTotalPrice) {
      bestTotalPrice = weeklyTotal;
      bestPricePerDay = weeklyTotal / durationDays;
      bestTerm = 'week';
    }
  }
  
  // Check monthly rate if available
  if (monthlyRateType && monthlyRateValue) {
    let monthlyTotal: number;
    
    if (monthlyRateType === 'fixed') {
      // Fixed monthly rate
      monthlyTotal = Math.ceil(durationMonths) * monthlyRateValue;
    } else {
      // Percentage discount on monthly rate - use 30-day months for calculation
      const monthlyDiscountMultiplier = 1 - (monthlyRateValue / 100);
      monthlyTotal = Math.ceil(durationMonths) * 30 * basePricePerDay * monthlyDiscountMultiplier;
    }
    
    // If monthly rate is better, update best price
    if (monthlyTotal < bestTotalPrice) {
      bestTotalPrice = monthlyTotal;
      bestPricePerDay = monthlyTotal / durationDays;
      bestTerm = 'month';
    }
  }
  
  // Check yearly rate if available
  if (yearlyRateType && yearlyRateValue) {
    let yearlyTotal: number;
    
    if (yearlyRateType === 'fixed') {
      // Fixed yearly rate
      yearlyTotal = Math.ceil(durationYears) * yearlyRateValue;
    } else {
      // Percentage discount on daily rate
      const yearlyDiscountMultiplier = 1 - (yearlyRateValue / 100);
      yearlyTotal = Math.ceil(durationYears) * 365 * basePricePerDay * yearlyDiscountMultiplier;
    }
    
    // If yearly rate is better, update best price
    if (yearlyTotal < bestTotalPrice) {
      bestTotalPrice = yearlyTotal;
      bestPricePerDay = yearlyTotal / durationDays;
      bestTerm = 'year';
    }
  }
  
  return {
    totalPrice: bestTotalPrice,
    pricePerDay: bestPricePerDay,
    term: bestTerm
  };
}