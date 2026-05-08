import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface EnrichedBooking {
  id: string;
  property_id: string;
  user_id: string;
  proposal_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string;
  price_total?: number;
  currency?: string;
  stripe_payment_intent_id?: string;
  proposals?: {
    id: string;
    inquiry_id: string;
    price_total?: number;
    currency?: string;
    message?: string;
    inquiries?: {
      id: string;
      message?: string;
      properties?: {
        id: string;
        title: string;
        venue_id: string;
        address_street?: string;
        address_city?: string;
        address_state?: string;
        images?: any[];
      };
      profiles?: {
        id: string;
        full_name: string;
        email?: string;
        phone?: string;
        primary_organization_id?: string;
      };
    };
  };
}

export function useBookingDetails(bookingId: string | null) {
  const [booking, setBooking] = useState<EnrichedBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setBooking(null);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchBooking = async () => {
      setLoading(true);
      setError(null);
      try {
        const sb: any = supabase;
        const { data, error: fetchError } = await sb
          .from('bookings')
          .select(`
            *,
            proposals:proposals!bookings_proposal_id_fkey(
              *,
              inquiries:inquiries!proposals_inquiry_id_fkey(
                *,
                properties:properties!inquiries_property_id_fkey(
                  id,
                  title,
                  venue_id,
                  address_street,
                  address_city,
                  address_state,
                  images
                ),
                profiles:profiles!inquiries_user_id_fkey(
                  id,
                  full_name,
                  email,
                  phone,
                  primary_organization_id
                )
              )
            )
          `)
          .eq('id', bookingId)
          .single();

        if (fetchError) throw fetchError;
        setBooking(data);
      } catch (e: any) {
        console.error('Failed to fetch enriched booking:', e);
        setError(e?.message || 'Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  return { booking, loading, error };
}
