import { supabase } from './supabase';

/**
 * Execute raw SQL queries using the Supabase client
 */
export async function executeSQL(query: string) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query });
    
    if (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to execute SQL:', err);
    throw err;
  }
}

/**
 * Test function to create booking calendar attachment
 */
export async function testBookingCalendarAttachment() {
  const query = `SELECT public.create_booking_calendar_attachment_v4('test-booking-123', 'Test Property', '2023-07-01', '2023-07-03', 'Test Location');`;
  
  try {
    const result = await executeSQL(query);
    console.log('Booking calendar attachment test result:', result);
    return result;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}