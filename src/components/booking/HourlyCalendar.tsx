import React from 'react';
// DayPilot Lite React Calendar
// You must install the package in your project:
//   npm install @daypilot/daypilot-lite-react
// or
//   pnpm add @daypilot/daypilot-lite-react
import { DayPilot, DayPilotCalendar } from '@daypilot/daypilot-lite-react';

export interface HourlyCalendarSelection {
  start: string; // ISO string
  end: string;   // ISO string
}

interface HourlyCalendarProps {
  selected?: HourlyCalendarSelection | null;
  onChange: (sel: HourlyCalendarSelection | null) => void;
  date?: string; // yyyy-mm-dd for the calendar focus date; defaults to today
  minDate?: string; // yyyy-mm-dd
  maxDate?: string; // yyyy-mm-dd
  disabled?: boolean;
  disabledWeekdays?: number[]; // 0=Sun..6=Sat
  workingHoursByWeekday?: { [weekday: number]: { start: string; end: string } }; // HH:mm
  blockedRanges?: { start: string; end: string }[]; // ISO ranges to block (e.g., from bookings/iCal)
}

const HourlyCalendar: React.FC<HourlyCalendarProps> = ({ selected, onChange, date, minDate, maxDate, disabled, disabledWeekdays = [], workingHoursByWeekday = {}, blockedRanges = [] }) => {
  const startDate = date || DayPilot.Date.today().toString('yyyy-MM-dd');
  const parseYmd = (ymd?: string) => {
    if (!ymd || ymd.length < 10) return null;
    const [y, m, d] = ymd.substring(0,10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m-1, d);
  };
  const currentDay = parseYmd(startDate)?.getDay() ?? new Date().getDay();
  const hours = workingHoursByWeekday[currentDay];
  const beginsHour = hours ? Number(hours.start.split(':')[0]) : 6;
  const endsHour = hours ? Number(hours.end.split(':')[0]) : 22;

  const config: DayPilot.CalendarConfig = {
    viewType: 'Day',
    startDate,
    timeRangeSelectedHandling: 'Enabled',
    eventMoveHandling: 'Disabled',
    eventResizeHandling: 'Disabled',
    durationBarVisible: false,
    businessBeginsHour: beginsHour,
    businessEndsHour: endsHour,
    timeFormat: 'Clock12Hours',
    headerDateFormat: 'dddd, MMM d',
    heightSpec: 'BusinessHoursNoScroll',
  };

  const calendarRef = React.useRef<any>(null);
  const [events, setEvents] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!calendarRef.current) return;
    const dp = (calendarRef.current as any).control;
    if (!dp) return;
    // Safely compute clamped start date as YYYY-MM-DD string
    let s = startDate;
    const toYmd = (d: Date) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const sDate = parseYmd(s) || new Date();
    const minD = parseYmd(minDate);
    const maxD = parseYmd(maxDate);
    let clamped = sDate;
    if (minD && clamped < minD) clamped = minD;
    if (maxD && clamped > maxD) clamped = maxD;
    dp.update({ startDate: toYmd(clamped), businessBeginsHour: beginsHour, businessEndsHour: endsHour, heightSpec: 'BusinessHoursNoScroll' });
  }, [startDate, minDate, maxDate, beginsHour, endsHour]);

  // Render blocked ranges as background events
  React.useEffect(() => {
    const blockedEvents = (blockedRanges || []).map((r, i) => {
      try {
        // Validate and format the blocked range
        let start, end;
        try {
          start = new Date(r.start);
          end = new Date(r.end);
        } catch (e) {
          console.warn(`[HourlyCalendar] Invalid date format for blocked range ${i}:`, r);
          return null;
        }

        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.warn(`[HourlyCalendar] Invalid date values for blocked range ${i}:`, r);
          return null;
        }

        return {
          id: `__blocked__${i}`,
          start: r.start, // Keep original format for DayPilot
          end: r.end,
          text: 'Unavailable',
          backColor: '#9CA3AF',
          borderColor: '#6B7280',
          fontColor: '#ffffff',
          moveDisabled: true,
          resizeDisabled: true,
        };
      } catch (e) {
        console.warn(`[HourlyCalendar] Error processing blocked range ${i}:`, e, r);
        return null;
      }
    }).filter(Boolean); // Remove null entries

    // Debug: Log blocked ranges received by calendar
    if (typeof window !== 'undefined' && blockedRanges.length > 0) {
      console.log('[HourlyCalendar] Received blocked ranges:', blockedRanges.length);
      blockedRanges.forEach((range, index) => {
        console.log(`[HourlyCalendar] Blocked range ${index}:`, {
          start: range.start,
          end: range.end,
          startDate: new Date(range.start).toLocaleDateString(),
          startTime: new Date(range.start).toLocaleTimeString(),
          endDate: new Date(range.end).toLocaleDateString(),
          endTime: new Date(range.end).toLocaleTimeString()
        });
      });
      console.log('[HourlyCalendar] Converted to events:', blockedEvents.length);
    }

    setEvents((prev) => {
      const withoutOldBlocked = prev.filter(e => !(typeof e.id === 'string' && e.id.startsWith('__blocked__')));
      return [...withoutOldBlocked, ...blockedEvents];
    });
  }, [JSON.stringify(blockedRanges)]);

  const [hintShown, setHintShown] = React.useState(false);
  const selectionEventId = React.useRef<string>('__selection__');
  const [notice, setNotice] = React.useState<string | null>(null);

  const handleTimeRangeSelected = async (args: DayPilot.CalendarTimeRangeSelectedArgs) => {
    if (disabled) return;
    const startISO = (args as any)?.start?.value || args.start?.toString?.() || '';
    const endISO = (args as any)?.end?.value || args.end?.toString?.() || '';
    if (startISO && endISO) {
      // Validate range against min/max and disabled weekdays
      const sDate = new Date(startISO);
      const eDate = new Date(endISO);
      const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const sDay = toDateOnly(sDate);
      const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
      const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;
      const weekday = sDate.getDay();
      if (disabledWeekdays.includes(weekday)) {
        setNotice('This day is not available.');
        return;
      }
      if ((minD && sDay < minD) || (maxD && sDay > maxD)) {
        setNotice('Selected date is outside the available range.');
        return;
      }
      // Validate within working hours if provided
      const wh = workingHoursByWeekday[weekday];
      if (wh) {
        const [bh, bm] = wh.start.split(':').map(Number);
        const [eh, em] = wh.end.split(':').map(Number);
        const begins = new Date(sDay); begins.setHours(bh, bm || 0, 0, 0);
        const ends = new Date(sDay); ends.setHours(eh, em || 0, 0, 0);
        if (sDate < begins || eDate > ends) {
          setNotice(`Please select within available hours (${wh.start}–${wh.end}).`);
          return;
        }
      }
      // Validate against blocked ranges (overlap not allowed)
      const overlaps = (blockedRanges || []).some((r) => {
        const bs = new Date(r.start).getTime();
        const be = new Date(r.end).getTime();
        return Math.max(sDate.getTime(), bs) < Math.min(eDate.getTime(), be);
      });
      if (overlaps) {
        setNotice('The selected time overlaps with an unavailable event.');
        return;
      }
      setNotice(null);
      // Debug: verify selection fires
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[HourlyCalendar] Selected range', { startISO, endISO });
      }
      onChange({ start: startISO, end: endISO });
      // Clear selection to provide visual feedback the range was captured
      try { (args as any)?.control?.clearSelection?.(); } catch {}
      // Add or update a temporary event to show the selected block (controlled via React state)
      const id = selectionEventId.current;
      const payload = {
        id,
        start: startISO,
        end: endISO,
        text: 'Selected',
        backColor: '#EA6C56',
        borderColor: '#C24B36',
        fontColor: '#FFFFFF',
        moveDisabled: true,
        resizeDisabled: true,
      } as any;
      setEvents(prev => {
        const idx = prev.findIndex(e => e.id === id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = payload;
          return copy;
        }
        return [...prev, payload];
      });
      if (!hintShown) setHintShown(true);
    }
  };

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <DayPilotCalendar
        ref={calendarRef}
        {...config}
        events={events as any}
        onTimeRangeSelected={handleTimeRangeSelected}
      />
      {selected && (
        <div className="text-xs text-maroon-600 mt-2">
          {(() => {
            try {
              const s = new Date(selected.start);
              const e = new Date(selected.end);
              const sameDate = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
              const dateFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
              const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              const startStr = `${dateFmt.format(s)}, ${timeFmt.format(s)}`;
              const endStr = sameDate ? `${timeFmt.format(e)}` : `${dateFmt.format(e)}, ${timeFmt.format(e)}`;
              return `Selected: ${startStr} – ${endStr}`;
            } catch (e) {
              console.warn('[HourlyCalendar] Error formatting selected time:', e);
              return 'Selected time';
            }
          })()}
        </div>
      )}
      {!selected && hintShown && (
        <div className="text-xs text-maroon-600 mt-2">Time range captured. You can adjust by dragging a new selection.</div>
      )}
      {notice && (
        <div className="text-xs text-red-600 mt-2">{notice}</div>
      )}
    </div>
  );
};

export default HourlyCalendar;
