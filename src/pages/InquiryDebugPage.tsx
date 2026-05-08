import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import InquiryDebugger from '../components/debug/InquiryDebugger';

const InquiryDebugPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    loadDashboardData();
  }, [user, navigate]);

  async function loadDashboardData() {
    if (!user) {
      console.warn('Cannot load dashboard data: user is null');
      return;
    }

    try {
      // Fetch properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('venue_id', user.id);

      if (propertiesError) throw propertiesError;
      
      // Get property IDs owned by the user
      const ownedPropertyIds = (propertiesData || []).map(p => p.id);

      // Fetch inquiries (both as inquirer and venue owner)
      const { data: inquiriesData, error: inquiriesError } = await supabase
        .from('inquiries')
        .select(`
          *,
          property:properties(title, venue_id)
        `)
        .or(`user_id.eq.${user.id}${ownedPropertyIds.length ? `,property_id.in.(${ownedPropertyIds.join(',')})` : ''}`)
        .order('created_at', { ascending: false });

      if (inquiriesError) throw inquiriesError;
      setInquiries(inquiriesData || []);

      // Fetch bookings with more detailed data - include both user bookings and venue bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          property:properties(
            id, 
            title, 
            venue_id, 
            images, 
            address_street, 
            address_city, 
            address_state,
            tax_rate,
            fee_type,
            fee_value,
            fee_description,
            profiles:profiles!properties_venue_id_fkey(
              id,
              full_name,
              email,
              phone
            )
          ),
          proposal:proposals(
            id,
            inquiry_id,
            price_total,
            currency,
            message
          ),
          customer:profiles!bookings_user_id_fkey(
            id,
            full_name,
            email,
            phone
          )
        `)
        .or(`user_id.eq.${user.id}${ownedPropertyIds.length ? `,property_id.in.(${ownedPropertyIds.join(',')})` : ''}`)
        .order('start_date', { ascending: true });

      if (bookingsError) throw bookingsError;
      
      // Fetch additional inquiry data for each booking
      const bookingsWithInquiries = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          if (booking.proposal && booking.proposal.inquiry_id) {
            const { data: inquiry } = await supabase
              .from('inquiries')
              .select('id, message, created_at')
              .eq('id', booking.proposal.inquiry_id)
              .maybeSingle();
              
            // Add payment breakdown info
            const paymentBreakdown = {
              base_price: 0,
              taxes: 0,
              fees: 0,
              fee_description: booking.property?.fee_description || null
            };
            
            if (booking.price_total) {
              // This is a simplification - ideally you'd get this from the proposal
              const property = booking.property;
              if (property) {
                // Calculate days
                const startDate = new Date(booking.start_date);
                const endDate = new Date(booking.end_date);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // At least 1 day
                
                // Base price calculation - this is a guess as we don't have original calculation
                if (property.price_per_day) {
                  paymentBreakdown.base_price = property.price_per_day * diffDays;
                } else {
                  paymentBreakdown.base_price = booking.price_total;
                }
                
                // Calculate taxes if tax_rate exists
                if (property.tax_rate && property.tax_rate > 0) {
                  paymentBreakdown.taxes = paymentBreakdown.base_price * (property.tax_rate / 100);
                }
                
                // Calculate fees if they exist
                if (property.fee_value && property.fee_value > 0) {
                  if (property.fee_type === 'percentage') {
                    paymentBreakdown.fees = paymentBreakdown.base_price * (property.fee_value / 100);
                  } else {
                    paymentBreakdown.fees = property.fee_value;
                  }
                  paymentBreakdown.fee_description = property.fee_description;
                }
                
                // Adjust base price so total matches the booking price
                const calculatedTotal = paymentBreakdown.base_price + paymentBreakdown.taxes + paymentBreakdown.fees;
                if (Math.abs(calculatedTotal - booking.price_total) > 0.01) {
                  // Adjust base price to make total match
                  paymentBreakdown.base_price = booking.price_total - paymentBreakdown.taxes - paymentBreakdown.fees;
                }
              }
            }
              
            return {
              ...booking,
              inquiry,
              payment_breakdown: paymentBreakdown
            };
          }
          return booking;
        })
      );
      
      setBookings(bookingsWithInquiries);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-maroon-800 mb-2 font-display">
              Inquiry Debug Information
            </h1>
            <p className="text-maroon-600">
              Detailed information about inquiries and bookings for debugging purposes
            </p>
          </div>
        </div>

        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <CardContent className="p-4">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        <InquiryDebugger 
          inquiries={inquiries}
          bookings={bookings}
          userId={user?.id}
        />
      </div>
    </div>
  );
};

export default InquiryDebugPage;