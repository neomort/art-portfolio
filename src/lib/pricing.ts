export type QuoteMode = 'hourly' | 'daily';

export type AdjustmentType = 'user_selected_discount' | 'capacity_surcharge' | 'off_hours_adjustment' | 'off_days_adjustment';

export interface OrgAdjustmentRow {
  id: string;
  type: AdjustmentType;
  data: any;
  sort_order?: number;
}

export interface ComputeQuoteInput {
  mode: QuoteMode;
  baseHourly?: number | null; // USD per hour
  baseDaily?: number | null;  // USD per day
  startISO?: string;          // for hourly
  endISO?: string;            // for hourly
  days?: number;              // for daily (number of days)
  timezone?: string | null;   // IANA TZ for property
  headcount?: number | null;  // optional headcount
  adjustments: OrgAdjustmentRow[];
}

export interface QuoteBreakdown {
  base: number;
  adjustments: { id: string; label: string; amount: number }[];
  total: number;
  meta?: {
    mode: QuoteMode;
    baseDaily?: number | null;
    baseHourly?: number | null;
    appliedAdjustmentIds?: string[];
  };
}

function hoursBetween(startISO: string, endISO: string, tz?: string | null): number {
  // Use wall time difference; selection is already local-like. Fallback to UTC diff.
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  const diffMs = Math.max(0, e - s);
  return diffMs / (1000 * 60 * 60);
}

function weekdayInTZ(iso: string, tz?: string | null): number {
  try {
    // Use Intl to get weekday (0=Sun..6=Sat) in TZ by formatting and re-parsing day.
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, weekday: 'short' });
    const label = fmt.format(d).toLowerCase();
    const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return map[label.slice(0, 3)] ?? d.getDay();
  } catch {
    return new Date(iso).getDay();
  }
}

function timeHMInTZ(iso: string, tz?: string | null): { h: number; m: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(iso));
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
    return { h, m };
  } catch {
    const d = new Date(iso);
    return { h: d.getHours(), m: d.getMinutes() };
  }
}

function fractionOverlapOffHours(startISO: string, endISO: string, tz: string | null, winStart: string, winEnd: string): number {
  // winStart/winEnd are "HH:mm" representing the window OUTSIDE of which to apply adjustment.
  // We compute how much of the selection lies outside [winStart, winEnd].
  const totalH = Math.max(0, hoursBetween(startISO, endISO, tz));
  if (totalH === 0) return 0;
  const sHM = timeHMInTZ(startISO, tz);
  const eHM = timeHMInTZ(endISO, tz);
  const [wsH, wsM] = winStart.split(':').map(Number);
  const [weH, weM] = winEnd.split(':').map(Number);
  const toMins = (h: number, m: number) => h * 60 + m;
  const selStartM = toMins(sHM.h, sHM.m);
  const selEndM = toMins(eHM.h, eHM.m);
  const winStartM = toMins(wsH, wsM);
  const winEndM = toMins(weH, weM);
  // Portion outside [winStartM, winEndM]
  const overlapInside = Math.max(0, Math.min(selEndM, winEndM) - Math.max(selStartM, winStartM));
  const selMins = Math.max(0, selEndM - selStartM);
  const outsideMins = Math.max(0, selMins - overlapInside);
  return selMins === 0 ? 0 : outsideMins / selMins;
}

export function computeQuote(input: ComputeQuoteInput): QuoteBreakdown {
  const {
    mode,
    baseHourly = null,
    baseDaily = null,
    startISO,
    endISO,
    days = 1,
    timezone = null,
    headcount = null,
    adjustments = [],
  } = input;

  let base = 0;
  if (mode === 'hourly') {
    const hrs = startISO && endISO ? hoursBetween(startISO, endISO, timezone) : 0;
    base = (baseHourly || 0) * hrs;
  } else {
    base = (baseDaily || 0) * Math.max(1, days);
  }

  const lines: { id: string; label: string; amount: number }[] = [];

  // Capacity surcharge (per unit or booking)
  for (const row of adjustments.filter(a => a.type === 'capacity_surcharge')) {
    const d = row.data || {};
    const perHead = Number(d.perHeadcount || 0);
    const amount = Number(d.amount || 0);
    const per: string = d.per || 'per_hour'; // 'per_hour' | 'per_day' | 'per_week' | 'per_month' | 'per_booking'
    if (!headcount || perHead <= 0 || amount <= 0) continue;
    const over = Math.max(0, headcount - 25); // first 25 included
    const increments = Math.ceil(over / perHead);
    if (increments <= 0) continue;
    let units = 1;
    if (mode === 'hourly' && per === 'per_hour' && startISO && endISO) units = Math.max(0, hoursBetween(startISO, endISO, timezone));
    if (mode === 'daily' && per === 'per_day') units = Math.max(1, days);
    // For per_booking, leave units=1. For week/month, treat as booking-level for now.
    const lineAmt = increments * amount * units;
    if (lineAmt !== 0) lines.push({ id: row.id, label: 'Capacity surcharge', amount: lineAmt });
  }

  // Off-hours adjustment: percentage or fixed
  for (const row of adjustments.filter(a => a.type === 'off_hours_adjustment')) {
    if (mode !== 'hourly' || !startISO || !endISO) continue;
    const d = row.data || {};
    const rateType: 'percentage' | 'fixed' = d.rateType || 'percentage';
    const value = Number(d.value || 0);
    const adjustment: 'surcharge' | 'discount' = d.adjustment || 'surcharge';
    const winStart: string = d.start || '07:00';
    const winEnd: string = d.end || '20:00';
    const frac = fractionOverlapOffHours(startISO, endISO, timezone || null, winStart, winEnd);
    const basePortion = base * frac; // portion of base overlapping off-hours
    const sign = adjustment === 'surcharge' ? 1 : -1;
    const lineAmt = rateType === 'percentage' ? basePortion * (value / 100) * sign : value * sign;
    if (lineAmt !== 0) lines.push({ id: row.id, label: 'Off-hours adjustment', amount: lineAmt });
  }

  // Off-days adjustment by weekday
  for (const row of adjustments.filter(a => a.type === 'off_days_adjustment')) {
    const d = row.data || {};
    const rateType: 'percentage' | 'fixed' = d.rateType || 'percentage';
    const value = Number(d.value || 0);
    const adjustment: 'surcharge' | 'discount' = d.adjustment || 'surcharge';
    const daysPreset: string = d.days || 'weekdays';
    let applies = false;
    if (mode === 'hourly' && startISO) {
      const wd = weekdayInTZ(startISO, timezone || null);
      const isWeekend = wd === 0 || wd === 6;
      if (daysPreset === 'weekdays') applies = !isWeekend;
      else if (daysPreset === 'weekends') applies = isWeekend;
      else if (daysPreset === 'tue_thu') applies = wd === 2 || wd === 4;
      else if (daysPreset === 'mon_thu') applies = wd >= 1 && wd <= 4;
      else if (daysPreset === 'fridays') applies = wd === 5;
    } else if (mode === 'daily') {
      // For daily, apply to the first day (simple rule of thumb)
      applies = true;
    }
    if (!applies) continue;
    const sign = adjustment === 'surcharge' ? 1 : -1;
    const lineAmt = rateType === 'percentage' ? base * (value / 100) * sign : value * sign;
    if (lineAmt !== 0) lines.push({ id: row.id, label: 'Off-days adjustment', amount: lineAmt });
  }

  // User-selected discount is not auto-applied here (requires user action/approval). If needed, fold in at proposal step.

  const totalAdj = lines.reduce((sum, l) => sum + l.amount, 0);
  return {
    base,
    adjustments: lines,
    total: base + totalAdj,
    meta: {
      mode,
      baseDaily,
      baseHourly,
      appliedAdjustmentIds: adjustments.map(a => a.id),
    },
  };
}
