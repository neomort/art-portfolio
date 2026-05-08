import React, { useState, useEffect } from 'react';
import { Star, Search, Filter, ArrowUpDown, BarChart2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

interface ReviewManagementProps {
  propertyId: string;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  responseRate: number;
  ratingDistribution: Record<number, number>;
}

const ReviewManagement: React.FC<ReviewManagementProps> = ({ propertyId }) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [ratingFilter, setRatingFilter] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [stats, setStats] = useState<ReviewStats>({
    averageRating: 0,
    totalReviews: 0,
    responseRate: 0,
    ratingDistribution: {},
  });

  useEffect(() => {
    loadReviews();
  }, [propertyId]);

  const loadReviews = async () => {
    try {
      const { data, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:profiles!reviewer_id(full_name, avatar_url),
          response:review_responses(
            id,
            content,
            created_at,
            responder:profiles!responder_id(full_name)
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      setReviews(data || []);

      // Calculate statistics
      if (data) {
        const totalReviews = data.length;
        const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;
        const responsesCount = data.filter(review => review.response?.length > 0).length;
        const responseRate = totalReviews > 0 ? (responsesCount / totalReviews) * 100 : 0;

        // Calculate rating distribution
        const distribution = data.reduce((acc, review) => {
          acc[review.rating] = (acc[review.rating] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        setStats({
          averageRating,
          totalReviews,
          responseRate,
          ratingDistribution: distribution,
        });
      }
    } catch (err) {
      console.error('Error loading reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (reviewId: string, content: string) => {
    try {
      const { error } = await supabase
        .from('review_responses')
        .insert({
          responder_id: (await supabase.auth.getUser()).data.user?.id,
          review_id: reviewId,
          content,
        });

      if (error) throw error;
      await loadReviews();
    } catch (err) {
      console.error('Error responding to review:', err);
      setError(err instanceof Error ? err.message : 'Failed to respond to review');
    }
  };

  const filteredReviews = reviews
    .filter(review => {
      // Search filter
      if (searchTerm && !review.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Date range filter
      if (dateRange.start && new Date(review.created_at) < new Date(dateRange.start)) {
        return false;
      }
      if (dateRange.end && new Date(review.created_at) > new Date(dateRange.end)) {
        return false;
      }

      // Rating filter
      if (ratingFilter.length > 0 && !ratingFilter.includes(review.rating)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc'
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return sortOrder === 'desc'
          ? b.rating - a.rating
          : a.rating - b.rating;
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div data-testid="loading-indicator" className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-maroon-600">Average Rating</h4>
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-maroon-900">
                {stats.averageRating.toFixed(1)}
              </p>
              <p className="ml-2 text-sm text-maroon-500">out of 5</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-maroon-600">Total Reviews</h4>
              <BarChart2 className="h-5 w-5 text-maroon-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-maroon-900">
              {stats.totalReviews}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-maroon-600">Response Rate</h4>
              <Filter className="h-5 w-5 text-maroon-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-maroon-900">
              {stats.responseRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-maroon-600">Rating Distribution</h4>
              <BarChart2 className="h-5 w-5 text-maroon-500" />
            </div>
            <div className="mt-2 space-y-1">
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} className="flex items-center text-sm">
                  <span className="w-3">{rating}</span>
                  <div className="ml-2 flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-maroon-500"
                      style={{
                        width: `${(stats.ratingDistribution[rating] || 0) / stats.totalReviews * 100}%`
                      }}
                    />
                  </div>
                  <span className="ml-2 text-maroon-600">
                    {stats.ratingDistribution[rating] || 0}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
            <div className="w-full md:flex-1">
              <Input
                type="text"
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="h-5 w-5" />}
              />
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:gap-2 md:items-center">
              <Button
                variant="outline"
                onClick={() => setSortBy(sortBy === 'date' ? 'rating' : 'date')}
              >
                Sort by {sortBy === 'date' ? 'Rating' : 'Date'}
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
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
            </div>

            <p className="mt-4 text-maroon-700">{review.content}</p>

            {/* Owner Response */}
            {review.response?.[0] ? (
              <div className="mt-4 pl-4 border-l-2 border-maroon-100">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-maroon-800">Your Response</span>
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
            ) : (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSelectedReview(review.id);
                  setShowResponseModal(true);
                }}
              >
                Respond to Review
              </Button>
            )}
          </Card>
        ))}

        {/* Response Modal */}
        {showResponseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
              <h3 className="text-xl font-semibold text-maroon-800 mb-4">
                Respond to Review
              </h3>
              
              <div className="space-y-4">
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Write your response..."
                  className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-sm text-maroon-500 text-right">
                  {responseText.length}/500 characters
                </p>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedReview(null);
                    setResponseText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (selectedReview && responseText.trim()) {
                      await handleResponse(selectedReview, responseText);
                      setShowResponseModal(false);
                      setSelectedReview(null);
                      setResponseText('');
                    }
                  }}
                  disabled={!responseText.trim()}
                >
                  Post Response
                </Button>
              </div>
            </div>
          </div>
        )}

        {filteredReviews.length === 0 && (
          <div className="text-center py-8">
            <Star className="h-12 w-12 text-maroon-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-maroon-800 mb-2">
              No Reviews Found
            </h3>
            <p className="text-maroon-600">
              {searchTerm ? 'Try adjusting your search filters' : 'No reviews yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewManagement;