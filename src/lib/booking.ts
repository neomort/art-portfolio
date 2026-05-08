export type BookingMode = 'daily' | 'hourly';

export interface BuildBookingInsertArgs {
  mode: BookingMode;
  propertyId: string;
  userId: string;
  priceTotal: number;
  currency?: string;
  // Daily
  startDate?: string; // yyyy-mm-dd
  endDate?: string;   // yyyy-mm-dd
  // Hourly (ISO strings)
  startAt?: string;   // ISO timestamp
  endAt?: string;     // ISO timestamp
  // Optional linkage
  proposalId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Build a bookings insert payload that writes hourly fields when mode='hourly',
 * and daily fields when mode='daily'. Keeps date fields populated for BC when hourly.
 */
export function buildBookingInsert(args: BuildBookingInsertArgs) {
  const {
    mode,
    propertyId,
    userId,
    priceTotal,
    currency = 'USD',
    startDate,
    endDate,
    startAt,
    endAt,
    proposalId,
    extra = {},
  } = args;

  const base: any = {
    property_id: propertyId,
    user_id: userId,
    price_total: priceTotal,
    currency,
    status: 'confirmed',
    payment_status: 'pending',
    ...(proposalId ? { proposal_id: proposalId } : {}),
    ...extra,
  };

  if (mode === 'hourly') {
    if (!startAt || !endAt) {
      throw new Error('buildBookingInsert: startAt/endAt required for hourly mode');
    }
    const startDatePart = startAt.split('T')[0];
    const endDatePart = endAt.split('T')[0];
    return {
      ...base,
      kind: 'hourly',
      start_at: startAt,
      end_at: endAt,
      // Back-compat
      start_date: startDatePart,
      end_date: endDatePart,
    };
  }

  if (!startDate || !endDate) {
    throw new Error('buildBookingInsert: startDate/endDate required for daily mode');
  }
  return {
    ...base,
    kind: 'daily',
    start_date: startDate,
    end_date: endDate,
  };
}
