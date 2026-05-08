// Import ical-generator dynamically only when needed

/**
 * Safely converts a string to a Date object
 */
function safeParseDate(dateStr: string | Date): Date | null { 
  if (dateStr instanceof Date) {
    return dateStr;
  }
  
  try {
    // Force date to be interpreted as local date by appending T00:00:00 if it's just a date string
    const date = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-')
      ? new Date(dateStr + 'T00:00:00')
      : new Date(dateStr);
      
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateStr);
      return null; // Return null for invalid dates
    }
    return date;
  } catch (e) {
    console.error('Error parsing date:', e);
    return null; // Return null on error
  }
}

/**
 * Generates a calendar event for various calendar services
 * 
 * @param title - Event title
 * @param startDate - Start date of the event
 * @param endDate - End date of the event
 * @param location - Location of the event
 * @param description - Description of the event
 * @param type - Type of calendar service ('google', 'ics')
 * @param isAllDay - Whether the event is an all-day event (default: false)
 * @returns URL for Google Calendar or ICS file content for Apple/Outlook
 */
export function generateCalendarEvent( 
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string,
  type: 'google' | 'ics',
  isAllDay: boolean = true
): string | Uint8Array {
  // Ensure dates are valid Date objects
  const validStartDate = safeParseDate(startDate);
  const validEndDate = safeParseDate(endDate);
  
  // If either date is invalid, log an error and return empty string
  if (!validStartDate || !validEndDate) {
    console.error('Invalid dates provided to generateCalendarEvent:', { startDate, endDate });
    return '';
  }
  
  // Format dates for ICS
  const formatICSDate = (date: Date, allDay: boolean) => {
    if (allDay) {
      // For all-day events, use YYYYMMDD format
      return date.toISOString().split('T')[0].replace(/-/g, '');
    } else {
      // For timed events, use full UTC format
      return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    }
  };

  if (type === 'google') {
    // Format dates for Google Calendar
    const formatGoogleDate = (date: Date, allDay: boolean) => {
      if (allDay) {
        // For all-day events, use YYYYMMDD format without time component (local date)
        return date.toISOString().split('T')[0].replace(/-/g, '');
      } else {
        return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
      }
    };

    const googleStartDate = formatGoogleDate(validStartDate, isAllDay);
    const googleEndDate = formatGoogleDate(validEndDate, isAllDay);

    // Build Google Calendar URL with correct format
    // Note: URLSearchParams automatically encodes the values
    const googleUrl = new URL('https://www.google.com/calendar/render');
    googleUrl.searchParams.append('action', 'TEMPLATE');
    googleUrl.searchParams.append('text', title);
    googleUrl.searchParams.append('dates', `${googleStartDate}/${googleEndDate}`);
    googleUrl.searchParams.append('details', description);
    googleUrl.searchParams.append('sf', 'true');
    googleUrl.searchParams.append('output', 'xml');
    
    if (location) {
      googleUrl.searchParams.append('location', location);
    }
    
    return googleUrl.toString();
  } else if (type === 'ics') {
    // Create ICS file for Apple Calendar and Outlook
    // Safely handle description and location
    const safeDescription = description ? description.replace(/\n/g, '\\n') : '';
    const safeLocation = location || '';
    const safeTitle = title || 'Event';
    
    // For all-day events, we need to adjust the end date to be the next day
    // because in iCalendar format, the end date is exclusive
    const adjustedEndDate = new Date(validEndDate);
    if (isAllDay) { 
      adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
    }
    
    // Generate a unique ID for the event
    const uid = crypto.randomUUID ? crypto.randomUUID() : 
      `event-${Date.now()}-${Math.random().toString(36).substring(2, 10)}@splitspace.app`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SplitSpace//BookingCalendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(new Date(), false)}`,
      isAllDay 
        ? `DTSTART;VALUE=DATE:${formatICSDate(validStartDate, true)}` 
        : `DTSTART:${formatICSDate(validStartDate, false)}`,
      isAllDay 
        ? `DTEND;VALUE=DATE:${formatICSDate(adjustedEndDate, true)}` 
        : `DTEND:${formatICSDate(adjustedEndDate, false)}`,
      `SUMMARY:${safeTitle.replace(/[\r\n,;]/g, '')}`,
      `DESCRIPTION:${safeDescription.replace(/[\r\n,;]/g, '\\n')}`,
      `LOCATION:${safeLocation.replace(/[\r\n,;]/g, '')}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n') + '\r\n';
    
    console.log('Generated ICS content:', icsContent.substring(0, 200) + '...');

    return icsContent;
  }
  
  return '';
}