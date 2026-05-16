import React, { useState, useEffect } from 'react';
import { usePageTitle } from '../lib/usePageTitle';
import HeroSection from '../components/home/HeroSection';
import FeaturedProperties from '../components/home/FeaturedProperties';
import { useAuth } from '../contexts/AuthContext';
import HowItWorks from '../components/home/HowItWorks';
import Testimonials from '../components/home/Testimonials';
import { supabase, addFavorite, removeFavorite } from '../lib/supabase';
import { Property } from '../types';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyRatings, setPropertyRatings] = useState<Record<string, { rating: number; totalReviews: number }>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Fixed title for homepage only
  usePageTitle('Art Portfolio - A personal art collection');

  useEffect(() => {
    loadFeaturedProperties();
  }, []);

  // Load user's favorites when user changes
  useEffect(() => {
    if (user) {
      loadFavorites();
    }
  }, [user]);

  // Load user's favorites - disabled for art portfolio (table not needed)
  const loadFavorites = async () => {
    setFavorites({});
  };

  // Toggle favorite status
  const handleToggleFavorite = async (propertyId: string) => {
    if (!user) {
      // Redirect to sign in if not logged in
      window.location.href = `/signin?redirect=${encodeURIComponent('/')}`;
      return;
    }
    
    try {
      if (favorites[propertyId]) {
        // Remove from favorites
        await removeFavorite(user.id, propertyId);
        setFavorites(prev => {
          const newFavorites = { ...prev };
          delete newFavorites[propertyId];
          return newFavorites;
        });
      } else {
        // Add to favorites
        await addFavorite(user.id, propertyId);
        setFavorites(prev => ({
          ...prev,
          [propertyId]: true
        }));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const loadFeaturedProperties = async () => {
    try {
      // Load only featured properties (first 4)
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(4);

      if (propertiesError) throw propertiesError;

      // Transform properties data
      const transformedProperties = propertiesData.map((property: any) => ({
        ...property,
        availability: Array.isArray((property as any).availability) ? (property as any).availability : [],
        address: {
          street: property.address_street ?? null,
          city: property.address_city ?? null,
          state: property.address_state ?? null,
          // Standard camelCase while preserving legacy underscore for compatibility
          postalCode: property.address_postal_code ?? null,
          postal_code: property.address_postal_code ?? null,
          country: property.address_country ?? null,
          latitude: property.latitude ?? null,
          longitude: property.longitude ?? null
        }
      }));

      setProperties(transformedProperties as any);

      // Load ratings for each property
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('property_id, rating')
        .in('property_id', transformedProperties.map(p => p.id))
        .eq('status', 'approved');

      // Skip reviews error for art portfolio (table might not exist)
      if (reviewsError) {
        console.warn('Reviews query failed (table might not exist):', reviewsError);
      }

      // Calculate average ratings and total reviews
      const ratings: Record<string, { rating: number; totalReviews: number }> = {};
      reviewsData?.forEach(review => {
        if (!ratings[review.property_id]) {
          ratings[review.property_id] = { rating: 0, totalReviews: 0 };
        }
        ratings[review.property_id].rating += review.rating;
        ratings[review.property_id].totalReviews++;
      });

      // Calculate averages
      Object.keys(ratings).forEach(propertyId => {
        ratings[propertyId].rating = ratings[propertyId].rating / ratings[propertyId].totalReviews;
      });

      setPropertyRatings(ratings);
    } catch (err) {
      console.error('Error loading featured properties:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="bg-[#FEFAF8]">
          <HeroSection />
          <div className="bg-[#FEFAF8]">
            <HowItWorks />
          </div>
          <div className="py-24 bg-[#FEFAF8]">
            <div className="container mx-auto px-4">
              <div className="animate-pulse space-y-8">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-96 bg-gray-200 rounded-xl"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-[#FEFAF8]">
            <Testimonials />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FEFAF8]">
      <HeroSection />
      <HowItWorks />
      <FeaturedProperties 
        properties={properties.map(property => ({
          ...property,
          rating: propertyRatings[property.id]?.rating || 0,
          totalReviews: propertyRatings[property.id]?.totalReviews || 0,
        }))}
        isFavorited={favorites}
        onToggleFavorite={handleToggleFavorite}
      />
      <Testimonials />
    </div>
  );
};

export default HomePage;