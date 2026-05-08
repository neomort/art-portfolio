import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface InquiryDebuggerProps {
  inquiries: any[];
  bookings: any[];
  userId: string | undefined;
}

const InquiryDebugger: React.FC<InquiryDebuggerProps> = ({ 
  inquiries, 
  bookings, 
  userId
}) => {
  // Count active inquiries using the same logic as in DashboardPage
  const activeInquiries = inquiries.filter(inquiry => {
    // Check if the current user is the initiator or responder
    const isInitiator = inquiry.user_id === userId;
    const isResponder = inquiry.property?.venue_id === userId;
    
    // Skip if deleted by the current user based on their role
    if ((isInitiator && inquiry.initiator_deleted) || 
        (isResponder && inquiry.responder_deleted)) {
      return false;
    }
    
    // Check if there's a booking for this inquiry
    const relatedBooking = bookings.find(booking => 
      booking.proposal?.inquiry_id === inquiry.id
    );
    
    // If there's a related booking, only count as active if payment is pending
    if (relatedBooking) {
      return relatedBooking.payment_status === 'pending';
    }
    
    // Count as active if:
    // 1. It's pending (needs initial response)
    // 2. It's responded (conversation in progress)
    // 3. It's converted to proposal (awaiting payment)
    return inquiry.status === 'pending' || 
           inquiry.status === 'responded' || 
           inquiry.status === 'converted_to_proposal';
  });

  return (
    <Card className="mt-6 bg-blue-50 border-blue-200 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-blue-800 font-bold text-xl">Inquiry Debug Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-maroon-800">Summary</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="font-medium text-maroon-700">Total Inquiries:</span> 
                <span className="text-maroon-900">{inquiries.length}</span>
              </li>
              <li className="flex justify-between">
                <span className="font-medium text-maroon-700">Active Inquiries:</span> 
                <span className="text-maroon-900">{activeInquiries.length}</span>
              </li>
              <li className="flex justify-between">
                <span className="font-medium text-maroon-700">Converted to Bookings:</span> 
                <span className="text-maroon-900">{bookings.filter(b => b.proposal?.inquiry_id).length}</span>
              </li>
              <li className="flex justify-between">
                <span className="font-medium text-maroon-700">Total Bookings:</span> 
                <span className="text-maroon-900">{bookings.length}</span>
              </li>
              <li className="flex justify-between">
                <span className="font-medium text-maroon-700">Current User ID:</span> 
                <span className="text-maroon-900 font-mono text-xs">{userId?.substring(0, 12) || 'Not logged in'}...</span>
              </li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-maroon-800">Active Inquiries</h3>
            {activeInquiries.length > 0 ? (
              <div className="space-y-2">
                {activeInquiries.map(inquiry => (
                  <div key={inquiry.id} className="border border-maroon-100 p-3 rounded-lg text-sm bg-maroon-50/30">
                    <div className="grid grid-cols-2 gap-2">
                      <p><span className="font-semibold text-maroon-700">ID:</span> <span className="font-mono">{inquiry.id.substring(0, 8)}...</span></p>
                      <p><span className="font-semibold text-maroon-700">Status:</span> <span className="px-2 py-0.5 bg-maroon-100 text-maroon-800 rounded-full text-xs">{inquiry.status}</span></p>
                      <p><span className="font-semibold text-maroon-700">User ID:</span> <span className="font-mono">{inquiry.user_id.substring(0, 8)}...</span></p>
                      <p><span className="font-semibold text-maroon-700">Property:</span> {inquiry.property?.title || 'Unknown'}</p>
                      <p><span className="font-semibold text-maroon-700">Is User Initiator:</span> <span className={inquiry.user_id === userId ? 'text-green-600' : 'text-gray-600'}>{inquiry.user_id === userId ? 'Yes' : 'No'}</span></p>
                      <p><span className="font-semibold text-maroon-700">Is User Responder:</span> <span className={inquiry.property?.venue_id === userId ? 'text-green-600' : 'text-gray-600'}>{inquiry.property?.venue_id === userId ? 'Yes' : 'No'}</span></p>
                      <p><span className="font-semibold text-maroon-700">Initiator Deleted:</span> <span className={inquiry.initiator_deleted ? 'text-red-600' : 'text-green-600'}>{inquiry.initiator_deleted ? 'Yes' : 'No'}</span></p>
                      <p><span className="font-semibold text-maroon-700">Responder Deleted:</span> <span className={inquiry.responder_deleted ? 'text-red-600' : 'text-green-600'}>{inquiry.responder_deleted ? 'Yes' : 'No'}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">No active inquiries found. This explains the "0 active inquiries" display.</p>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-maroon-800">All Inquiries</h3>
            {inquiries.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {inquiries.map(inquiry => (
                  <div key={inquiry.id} className="border border-gray-200 p-3 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    <p className="flex justify-between">
                      <span className="font-semibold text-maroon-700">ID:</span> 
                      <span className="font-mono">{inquiry.id.substring(0, 8)}...</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold text-maroon-700">Status:</span> 
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs">{inquiry.status}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold text-maroon-700">Has Booking:</span> 
                      <span className={bookings.some(b => b.proposal?.inquiry_id === inquiry.id) ? 'text-green-600' : 'text-gray-600'}>
                        {bookings.some(b => b.proposal?.inquiry_id === inquiry.id) ? 'Yes' : 'No'}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold text-maroon-700">Booking Status:</span> 
                      <span className={
                      (() => {
                        const booking = bookings.find(b => b.proposal?.inquiry_id === inquiry.id);
                        const status = booking ? booking.payment_status : 'No booking';
                        return status === 'paid' ? 'text-green-600' : status === 'pending' ? 'text-amber-600' : 'text-gray-600';
                      })()
                    }>
                      {(() => {
                        const booking = bookings.find(b => b.proposal?.inquiry_id === inquiry.id);
                        return booking ? booking.payment_status : 'No booking';
                      })()}
                    </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold text-maroon-700">Is Deleted:</span> 
                      <span className={
                      (inquiry.user_id === userId && inquiry.initiator_deleted) || 
                      (inquiry.property?.venue_id === userId && inquiry.responder_deleted) 
                        ? 'text-red-600' : 'text-green-600'
                      }>
                        {(inquiry.user_id === userId && inquiry.initiator_deleted) || 
                          (inquiry.property?.venue_id === userId && inquiry.responder_deleted) 
                            ? 'Yes' : 'No'}
                      </span>
                    </p>
                    <p className="mt-2 p-2 bg-blue-50 rounded-lg text-blue-700 text-xs">
                      <span className="font-semibold">Why Not Active:</span> {
                        (() => {
                          const booking = bookings.find(b => b.proposal?.inquiry_id === inquiry.id);
                          if (booking && booking.payment_status !== 'pending') {
                            return `Converted to booking (${booking.payment_status})`;
                          }
                          if (inquiry.user_id === userId && inquiry.initiator_deleted) {
                            return 'Deleted by you as initiator';
                          }
                          if (inquiry.property?.venue_id === userId && inquiry.responder_deleted) {
                            return 'Deleted by you as responder';
                          }
                          if (inquiry.status !== 'pending' && 
                              inquiry.status !== 'responded' && 
                              inquiry.status !== 'converted_to_proposal') {
                            return `Status is ${inquiry.status}`;
                          }
                          return 'Should be active - check for other issues';
                        })()
                      }
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-center py-4">No inquiries found.</p>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-maroon-800">Bookings with Payment Pending</h3>
            {bookings.filter(b => b.payment_status === 'pending').length > 0 ? (
              <div className="space-y-2">
                {bookings.filter(b => b.payment_status === 'pending').map(booking => (
                  <div key={booking.id} className="border border-amber-200 p-3 rounded-lg text-sm bg-amber-50/30">
                    <div className="grid grid-cols-2 gap-2">
                      <p><span className="font-semibold text-amber-700">ID:</span> <span className="font-mono">{booking.id.substring(0, 8)}...</span></p>
                      <p><span className="font-semibold text-amber-700">Status:</span> <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">{booking.status}</span></p>
                      <p><span className="font-semibold text-amber-700">Payment Status:</span> <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">{booking.payment_status}</span></p>
                      <p><span className="font-semibold text-amber-700">Related Inquiry:</span> <span className="font-mono">{booking.proposal?.inquiry_id 
                        ? booking.proposal.inquiry_id.substring(0, 8) + '...' 
                        : 'None'}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-center py-4">No bookings with payment pending.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InquiryDebugger;