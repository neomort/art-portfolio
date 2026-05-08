import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchFavorites, removeFavorite, supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import PropertyCard from '../components/property/PropertyCard';
import { Favorite } from '../types';

const FavoritesPage: React.FC = () => {
  usePageHeaderTitle('Favorites');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyRatings, setPropertyRatings] = useState<Record<string, { rating: number; totalReviews: number }>>({});

  useEffect(() => {
    if (!user) {
      navigate('/signin?redirect=/favorites');
      return;
    }

    let cancelled = false;
    (async () => {
      // Wait for an auth session to ensure requests include Authorization header
      const timeoutMs = 4000;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const { data: sessionData } = await (supabase as any).auth.getSession();
        if (sessionData?.session?.access_token) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (!cancelled) {
        await loadFavorites();
      }
    })();

    return () => { cancelled = true; };
  }, [user, navigate]);

  const loadFavorites = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await fetchFavorites(user.id);
      if (error) throw error;
      
      setFavorites(data || []);
      
      // Calculate ratings for each property
      const ratings: Record<string, { rating: number; totalReviews: number }> = {};
      
      // For each favorited property, fetch its reviews
      for (const favorite of data || []) {
        if (favorite.property) {
          const { data: reviewsData } = await (supabase as any)
            .from('reviews')
            .select('rating')
            .eq('property_id', favorite.property.id);
            
          if (reviewsData && reviewsData.length > 0) {
            const totalRating = (reviewsData as Array<{ rating: number }>).reduce(
              (sum: number, review: { rating: number }) => sum + review.rating, 
              0
            );
            const avgRating = totalRating / reviewsData.length;
            
            ratings[favorite.property.id] = {
              rating: avgRating,
              totalReviews: reviewsData.length
            };
          } else {
            ratings[favorite.property.id] = {
              rating: 0,
              totalReviews: 0
            };
          }
        }
      }
      
      setPropertyRatings(ratings);
    } catch (err) {
      console.error('Error loading favorites:', err);
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (propertyId: string) => {
    if (!user) return;
    
    try {
      await removeFavorite(user.id, propertyId);
      setFavorites(favorites.filter(fav => fav.property_id !== propertyId));
    } catch (err) {
      console.error('Error removing favorite:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove favorite');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8"> 
          <Heart className="h-8 w-8 text-maroon-600 mr-3" />
          <h1 className="text-4xl font-bold text-maroon-800 font-display">
            Favorites
          </h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {favorites.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#121826] mb-2">
              No Favorites Yet
            </h2>
            <p className="text-[#121826] mb-6 max-w-md mx-auto">
              Save properties you're interested in by clicking the heart icon on any property card or detail page.
            </p>
            <Button
              onClick={() => navigate('/properties')}
              variant="primary"
              size="lg"
            >
              Browse Properties
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* PropertyCard now uses PROPERTY_TYPES label via getPropertyTypeLabel utility */}
            {favorites.map((favorite) => 
              favorite.property && (
                <PropertyCard
                  key={favorite.id}
                  property={favorite.property}
                  rating={propertyRatings[favorite.property.id]?.rating || 0}
                  totalReviews={propertyRatings[favorite.property.id]?.totalReviews || 0}
                  isFavorited={true}
                  onToggleFavorite={handleToggleFavorite}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;