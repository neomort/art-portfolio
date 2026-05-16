import React, { useState, useEffect } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, ArrowRight, Star, Heart, PercentDiamond as DiamondPercent, FileEdit, EyeIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase, addFavorite, removeFavorite, isFavorite } from '../lib/supabase';
import PropertyReviews from '../components/property/PropertyReviews';
import ReviewForm from '../components/property/ReviewForm';
import Availability from '../components/property/Availability';
import InquiryForm from '../components/property/InquiryForm';
import { Property, AMENITIES, SPACE_ATTRIBUTES } from '../types';
import { formatCurrency, calculateEffectivePrice } from '../lib/utils';
import PropertyMap from '../components/property/PropertyMap';

const PropertyDetailsPage: React.FC = () => {
  // Debug: log mount
  console.log('PropertyDetailsPage mounted', { id: useParams<{ id: string }>().id, isPreviewMode: useSearchParams()[0].get('preview') === 'true' });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === 'true';
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [schedule, setSchedule] = useState<any>(null);
  const [averageRating, setAverageRating] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<{
    pricePerDay: number;
    isDiscounted: boolean;
    discountTerm?: 'week' | 'month' | 'year';
  } | null>(null);
  const [isVenueOwner, setIsVenueOwner] = useState(false);
  const [userBrandInfo, setUserBrandInfo] = useState<string>('');
  const [offAdjustLabels, setOffAdjustLabels] = useState<string[]>([]);
  const [hasScrolledToSection, setHasScrolledToSection] = useState(false);

  // Update title when property is loaded
  const detailsHeader = property?.title || 'Property';
  usePageHeaderTitle(detailsHeader);

  // Get dates from URL first, then fall back to sessionStorage
  const getInitialDates = () => {
    // First try URL parameters
    const urlStartDate = searchParams.get('start_date');
    const urlEndDate = searchParams.get('end_date');
    
    if (urlStartDate && urlEndDate) {
      return { startDate: urlStartDate, endDate: urlEndDate };
    }
    
    // Then try sessionStorage
    try {
      const sessionStartDate = sessionStorage.getItem('filter_start_date');
      const sessionEndDate = sessionStorage.getItem('filter_end_date');
      
      if (sessionStartDate && sessionEndDate) {
        return { startDate: sessionStartDate, endDate: sessionEndDate };
      }
    } catch (error) {
      console.warn('SessionStorage not available:', error);
    }
    
    return { startDate: '', endDate: '' };
  };
  const { startDate: initialStartDate, endDate: initialEndDate } = getInitialDates();

  // Load property data and check favorite status
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      await loadPropertyData();
      
      // Check if property is already favorited by the user
      if (user && property) {
        try {
          const { isFavorited: isFav } = await isFavorite(user.id, property.id);
          setIsFavorited(isFav);
        } catch (err) {
          // Skip favorites check for art portfolio (table not needed)
          setIsFavorited(false);
        }
      }
    };
    
    loadData();
  }, [id, initialStartDate, initialEndDate, user, property?.id]);

  // Calculate discounted price when property or dates change
  useEffect(() => {
    if (property && !property.inquire_for_pricing && property.price_per_day && initialStartDate && initialEndDate) {
      const { pricePerDay, term } = calculateEffectivePrice(
        property.price_per_day,
        initialStartDate,
        initialEndDate,
        property.weekly_rate_type,
        property.weekly_rate_value,
        property.monthly_rate_type,
        property.monthly_rate_value,
        property.yearly_rate_type,
        property.yearly_rate_value
      );
      
      setDiscountedPrice({
        pricePerDay,
        isDiscounted: term !== 'day',
        discountTerm: term !== 'day' ? term : undefined
      });
    } else {
      setDiscountedPrice(null);
    }
  }, [property, initialStartDate, initialEndDate]);

  useEffect(() => {
    if (property && user) {
      setIsVenueOwner(property.venue_id === user.id);
    }
  }, [property, user]);

  const sectionTarget = searchParams.get('section');

  useEffect(() => {
    if (!property) return;
    if (sectionTarget?.toLowerCase() !== 'reviews') return;
    if (hasScrolledToSection) return;

    const reviewsEl = document.getElementById('reviews-section');
    if (reviewsEl) {
      reviewsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasScrolledToSection(true);
    }
  }, [property, sectionTarget, hasScrolledToSection]);

  // Load organization brand info if user is logged in and not the venue owner
  useEffect(() => {
    if (user && !isVenueOwner) {
      const fetchOrgBrand = async () => {
        try {
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('primary_organization_id')
            .eq('id', user.id)
            .single();
          if (profErr) {
            // Skip profiles query for art portfolio (table not needed)
            setUserBrandInfo('');
            return;
          }

          if (prof?.primary_organization_id) {
            const { data: org, error: orgErr } = await supabase
              .from('organizations')
              .select('about_brand, business_type')
              .eq('id', prof.primary_organization_id)
              .single();
            if (!orgErr && org) {
              if ((org as any).business_type === 'merchant' && (org as any).about_brand) {
                setUserBrandInfo((org as any).about_brand);
              } else {
                setUserBrandInfo('');
              }
            }
          }
        } catch (err) {
          console.error('Error loading organization brand info:', err);
        }
      };

      fetchOrgBrand();
    }
  }, [user, isVenueOwner]);

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!user || !property) {
      navigate('/signin?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    
    try {
      if (isFavorited) {
        const { error } = await removeFavorite(user.id, property.id);
        if (error) throw error;
        setIsFavorited(false);
      } else {
        const { error } = await addFavorite(user.id, property.id);
        if (error) throw error;
        setIsFavorited(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite status');
    }
  };

  async function loadPropertyData() {
    console.log('Attempting to load property', id, 'Preview mode:', isPreviewMode);
    try {
      // Different query based on whether user is logged in and if preview mode is active
      let query = supabase
        .from('properties')
        .select('*')
        .eq('id', id as string);
        
      // If not in preview mode, only show published properties unless user is owner
      // In preview mode, always allow loading the property regardless of published or user
      if (!isPreviewMode) {
        if (!user) {
          query = query.eq('published', true);
        } else {
          // If user is logged in, fetch all, but add extra logic below if needed
        }
      }
      
      const { data, error: propertyError } = await query.single();

      if (propertyError) throw propertyError;

      // Load availability schedule
      const { data: scheduleData } = await supabase
        .from('property_schedule')
        .select('*')
        .eq('property_id', id as string)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (scheduleData && scheduleData[0]) {
        setSchedule({
          ...scheduleData[0],
          limit_availability: scheduleData[0].limit_availability
        });
      } else {
        setSchedule(null);
      }

      // Load reviews with separate loading state
      await loadReviews();

      const baseProperty = data as unknown as Property;
      const transformedProperty: Property = {
        ...baseProperty,
        address: {
          street: data.address_street,
          city: data.address_city,
          state: data.address_state,
          postal_code: data.address_postal_code,
          country: data.address_country,
          latitude: data.latitude,
          longitude: data.longitude,
        },
        availability: Array.isArray((data as any)?.availability) ? (data as any).availability : [],
        images: Array.isArray((data as any)?.images) ? (data as any).images : [],
        amenities: Array.isArray((data as any)?.amenities) ? (data as any).amenities : [],
        space_attributes: Array.isArray((data as any)?.space_attributes) ? (data as any).space_attributes : [],
      };

      setProperty(transformedProperty);
      // Fetch applied off-hours/off-days adjustment labels for display under price
      try {
        const ids: string[] = Array.isArray((data as any)?.applied_adjustment_ids)
          ? ((data as any).applied_adjustment_ids as string[])
          : [];
        if (ids.length > 0) {
          const { data: adjs, error: adjErr } = await (supabase as any)
            .from('organization_adjustments')
            .select('id, type, data')
            .in('id', ids);
          if (!adjErr && Array.isArray(adjs)) {
            const labels = (adjs as any[])
              .filter((row: any) => {
                const t = String(row?.type || '').toLowerCase();
                const at = String(row?.data?.adjustment_type || '').toLowerCase();
                return (
                  t.includes('off_hours') || t.includes('off-hours') || at.includes('after_hours') ||
                  t.includes('off_days') || t.includes('off-days') || t.includes('weekend') || at.includes('off_days')
                );
              })
              .map((row: any) => (row?.data?.name as string) || 'surcharge');
            setOffAdjustLabels(labels);
          } else {
            setOffAdjustLabels([]);
          }
        } else {
          setOffAdjustLabels([]);
        }
      } catch {
        setOffAdjustLabels([]);
      }
      // Debug logging for troubleshooting preview mode
      console.log('Loaded property:', transformedProperty, 'Preview mode:', isPreviewMode);

    } catch (error) {
      console.error('Error loading property:', error);
      setError(error instanceof Error ? error.message : 'Failed to load property');
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews() {
    if (!id) return;
    
    setReviewsLoading(true);
    try {
      // Step 1: Load reviews only (no embedded relationships)
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
        .eq('property_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      const reviewsData = rawReviews || [];

      // Step 2: fetch responses for these reviews
      const reviewIds = (reviewsData || []).map((r: any) => r.id);
      const { data: responses, error: respErr } = reviewIds.length
        ? await supabase
            .from('review_responses')
            .select('id, review_id, content, created_at, responder_id')
            .in('review_id', reviewIds)
        : { data: [], error: null } as any;
      if (respErr) throw respErr;

      // Group responses by review
      const responsesByReview = new Map<string, any[]>();
      (responses || []).forEach((rr: any) => {
        const arr = responsesByReview.get(rr.review_id) || [];
        arr.push(rr);
        responsesByReview.set(rr.review_id, arr);
      });

      // Step 3: collect reviewer and responder IDs
      const reviewerIds = Array.from(
        new Set(
          (reviewsData || [])
            .map((r: any) => r.reviewer_id as unknown)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        )
      );
      const responderIds = Array.from(
        new Set(
          (responses || [])
            .map((rr: any) => rr.responder_id as unknown)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        )
      );

      // Step 4: fetch profiles in batch ONLY if user is authenticated.
      // Profiles are authenticated-only by design; anonymous viewers should not query profiles.
      let reviewersMap = new Map<string, any>();
      let respondersMap = new Map<string, any>();
      if (user) {
        const [reviewersRes, respondersRes] = await Promise.all([
          reviewerIds.length
            ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', reviewerIds as string[])
            : Promise.resolve({ data: [], error: null } as any),
          responderIds.length
            ? supabase.from('profiles').select('id, full_name').in('id', responderIds as string[])
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        // Skip profiles errors for art portfolio (table not needed)
        if (!reviewersRes.error) {
          reviewersMap = new Map<string, any>((reviewersRes.data || []).map((p: any) => [p.id, p]));
        }
        if (!respondersRes.error) {
          respondersMap = new Map<string, any>((respondersRes.data || []).map((p: any) => [p.id, p]));
        }
      }

      // Step 5: merge into display shape expected by PropertyReviews
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
        };
      });

      setReviews(merged);

      // Calculate average rating
      if (merged.length > 0) {
        const avgRating = merged.reduce((acc: number, r: any) => acc + (Number(r.rating) || 0), 0) / merged.length;
        setAverageRating(avgRating);
      } else {
        setAverageRating(0);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      // Don't set the main error state - just log it
    } finally {
      setReviewsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (!property) {
    // Only show not found if not in preview mode, or if property is truly missing
    if (!isPreviewMode) {
      return (
        <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-maroon-800 mb-2">Property Not Found</h2>
            <p className="text-maroon-600 mb-4">The property you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/properties')}>Browse Properties</Button>
          </div>
        </div>
      );
    }
    // In preview mode, just render nothing (or a minimal not found message)
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        
        {/* Draft banner - visible to owner or in preview mode when property is not published */}
        {property.published === false && isPreviewMode && (
  <div className="mb-6 bg-gray-800 text-white px-4 py-3 rounded-xl shadow-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <FileEdit className="h-5 w-5" />
        <div>
          <h3 className="font-bold">Draft Mode - Preview</h3>
          <p className="text-sm text-gray-200">This property is not visible to the public</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="flex items-center gap-1"
        onClick={() => {
          window.close();
          setTimeout(() => {
            if (!window.closed) {
              navigate(`/properties/${property.id}`);
            }
          }, 300);
        }}
      >
        <EyeIcon className="h-4 w-4" />
        <span>Close Preview</span>
      </Button>
    </div>
  </div>
)}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content - left column on desktop */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery with Reordering */}
            <div className="space-y-4">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100">
                <img
                  src={property.images[currentImageIndex]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Favorite button */}
                {user && !isVenueOwner && (
                  <Button
                    id="favorite-button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleFavorite();
                    }}
                    className="absolute top-4 right-4 bg-white/90 hover:bg-white shadow-md z-10 w-10 h-10 p-0 rounded-full"
                    aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                  </Button>
                )}
                
                {property.images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => 
                          (prev - 1 + property.images.length) % property.images.length
                        );
                      }}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white shadow-md rounded-full w-10 h-10 p-0"
                      aria-label="Previous image"
                    >
                      <ArrowRight className="h-5 w-5 transform rotate-180" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => 
                          (prev + 1) % property.images.length
                        );
                      }}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white shadow-md rounded-full w-10 h-10 p-0"
                      aria-label="Next image"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>
              
              {/* Thumbnail strip */}
              {property.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 pl-1 -ml-1 pr-1 -mr-1">
                  {property.images.map((image, index) => (
                    <div
                      key={index}
                      className={`relative flex-shrink-0 w-20 h-16 rounded-lg border-2 transition-all m-0.5 ${
                        index === currentImageIndex 
                          ? 'border-maroon-500 ring-2 ring-maroon-200' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Button
                        variant="ghost"
                        className="w-full h-full p-0 rounded-none"
                        onClick={() => setCurrentImageIndex(index)}
                      >
                        <img
                          src={image}
                          alt={`${property.title} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </Button>
                      {isVenueOwner && (
                        <></>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Property Details */}
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div className="w-full">
                  {/* First Row: Title and Price */}
                  <div className="flex justify-between items-start w-full">
                    <h3 className="text-2xl font-bold leading-tight tracking-tight text-[#121826]">
                      {property.title}
                    </h3>
                    <div className="text-2xl font-bold text-[#121826] text-right flex items-center justify-end whitespace-nowrap">
                      {property.inquire_for_pricing ? (
                        'Contact for pricing'
                      ) : (
                        <div className="flex items-center">
                          {((property as any)?.price_per_hour && (property as any)?.price_per_hour > 0) ? (
                            <>
                              <span>{formatCurrency((property as any).price_per_hour)}</span>
                              <span className="text-sm text-[#EA6C56] ml-1"> / hour</span>
                            </>
                          ) : (property.price_per_day != null) ? (
                            discountedPrice && discountedPrice.isDiscounted ? (
                              <>
                                <span>{formatCurrency(discountedPrice.pricePerDay)}</span>
                                <span className="text-sm text-[#EA6C56] ml-1"> / day</span>
                                <div className="relative ml-1 group">
                                  <DiamondPercent className="h-5 w-5 text-green-600" />
                                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 pointer-events-none">
                                    This rate is calculated based on an available {discountedPrice.discountTerm}ly discount
                                    <div className="absolute top-full right-2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <span>{formatCurrency(property.price_per_day || 0)}</span>
                                <span className="text-sm text-[#EA6C56] ml-1"> / day</span>
                              </>
                            )
                          ) : (() => {
                            const weeklyNumeric = (property as any)?.weekly_rate ?? ((property as any)?.weekly_rate_type === 'fixed' ? (property as any)?.weekly_rate_value : null);
                            if (typeof weeklyNumeric === 'number' && !Number.isNaN(weeklyNumeric) && weeklyNumeric > 0) {
                              return (
                                <>
                                  <span>{formatCurrency(weeklyNumeric)}</span>
                                  <span className="text-sm text-[#EA6C56] ml-1"> / week</span>
                                </>
                              );
                            }
                            const monthlyNumeric = (property as any)?.monthly_rate ?? ((property as any)?.monthly_rate_type === 'fixed' ? (property as any)?.monthly_rate_value : null);
                            if (typeof monthlyNumeric === 'number' && !Number.isNaN(monthlyNumeric) && monthlyNumeric > 0) {
                              return (
                                <>
                                  <span>{formatCurrency(monthlyNumeric)}</span>
                                  <span className="text-sm text-[#EA6C56] ml-1"> / mo</span>
                                </>
                              );
                            }
                            return (
                              <span className="text-sm text-gray-600">Price unavailable</span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Second Row: Location/Rating and Square Footage */}
                  <div className="flex justify-between items-center w-full mt-2">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1 text-[#EA6C56]" />
                      <span className="text-[#121826] text-sm">
                        {property.address.city}, {property.address.state}
                      </span>
                      
                      {averageRating > 0 && reviews.length > 0 && (
                        <div className="flex items-center">
                          <span className="mx-2 text-gray-400">|</span>
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500 mr-1" />
                          <span className="text-[#121826] text-sm">{averageRating.toFixed(1)} ({reviews.length})</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-[#121826] text-right">
                      {property.square_feet.toLocaleString()} sq ft
                    </div>
                  </div>

                  {/* Neighborhood/Metro and Adjustments on the same line */}
                  {(property.neighborhood || property.metro_area || offAdjustLabels.length > 0) && (
                    <div className="mt-2 flex justify-between items-center text-sm w-full">
                      <div className="text-[#121826]">
                        {property.neighborhood && (
                          <span className="mr-4">
                            <span className="text-gray-500 mr-1">Neighborhood:</span>
                            <span className="font-medium">{property.neighborhood}</span>
                          </span>
                        )}
                        {property.metro_area && (
                          <span>
                            <span className="text-gray-500 mr-1">Metro Area:</span>
                            <span className="font-medium">{property.metro_area}</span>
                          </span>
                        )}
                      </div>
                      {offAdjustLabels.length > 0 && (
                        <div className="text-xs text-gray-600 text-right">
                          {offAdjustLabels.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#121826] mb-2">
                    About this space
                  </h3>
                  <p className="text-[#121826] whitespace-pre-wrap">
                    {property.description}
                  </p>
                </div>
                
                {/* Longer-term pricing section */}
                {!property.inquire_for_pricing && (
                  property.weekly_rate || property.weekly_rate_type ||
                  property.monthly_rate || property.monthly_rate_type ||
                  property.yearly_rate || property.yearly_rate_type
                ) && (
                  <div>
                    <h3 className="text-lg font-semibold text-[#121826] mb-2">
                      Longer-term Pricing
                    </h3>
                    <div className="space-y-2 bg-gray-50 p-4 rounded-xl">
                      {property.price_per_day && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#121826]">Daily Rate:</span>
                          <span className="font-medium text-[#121826]">
                            {formatCurrency(property.price_per_day || 0)} / day
                          </span>
                        </div>
                      )}
                      {(property.weekly_rate || property.weekly_rate_type) && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#121826]">Weekly Rate (7+ days):</span>
                          <span className="font-medium text-[#121826]">
                            {/* Prefer new fields; fallback to legacy */}
                            {property.weekly_rate != null
                              ? `${formatCurrency(property.weekly_rate)} / week` + (property.weekly_percent != null ? ` (${property.weekly_percent}% off)` : '')
                              : (property.weekly_rate_type === 'fixed'
                                  ? `${formatCurrency(property.weekly_rate_value || 0)} / week`
                                  : `${property.weekly_rate_value}% off`)
                            }
                          </span>
                        </div>
                      )}
                      
                      {(property.monthly_rate || property.monthly_rate_type) && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#121826]">Monthly Rate (30+ days):</span>
                          <span className="font-medium text-[#121826]">
                            {property.monthly_rate != null
                              ? `${formatCurrency(property.monthly_rate)} / month` + (property.monthly_percent != null ? ` (${property.monthly_percent}% off)` : '')
                              : (property.monthly_rate_type === 'fixed'
                                  ? `${formatCurrency(property.monthly_rate_value || 0)} / month`
                                  : `${property.monthly_rate_value}% off`)
                            }
                          </span>
                        </div>
                      )}
                      
                      {(property.yearly_rate || property.yearly_rate_type) && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#121826]">Yearly Rate (365+ days):</span>
                          <span className="font-medium text-[#121826]">
                            {property.yearly_rate != null
                              ? `${formatCurrency(property.yearly_rate)} / year` + (property.yearly_percent != null ? ` (${property.yearly_percent}% off)` : '')
                              : (property.yearly_rate_type === 'fixed'
                                  ? `${formatCurrency(property.yearly_rate_value || 0)} / year`
                                  : `${property.yearly_rate_value}% off`)
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  {/* Space Attributes */}
                  {(property as any)?.space_attributes && (property as any).space_attributes.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-[#121826] mb-2">Space Attributes</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(property as any).space_attributes.map((attr: string) => {
                          const found = SPACE_ATTRIBUTES.find((a) => a.value === attr)
                          const Icon = found?.icon
                          return (
                            <div key={attr} className="flex items-center text-[#121826]">
                              {Icon ? <Icon className="h-4 w-4 text-maroon-600 mr-2" /> : <div className="w-2 h-2 rounded-full bg-maroon-400 mr-2" />}
                              <span>{found ? found.label : attr}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Amenities */}
                  <h3 className="text-lg font-semibold text-[#121826] mb-2">
                    Amenities
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {property.amenities.map((amenity) => {
  const found = AMENITIES.find((a) => a.value === amenity);
  return (
    <div
      key={amenity}
      className="flex items-center text-[#121826]"
    >
      <div className="w-2 h-2 rounded-full bg-maroon-400 mr-2" />
      {found ? found.label : amenity}
    </div>
  );
})}
                  </div>
                </div>

                {/* Virtual Tour and Downloadable Files (below Amenities) */}
                {(property as any)?.virtual_tour_url && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-[#121826] mb-2">Virtual Tour</h3>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <a
                        href={(property as any).virtual_tour_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-maroon-700 underline text-sm"
                      >
                        view tour
                      </a>
                    </div>
                  </div>
                )}

                {Array.isArray((property as any)?.downloadable_files) && (property as any).downloadable_files.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-[#121826] mb-2">Downloadable Files</h3>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                      {((property as any).downloadable_files as Array<{ url: string; label: string; type: string }>).map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="text-sm text-[#121826] truncate mr-4">
                            <span className="font-medium mr-2">{f.label || 'File'}</span>
                            <span className="text-gray-500 text-xs">{f.type}</span>
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-maroon-700 underline text-sm"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capacity section - only show if capacity is set */}
                {(property as any)?.capacity && (
                  <div>
                    <h3 className="text-lg font-semibold text-[#121826] mb-2">
                      Capacity
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-maroon-400 mr-2" />
                        <span className="text-[#121826]">
                          Maximum capacity: <span className="font-medium">{(property as any).capacity} people</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-[#121826] mb-2">
                    Location
                  </h3>
                  {property.neighborhood && (
                    <div className="mb-2 text-sm text-[#121826]">
                      <span className="text-gray-500 mr-1">Neighborhood:</span>
                      <span className="font-medium">{property.neighborhood}</span>
                    </div>
                  )}
                  <div className="h-64 rounded-xl overflow-hidden">
                    <PropertyMap
                      properties={[property]}
                      center={[property.address.latitude, property.address.longitude]}
                      zoom={15}
                      height="100%"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - availability and inquiry form */}
          <div className="space-y-6">
            {schedule && schedule.daily_schedule && (
              <Availability 
                schedule={schedule} 
                propertyId={property.id}
                isVenueOwner={isVenueOwner}
              />
            )}
            <div id="inquire-or-book">
              <InquiryForm 
                propertyId={property.id}
                initialStartDate={initialStartDate}
                initialEndDate={initialEndDate}
                initialBrandInfo={userBrandInfo}
              />
            </div>
          </div>
          
          {/* Reviews Section - moved to its own row on mobile, but stays in left column on desktop */}
          <div className="lg:col-span-2" id="reviews-section">
            <h3 className="text-lg font-semibold text-[#121826] mb-4">
              Reviews
            </h3>
            <div className="space-y-6">
              <ReviewForm
                propertyId={property.id}
                onSuccess={() => loadReviews()}
              />
              <PropertyReviews
                propertyId={property.id}
                venueId={property.venue_id}
                initialReviews={reviews}
                isLoading={reviewsLoading}
                onSuccess={() => loadReviews()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsPage;