import React, { useState, useEffect } from 'react';
import { Star, Flag } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  verified_booking: boolean;
  reviewer: {
    full_name: string;
    avatar_url?: string;
  };
  response: {
    id: string;
    content: string;
    created_at: string;
    responder: {
      full_name: string;
    };
  }[];
}

interface PropertyReviewsProps {
  propertyId: string;
  venueId: string;
  initialReviews?: Review[];
  isLoading?: boolean;
  onSuccess?: () => void;
}

const PropertyReviews: React.FC<PropertyReviewsProps> = ({ 
  propertyId, 
  venueId,
  initialReviews = [],
  isLoading: externalLoading = false,
  onSuccess
}) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [loading, setLoading] = useState(externalLoading || initialReviews.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [showResponseForm, setShowResponseForm] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified'>('all');
  const [sort, setSort] = useState<'recent' | 'rating'>('recent');

  // Fetch reviews if not provided as props
  useEffect(() => {
    // Update reviews when initialReviews changes
    if (initialReviews && initialReviews.length > 0) {
      setReviews(initialReviews);
      return;
    }
    
    // Only fetch if initialReviews is empty
    if (initialReviews.length === 0) {
      fetchReviews();
    }
  }, [initialReviews, propertyId]);

  const fetchReviews = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Fetch reviews only (no embedded relationships)
      const { data: rawReviews, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          content,
          created_at,
          verified_booking,
          reviewer_id,
          property_id,
          status
        `)
        .eq('property_id', propertyId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      const reviewsData = rawReviews || [];

      // Step 2: Fetch responses for these reviews
      const reviewIds = (reviewsData || []).map((r: any) => r.id);
      const { data: responses, error: respErr } = reviewIds.length
        ? await supabase
            .from('review_responses')
            .select('id, review_id, content, created_at, responder_id')
            .in('review_id', reviewIds)
        : { data: [], error: null } as any;
      if (respErr) throw respErr;

      // Group responses by review_id
      const responsesByReview = new Map<string, any[]>();
      (responses || []).forEach((rr: any) => {
        const arr = responsesByReview.get(rr.review_id) || [];
        arr.push(rr);
        responsesByReview.set(rr.review_id, arr);
      });

      // Step 3: Collect reviewer and responder IDs
      const reviewerIds = Array.from(new Set((reviewsData || []).map((r: any) => r.reviewer_id).filter(Boolean)));
      const responderIds = Array.from(new Set((responses || []).map((rr: any) => rr.responder_id).filter(Boolean)));

      // Step 4: Fetch reviewer and responder profiles in batch
      const [reviewersRes, respondersRes] = await Promise.all([
        reviewerIds.length
          ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', reviewerIds)
          : Promise.resolve({ data: [], error: null } as any),
        responderIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', responderIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (reviewersRes.error) throw reviewersRes.error;
      if (respondersRes.error) throw respondersRes.error;

      const reviewersMap = new Map<string, any>(
        (reviewersRes.data || []).map((p: any) => [p.id, p])
      );
      const respondersMap = new Map<string, any>(
        (respondersRes.data || []).map((p: any) => [p.id, p])
      );

      // Step 5: Merge profiles and responses into the review objects
      const merged = (reviewsData || []).map((r: any) => {
        const reviewer = reviewersMap.get(r.reviewer_id) || { full_name: 'Anonymous', avatar_url: undefined };
        const rrList = responsesByReview.get(r.id) || [];
        const resp = rrList.map((rr: any) => ({
          id: rr.id,
          content: rr.content,
          created_at: rr.created_at,
          responder: { full_name: (respondersMap.get(rr.responder_id)?.full_name) || 'Owner' },
        }));
        return {
          id: r.id,
          rating: r.rating,
          content: r.content,
          created_at: r.created_at,
          verified_booking: r.verified_booking,
          reviewer: {
            full_name: reviewer.full_name,
            avatar_url: reviewer.avatar_url,
          },
          response: resp,
        } as Review;
      });

      setReviews(merged);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('review_responses')
        .insert({
          review_id: reviewId,
          responder_id: user!.id,
          content: response,
        });

      if (error) throw error;
      
      setShowResponseForm(null);
      setResponse('');
      
      // Refresh reviews after posting response
      fetchReviews();
      
      // Trigger parent component to reload reviews
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error posting response:', err);
      setError(err instanceof Error ? err.message : 'Failed to post response');
    }
  };

  // Filter and sort reviews
  const displayedReviews = React.useMemo(() => {
    let filtered = filter === 'verified'
      ? reviews.filter(review => review.verified_booking)
      : reviews;
    
    return [...filtered].sort((a, b) => {
      if (sort === 'rating') {
        return b.rating - a.rating;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [reviews, filter, sort]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display with retry button */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4">
          <p className="font-medium">Error loading reviews</p>
          <p className="text-sm">{error}</p>
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchReviews}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      {reviews.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filter === 'verified'}
                onChange={(e) => setFilter(e.target.checked ? 'verified' : 'all')}
                className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
              />
              <span className="text-maroon-700">Verified reviews</span>
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'rating')}
              className="rounded-lg border-2 border-maroon-200 text-maroon-800"
            >
              <option value="recent">Most Recent</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {displayedReviews.map((review) => (
          <Card key={review.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {review.reviewer.avatar_url ? (
                  <img
                    src={review.reviewer.avatar_url}
                    alt={review.reviewer.full_name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-maroon-100 flex items-center justify-center">
                    <span className="text-maroon-600 font-medium">
                      {review.reviewer.full_name[0]}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-maroon-800">
                      {review.reviewer.full_name}
                    </span>
                    {review.verified_booking && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Verified Booking
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-maroon-500">
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="text-maroon-500 hover:text-maroon-600"
                title="Report review"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-maroon-700">{review.content}</p>

            {/* Owner Response */}
            {review.response && review.response.length > 0 && (
              <div className="mt-4 pl-4 border-l-2 border-maroon-100">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-maroon-800">
                    {review.response[0].responder.full_name}
                  </span>
                  <span className="text-xs bg-maroon-100 text-maroon-700 px-2 py-0.5 rounded-full">
                    Owner
                  </span>
                </div>
                <p className="mt-2 text-maroon-600">
                  {review.response[0].content}
                </p>
                <p className="mt-1 text-sm text-maroon-500">
                  {formatDate(review.response[0].created_at)}
                </p>
              </div>
            )}

            {/* Response Form for Owners */}
            {user?.id === venueId &&
              (!review.response || review.response.length === 0) &&
              (showResponseForm === review.id ? (
                <div className="mt-4">
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Write your response..."
                    className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowResponseForm(null);
                        setResponse('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleResponse(review.id)}
                      disabled={!response.trim()}
                    >
                      Post Response
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowResponseForm(review.id)}
                >
                  Respond to Review
                </Button>
              ))}
          </Card>
        ))}

        {displayedReviews.length === 0 && (
          <div className="text-center py-8">
            <Star className="h-12 w-12 text-maroon-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-maroon-800 mb-2">
              No Reviews Yet
            </h3>
            <p className="text-maroon-600">
              Be the first to review this property
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyReviews;