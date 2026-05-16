import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

interface ReviewFormProps {
  propertyId: string;
  onSuccess: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ propertyId, onSuccess }) => {
  const { user } = useAuth();
  const [hasReviewed, setHasReviewed] = useState(false);
  const [isVenueOwner, setIsVenueOwner] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing review status on mount
  useEffect(() => {
    if (!user) return;
    
    // Check if current user is the venue owner
    // Disabled for art portfolio - venue_id column doesn't exist
    setIsVenueOwner(false);
    
    // Check if user has already reviewed this property
    const checkExistingReview = async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id')
        .eq('property_id', propertyId)
        .eq('reviewer_id', user.id)
        .limit(1);

      setHasReviewed(!!(data && data.length > 0));
    };

    checkExistingReview();
  }, [propertyId, user]);

  // If user is not logged in, show sign-in prompt
  if (!user) {
    return (
      <Card className="p-6">
        <h3 className="text-xl font-semibold text-maroon-800 mb-4">
          Write a Review
        </h3>
        <div className="text-center py-4">
          <p className="text-maroon-600 mb-4">
            Please sign in to write a review for this property.
          </p>
          <Link to={`/signin?redirect=${encodeURIComponent(window.location.pathname)}`}>
            <Button variant="outline">Sign In to Write a Review</Button>
          </Link>
        </div>
      </Card>
    );
  }

  // Don't show form if user already reviewed or is the venue owner
  if (hasReviewed || isVenueOwner) {
    return (
      <Card className="p-6">
        <h3 className="text-xl font-semibold text-maroon-800 mb-4">
          Write a Review
        </h3>
        <div className="text-center py-4">
          <p className="text-maroon-600 mb-4">
            {isVenueOwner 
              ? "As the property owner, you cannot review your own property."
              : "You have already submitted a review for this property."}
          </p>
        </div>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!rating || content.length < 20) {
      setError('Please provide both a rating and a review of at least 20 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if user has interacted with the property
      const { data: interactions, error: interactionError } = await supabase
        .from('inquiries')
        .select('id, status')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .limit(1);

      if (interactionError) {
        // Continue anyway
      }

      // Check if user has a booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, payment_status')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookingError) {
        // Continue anyway
      }

      // Check if any booking is completed
      const hasCompletedBooking = booking?.some(b => b.status === 'completed') ?? false;
      const latestBooking = booking?.[0];

      // Create review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          property_id: propertyId,
          reviewer_id: user.id,
          rating,
          content,
          verified_booking: hasCompletedBooking,
          status: 'approved', // Auto-approve reviews for now
          review_eligibility: {
            completed_booking: hasCompletedBooking,
            payment_status: latestBooking?.payment_status || 'none',
            booking_id: latestBooking?.id || null,
            inquiry_id: interactions?.[0]?.id || null,
          },
        });

      if (reviewError) throw reviewError;

      setHasReviewed(true);
      setRating(0);
      setContent('');
      onSuccess();
    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold text-maroon-800 mb-4">
        Write a Review
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Rating Stars */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-maroon-700">
            Rating
          </label>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    star <= (hoverRating || rating)
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Review Content */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-maroon-700">
            Your Review
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your experience with this property..."
            className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
            rows={4}
            minLength={20}
            maxLength={1000}
            required
          />
          <p className="text-sm text-maroon-500">
            {content.length}/1000 characters
          </p>
        </div>

        <Button
          type="submit"
          isLoading={loading}
          disabled={loading || !rating || content.length < 20}
          className="w-full"
        >
          Submit Review
        </Button>
      </form>
    </Card>
  );
};

export default ReviewForm;