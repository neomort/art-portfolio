/**
 * Booking API utilities
 * Centralized API calls for booking-related operations
 */

/**
 * Cancel a booking
 * @param bookingId - ID of the booking to cancel
 * @param reason - Reason for cancellation
 * @param accessToken - User's access token for authorization
 */
export const cancelBooking = async (
  bookingId: string, 
  reason: string, 
  accessToken: string
): Promise<void> => {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bookingId,
      reason
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to cancel booking');
  }
};
