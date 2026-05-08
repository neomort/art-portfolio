import { generateCalendarEvent } from '../../lib/calendar';

// Generate calendar event data
export const handleAddToCalendar = async (booking: any, type: 'google' | 'apple' | 'outlook') => {
  if (!booking) return;
  
  const eventTitle = `Space booking at ${booking.property?.title || 'Property'}`;
  const startDate = new Date(booking.start_date);
  const endDate = new Date(booking.end_date);
  const location = booking.property ? 
    `${booking.property.address_street || ''}, ${booking.property.address_city || ''}, ${booking.property.address_state || ''}` : 
    '';
  const description = `Booking details: ${window.location.origin}/dashboard`;

  try {
    if (type === 'google') {
      const googleUrl = generateCalendarEvent(eventTitle, startDate, endDate, location, description, 'google', true);
      if (typeof googleUrl === 'string') {
        window.open(googleUrl, '_blank');
      } else {
        console.error('Invalid Google Calendar URL generated');
      }
    } else {
      // For Apple/Outlook, generate ICS content
      const icsContent = generateCalendarEvent(eventTitle, startDate, endDate, location, description, 'ics', true);
      
      if (typeof icsContent === 'string' && icsContent) {
        // Create a download link with the ICS content
        const element = document.createElement('a');
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        element.href = URL.createObjectURL(blob);
        element.download = `booking-${booking.id.substring(0, 8)}.ics`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      } else {
        console.error('Failed to generate ICS content');
      }
    }
  } catch (error) {
    console.error('Error generating calendar event:', error);
  }
};