import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sliders, Map, Grid, Cuboid } from 'lucide-react';
import { supabase, addFavorite, removeFavorite } from '../lib/supabase';
import { geocodeAddress } from '../lib/geocoding';
import { Property, PROPERTY_TYPES } from '../types';
import PropertyCard from '../components/property/PropertyCard';
import PropertyMap from '../components/property/PropertyMap';
import PropertyFilters from '../components/property/PropertyFilters';
import { calculateDistance } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { usePageHeaderTitle } from '../lib/usePageTitle';

// Typed row shapes for query results
type PropertyRow = {
  id: string;
  title?: string;
  reviews?: { rating: number }[];
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ScheduleRow = {
  property_id: string;
  available_from: string | null;
  available_until: string | null;
  limit_availability: boolean | null;
  daily_schedule: any;
  updated_at: string;
};

type AvailabilityRow = {
  property_id: string;
  start_date: string;
  end_date: string;
};

type FavoriteRow = { property_id: string };

// Define sidebar view type
type SidebarView = 'filters' | 'map' | 'none';

type FiltersState = {
  priceRange: [number, number];
  squareFeet: [number, number];
  searchRadius: number;
  propertyTypes: string[];
  amenities: string[];
  location: string;
  organizationId: string;
  sortBy: SortValue;
};

const ITEMS_PER_PAGE = 99;
const SORT_VALUES = [
  'recently_listed',
  'price_low_high',
  'price_high_low',
  'size_small_large',
  'size_large_small',
  'property_type',
  'distance',
] as const;
type SortValue = (typeof SORT_VALUES)[number];

const DEFAULT_SORT: SortValue = 'recently_listed';
const SORT_VALUE_SET = new Set<SortValue>(SORT_VALUES);

const PROPERTY_TYPE_LABEL_MAP = PROPERTY_TYPES.reduce((acc, type) => {
  acc[type.value] = type.label;
  return acc;
}, {} as Record<string, string>);

const getPropertyTypeLabel = (propertyType?: string | null) => {
  if (!propertyType) return '';
  return PROPERTY_TYPE_LABEL_MAP[propertyType] || propertyType.replace(/_/g, ' ');
};

const computeNormalizedDailyPrice = (property: Property) => {
  const toNumber = (value: unknown) => {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const daily = toNumber(property.price_per_day);
  if (daily != null) return daily;

  const hourly = toNumber(property.price_per_hour);
  if (hourly != null) return hourly * 10;

  const weekly = toNumber(property.weekly_rate_value);
  if (weekly != null) return weekly / 7;

  const monthly = toNumber(property.monthly_rate_value);
  if (monthly != null) return monthly / 30;

  const yearly = toNumber((property as any).yearly_rate_value);
  if (yearly != null) return yearly / 365;

  return Number.POSITIVE_INFINITY;
};

const compareByTitle = (a: Property, b: Property) => {
  return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
};

const getDistanceValue = (
  property: Property,
  coords: { lat: number | null; lng: number | null }
) => {
  if (!coords || coords.lat == null || coords.lng == null) {
    return Number.POSITIVE_INFINITY;
  }
  const lat = property.address?.latitude;
  const lng = property.address?.longitude;
  if (lat == null || lng == null) {
    return Number.POSITIVE_INFINITY;
  }
  return calculateDistance(coords.lat, coords.lng, lat, lng);
};

const compareNumericAscending = (a: number, b: number) => {
  const aFinite = Number.isFinite(a);
  const bFinite = Number.isFinite(b);
  if (aFinite && bFinite) {
    if (a === b) return 0;
    return a - b;
  }
  if (aFinite) return -1;
  if (bFinite) return 1;
  return 0;
};

const compareNumericDescending = (a: number, b: number) => {
  const aFinite = Number.isFinite(a);
  const bFinite = Number.isFinite(b);
  if (aFinite && bFinite) {
    if (a === b) return 0;
    return b - a;
  }
  if (aFinite) return -1;
  if (bFinite) return 1;
  return 0;
};

const parseSortValue = (value: string | null): SortValue => {
  if (value && SORT_VALUE_SET.has(value as SortValue)) {
    return value as SortValue;
  }
  return DEFAULT_SORT;
};

const PropertiesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [orgHeaderName, setOrgHeaderName] = useState<string | null>(null);
  const [propertyRatings, setPropertyRatings] = useState<Record<string, { rating: number; totalReviews: number }>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Replace showFilters boolean with sidebarView state with mobile detection
  const [sidebarView, setSidebarView] = useState<SidebarView>(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // URL override: ?view=map|filters|full
    const viewParam = (searchParams.get('view') || '').toLowerCase();
    const urlView: SidebarView | null = viewParam === 'map'
      ? 'map'
      : viewParam === 'filters'
        ? 'filters'
        : viewParam === 'full'
          ? 'none'
          : null;
    if (urlView) return urlView;

    if (isMobile) {
      return 'none'; // Default to full view on mobile
    }
    
    // Get saved preference from localStorage or default to 'map' on desktop
    return (localStorage.getItem('propertiesSidebarView') as SidebarView) || 'map';
  });

  // Page title: SplitSpace - [header text]
  const headerText = orgHeaderName || 'Available Spaces';
  usePageHeaderTitle(headerText);

  

  

  // Determine if URL has an org indicator (org_id only for now)
  const hasOrgParam = useMemo(() => {
    return !!searchParams.get('org_id');
  }, [searchParams]);

  // Org readiness gate: block initial fetch until org is resolved if URL contains org param
  const [orgReady, setOrgReady] = useState<boolean>(() => {
    // If org_id present, we're ready immediately due to initial filters.organizationId
    if (searchParams.get('org_id')) return true;
    return !hasOrgParam; // ready if no org param
  });

  // (moved) Mark ready once organizationId is set or we determined no match

  // Use state for coordinates so we can update them
  const [coordinates, setCoordinates] = useState<{lat: number | null, lng: number | null}>({
    lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null,
    lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null,
  });
  // Initialize date filters from URL params or sessionStorage
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

  // Simplified filters state with separate tracking for dates
  const [dateFilters, setDateFilters] = useState(getInitialDates);
  
  // Initialize property types from URL 'type' parameter
  const getInitialPropertyTypes = (): string[] => {
    const typeParam = searchParams.get('type');
    if (typeParam) {
      // Convert to the format expected by the filter (lowercase with underscores)
      const formattedType = typeParam.toLowerCase().replace(/\s+/g, '_');
      return [formattedType];
    }
    return [];
  };
  
  const [filters, setFilters] = useState<FiltersState>({
    priceRange: [0, 5000],
    squareFeet: [0, 10000],
    searchRadius: 25,
    propertyTypes: getInitialPropertyTypes(),
    amenities: [] as string[],
    location: searchParams.get('location') || '',
    organizationId: searchParams.get('org_id') || '',
    sortBy: parseSortValue(searchParams.get('sort')),
  });

  const totalPages = Math.max(1, Math.ceil(properties.length / ITEMS_PER_PAGE));
  const sortedProperties = useMemo(() => {
    const list = [...properties];
    switch (filters.sortBy) {
      case 'price_low_high':
        list.sort((a, b) => {
          const priceA = computeNormalizedDailyPrice(a);
          const priceB = computeNormalizedDailyPrice(b);
          const compare = compareNumericAscending(priceA, priceB);
          return compare !== 0 ? compare : compareByTitle(a, b);
        });
        break;
      case 'price_high_low':
        list.sort((a, b) => {
          const priceA = computeNormalizedDailyPrice(a);
          const priceB = computeNormalizedDailyPrice(b);
          const compare = compareNumericDescending(priceA, priceB);
          return compare !== 0 ? compare : compareByTitle(a, b);
        });
        break;
      case 'size_small_large':
        list.sort((a, b) => {
          const sizeA = a.square_feet ?? Number.POSITIVE_INFINITY;
          const sizeB = b.square_feet ?? Number.POSITIVE_INFINITY;
          const compare = compareNumericAscending(sizeA, sizeB);
          return compare !== 0 ? compare : compareByTitle(a, b);
        });
        break;
      case 'size_large_small':
        list.sort((a, b) => {
          const sizeA = a.square_feet ?? Number.NEGATIVE_INFINITY;
          const sizeB = b.square_feet ?? Number.NEGATIVE_INFINITY;
          const compare = compareNumericDescending(sizeA, sizeB);
          return compare !== 0 ? compare : compareByTitle(a, b);
        });
        break;
      case 'property_type':
        list.sort((a, b) => {
          const typeA = getPropertyTypeLabel(a.property_type).toLowerCase();
          const typeB = getPropertyTypeLabel(b.property_type).toLowerCase();
          const compare = typeA.localeCompare(typeB, undefined, { sensitivity: 'base' });
          return compare !== 0 ? compare : compareByTitle(a, b);
        });
        break;
      case 'distance':
        list.sort((a, b) => {
          const distA = getDistanceValue(a, coordinates);
          const distB = getDistanceValue(b, coordinates);
          const compare = compareNumericAscending(distA, distB);
          return compare !== 0 ? compare : compareByTitle(a, b);
        });
        break;
      case 'recently_listed':
      default:
        list.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          if (dateA === dateB) {
            return compareByTitle(b, a);
          }
          return dateB - dateA;
        });
        break;
    }
    return list;
  }, [properties, filters.sortBy, coordinates]);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedProperties.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedProperties, currentPage]);
  const paginationStartIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginationEndIndex = Math.min(properties.length, paginationStartIndex + paginatedProperties.length);
  const hasPagination = properties.length > ITEMS_PER_PAGE;

  const previousFiltersRef = useRef(filters);
  const previousDateFiltersRef = useRef(dateFilters);
  const previousCoordinatesRef = useRef(coordinates);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const filtersChanged = previousFiltersRef.current !== filters;
    const datesChanged = previousDateFiltersRef.current !== dateFilters;
    const coordsChanged =
      previousCoordinatesRef.current.lat !== coordinates.lat ||
      previousCoordinatesRef.current.lng !== coordinates.lng;

    if (filtersChanged || datesChanged || coordsChanged) {
      setCurrentPage(1);
    }

    previousFiltersRef.current = filters;
    previousDateFiltersRef.current = dateFilters;
    previousCoordinatesRef.current = coordinates;
  }, [filters, dateFilters, coordinates]);

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  // Initialize filters from URL params (type, amenities, radius) once
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const amenitiesParam = searchParams.get('amenities');
    const radiusParam = searchParams.get('radius') || searchParams.get('r');
    setFilters(prev => ({
      ...prev,
      propertyTypes: typeParam ? typeParam.split(',').map(s => s.trim()).filter(Boolean) : prev.propertyTypes,
      amenities: amenitiesParam ? amenitiesParam.split(',').map(s => s.trim()).filter(Boolean) : prev.amenities,
      searchRadius: radiusParam ? Math.max(0, Math.min(500, parseInt(radiusParam, 10) || prev.searchRadius)) : prev.searchRadius,
      sortBy: parseSortValue(searchParams.get('sort')),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with current view selection
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    const viewStr = sidebarView === 'none' ? 'full' : sidebarView;
    newParams.set('view', viewStr);
    setSearchParams(newParams);
  }, [sidebarView]);

  // Keep URL in sync with coordinates
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (coordinates.lat != null) newParams.set('lat', String(coordinates.lat));
    if (coordinates.lng != null) newParams.set('lng', String(coordinates.lng));
    setSearchParams(newParams);
  }, [coordinates.lat, coordinates.lng]);

  // Keep URL in sync with filters (radius, type, amenities)
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (filters.searchRadius != null) newParams.set('radius', String(filters.searchRadius));
    if (filters.propertyTypes?.length) newParams.set('type', filters.propertyTypes.join(',')); else newParams.delete('type');
    if (filters.amenities?.length) newParams.set('amenities', filters.amenities.join(',')); else newParams.delete('amenities');
    if (filters.sortBy && filters.sortBy !== DEFAULT_SORT) {
      newParams.set('sort', filters.sortBy);
    } else {
      newParams.delete('sort');
    }
    setSearchParams(newParams);
  }, [filters.searchRadius, filters.propertyTypes, filters.amenities, filters.sortBy]);

  // Resolve organization from URL (org_id only)
  useEffect(() => {
    (async () => {
      if (filters.organizationId) return; // already selected
      const orgIdParam = searchParams.get('org_id');
      if (orgIdParam) {
        setFilters((prev) => ({ ...prev, organizationId: orgIdParam }));
        return;
      }
      // If we got here without setting organizationId, proceed unfiltered
      if (!filters.organizationId) setOrgReady(true);
    })();
  }, [searchParams, filters.organizationId]);

  // Load favorites when user changes
  useEffect(() => {
    if (user) {
      loadFavorites();
    }
  }, [user]);

  // Save sidebar view preference
  useEffect(() => {
    localStorage.setItem('propertiesSidebarView', sidebarView);
  }, [sidebarView]);

  // Save date filters to sessionStorage and URL when they change
  useEffect(() => {
    try {
      if (dateFilters.startDate && dateFilters.endDate) {
        sessionStorage.setItem('filter_start_date', dateFilters.startDate);
        sessionStorage.setItem('filter_end_date', dateFilters.endDate);
        
        // Update URL parameters
        const newParams = new URLSearchParams(searchParams);
        newParams.set('start_date', dateFilters.startDate);
        newParams.set('end_date', dateFilters.endDate);
        setSearchParams(newParams);
      } else if (!dateFilters.startDate && !dateFilters.endDate) {
        // Clear sessionStorage and URL when dates are empty
        sessionStorage.removeItem('filter_start_date');
        sessionStorage.removeItem('filter_end_date');
        
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('start_date');
        newParams.delete('end_date');
        setSearchParams(newParams);
      }
    } catch (error) {
      console.warn('SessionStorage not available:', error);
    }
  }, [dateFilters, searchParams, setSearchParams]);

  // Load user's favorites
  const loadFavorites = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('favorites')
        .select('property_id')
        .eq('user_id', user.id);
      
      const favMap: Record<string, boolean> = {};
      const rows: FavoriteRow[] = (data as FavoriteRow[] | null) ?? [];
      rows.forEach((fav) => {
        favMap[fav.property_id] = true;
      });
      
      setFavorites(favMap);
    } catch (err) {
      console.error('Error loading favorites:', err);
    }
  };

  // Toggle favorite status
  const handleToggleFavorite = async (propertyId: string) => {
    if (!user) {
      // Redirect to sign in if not logged in
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
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

  // Move loadProperties outside useEffect to make it accessible throughout the component
  async function loadProperties() {
    try {
      // Note: Do not block loading if org slug can't be resolved; load unfiltered and log for diagnostics

      let query = supabase
        .from('properties')
        .select('*, reviews(rating)')
        // Only show published properties to the public
        .eq('published', true);

      // Apply basic filters
      if (filters.priceRange[0] > 0 || filters.priceRange[1] < 5000) {
        query = query
          .or(
            `inquire_for_pricing.eq.true,and(price_per_day.gte.${filters.priceRange[0]},price_per_day.lte.${filters.priceRange[1]})`
          );
      }

      if (filters.squareFeet[0] > 0 || filters.squareFeet[1] < 10000) {
        query = query
          .gte('square_feet', filters.squareFeet[0])
          .lte('square_feet', filters.squareFeet[1]);
      }

      if (filters.propertyTypes.length > 0) {
        const formattedTypes = filters.propertyTypes.map(type => 
          type.toLowerCase().replace(/\s+/g, '_')
        );
        query = query.in('property_type', formattedTypes);
        
        // Update URL with property type filter if not already there
        if (filters.propertyTypes.length === 1 && !searchParams.has('type')) {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('type', filters.propertyTypes[0]);
          setSearchParams(newParams);
        }
      }

      if (filters.amenities.length > 0) {
        query = query.contains('amenities', filters.amenities);
      }

      // Filter by organization when selected
      if (filters.organizationId) {
        if (typeof window !== 'undefined') {
          console.log('[PropertiesPage] Applying org filter', filters.organizationId);
        }
        query = query.eq('organization_id', filters.organizationId);
      }

      const currentSeq = querySeqRef.current;
      const { data, error: queryError } = await query as unknown as { data: PropertyRow[]; error: any };

      if (queryError) throw queryError;

      // Transform the properties data into full Property objects required by UI
      let transformedProperties: Property[] = (data || []).map((property: PropertyRow) => {
        const reviews = property.reviews || [];
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
          ? reviews.reduce((acc: number, review: any) => acc + review.rating, 0) / totalReviews
          : 0;

        setPropertyRatings(prev => ({
          ...prev,
          [property.id]: { rating: averageRating, totalReviews }
        }));

        const base: any = property as any;
        const full: Property = {
          id: property.id,
          title: base.title ?? '',
          description: base.description ?? '',
          address: {
            street: property.address_street ?? '',
            city: property.address_city ?? '',
            state: property.address_state ?? '',
            postal_code: property.address_postal_code ?? '',
            country: property.address_country ?? '',
            latitude: property.latitude ?? 0,
            longitude: property.longitude ?? 0,
          },
          address_city: property.address_city ?? undefined,
          address_state: property.address_state ?? undefined,
          images: Array.isArray(base.images) ? base.images : [],
          price_per_day: base.price_per_day ?? undefined,
          price_per_hour: base.price_per_hour ?? undefined,
          inquire_for_pricing: base.inquire_for_pricing ?? false,
          square_feet: base.square_feet ?? 0,
          amenities: Array.isArray(base.amenities) ? base.amenities : [],
          weekly_rate_type: base.weekly_rate_type ?? null,
          weekly_rate_value: base.weekly_rate_value ?? null,
          monthly_rate_type: base.monthly_rate_type ?? null,
          monthly_rate_value: base.monthly_rate_value ?? null,
          yearly_rate_type: base.yearly_rate_type ?? null,
          yearly_rate_value: base.yearly_rate_value ?? null,
          property_type: base.property_type ?? 'other',
          availability: Array.isArray(base.availability) ? base.availability : [],
          venue_id: base.venue_id ?? '',
          created_at: base.created_at ?? new Date(0).toISOString(),
          updated_at: base.updated_at ?? new Date(0).toISOString(),
          featured: base.featured ?? false,
          published: base.published ?? true,
          profiles: base.profiles,
        };
        return full;
      });
      
      // Apply date filtering if dates are selected
      if (dateFilters.startDate && dateFilters.endDate) {
        console.log('Applying date filters:', dateFilters);
        
        const startDateObj = new Date(dateFilters.startDate);
        const endDateObj = new Date(dateFilters.endDate);
        
        // Get all schedule data at once - but get the MOST RECENT schedule for each property
        const { data: allScheduleData } = await supabase
          .from('property_schedule')
          .select('property_id, available_from, available_until, limit_availability, daily_schedule, updated_at')
          .order('updated_at', { ascending: false });
        
        // Group schedules by property_id and take the most recent one for each property
        // Using plain object instead of Map to avoid "Map is not a constructor" error
        const scheduleMap: Record<string, ScheduleRow> = {};
        (allScheduleData as ScheduleRow[] | null | undefined)?.forEach((schedule: ScheduleRow) => {
          if (!scheduleMap[schedule.property_id]) {
            scheduleMap[schedule.property_id] = schedule;
          }
        });
        
        const scheduleData: ScheduleRow[] = Object.values(scheduleMap);
        
        const { data: availabilityData } = await supabase
          .from('property_availability')
          .select('property_id, start_date, end_date');
        
        console.log('Schedule data (most recent per property):', scheduleData);
        console.log('Availability data:', availabilityData);
        
        transformedProperties = transformedProperties.filter(property => {
          const scheduleEntry = scheduleData?.find((s: ScheduleRow) => s.property_id === property.id);
          
          console.log(`Checking property ${property.title} (${property.id}):`, scheduleEntry);
          
          // **STEP 1: Check Date Range Restrictions**
          // This is completely independent of limit_availability
          if (scheduleEntry) {
            // Check available_from date restriction
            if (scheduleEntry.available_from) {
              const availableFrom = new Date(scheduleEntry.available_from);
              console.log(`Property ${property.title} available from: ${availableFrom}, user start date: ${startDateObj}`);
              if (startDateObj < availableFrom) {
                console.log(`Property ${property.title} not yet available (before ${availableFrom.toDateString()}) - excluding`);
                return false;
              }
            }
            
            // Check available_until date restriction
            if (scheduleEntry.available_until) {
              const availableUntil = new Date(scheduleEntry.available_until);
              console.log(`Property ${property.title} available until: ${availableUntil}, user end date: ${endDateObj}`);
              if (endDateObj > availableUntil) {
                console.log(`Property ${property.title} no longer available (after ${availableUntil.toDateString()}) - excluding`);
                return false;
              }
            }
            
            // **STEP 2: Check Daily Schedule (only if limit_availability is true)**
            // This is where limit_availability comes into play
            if (scheduleEntry.limit_availability === true) {
              console.log(`Property ${property.title} has daily schedule restrictions - checking schedule`);
              const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              
              // Check each day in the requested date range
              for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
                const dayName = daysOfWeek[d.getDay()];
                const daySchedule = scheduleEntry.daily_schedule?.[dayName];
                
                if (!daySchedule || !daySchedule.enabled) {
                  console.log(`Property ${property.title} not available on ${dayName} - excluding`);
                  return false;
                }
              }
              console.log(`Property ${property.title} passed daily schedule check`);
            } else if (scheduleEntry.limit_availability === false) {
              console.log(`Property ${property.title} is available 24/7 (no daily schedule restrictions)`);
            } else {
              console.log(`Property ${property.title} has no limit_availability setting - assuming 24/7 availability`);
            }
          } else {
            // No schedule entry means no restrictions - property is available
            console.log(`Property ${property.title} has no schedule entry - assuming always available`);
          }
          
          // **STEP 3: Check Blocked Dates**
          // Check blocked dates from property_availability table
          const unavailableDates = (availabilityData as AvailabilityRow[] | null | undefined)?.filter((a: AvailabilityRow) => a.property_id === property.id) || [];
          
          for (const range of unavailableDates) {
            const rangeStart = new Date(range.start_date);
            const rangeEnd = new Date(range.end_date);
            
            // Check if the requested dates overlap with any blocked dates
            if (
              (startDateObj <= rangeEnd && startDateObj >= rangeStart) ||
              (endDateObj <= rangeEnd && endDateObj >= rangeStart) ||
              (startDateObj <= rangeStart && endDateObj >= rangeEnd)
            ) {
              console.log(`Property ${property.title} has blocked dates in range ${rangeStart.toDateString()} to ${rangeEnd.toDateString()} - excluding`);
              return false;
            }
          }
          
          console.log(`Property ${property.title} is available for the requested dates - including`);
          return true;
        });
        
        console.log(`After date filtering: ${transformedProperties.length} properties remaining`);
      }

      // Sort/filter by distance if coordinates are provided
      if (coordinates.lat && coordinates.lng) {
        // Helper to compute distance or return Infinity when coords are missing
        const dist = (p: Property) => {
          const lat = p.address.latitude;
          const lng = p.address.longitude;
          if (lat == null || lng == null) return Infinity;
          return calculateDistance(coordinates.lat!, coordinates.lng!, lat, lng);
        };

        if (filters.searchRadius < 100) {
          transformedProperties = transformedProperties.filter(p => {
            const d = dist(p);
            // If missing coords (Infinity), do not filter out due to radius constraint
            if (!isFinite(d)) return true;
            return d <= filters.searchRadius;
          });
        }

        transformedProperties.sort((a, b) => {
          const distanceA = dist(a);
          const distanceB = dist(b);
          // Items without coords (Infinity) go to the end
          return distanceA - distanceB;
        });
      }

      // Only apply if this is the latest query
      if (currentSeq === querySeqRef.current) {
        setProperties(transformedProperties);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }

  // Separate useEffect for date filters with simplified dependencies, gated by orgReady
  useEffect(() => {
    if (!orgReady) return;
    loadProperties();
  }, [orgReady, dateFilters.startDate, dateFilters.endDate]);

  // Sequence guard to avoid stale overwrites
  const querySeqRef = useRef(0);

  // Trigger loads only when org is ready (if org param was present)
  useEffect(() => {
    if (!orgReady) return;
    const run = async () => {
      ++querySeqRef.current;
      await loadProperties();
      // loadProperties now returns transformed data; we ignore here since it sets state internally
      // This effect is only responsible for timing and preventing early loads.
      // Any additional state setting should check sequence.
    };
    run();
  }, [orgReady, coordinates.lat, coordinates.lng, filters.priceRange, 
      filters.squareFeet, filters.propertyTypes, filters.amenities, 
      filters.searchRadius, filters.organizationId]);

  // When organizationId changes, write org_id into the URL and set header name
  useEffect(() => {
    (async () => {
      if (!filters.organizationId) {
        // Do not clear URL params here; keep deep link intact.
        setOrgHeaderName(null);
        return;
      }
      try {
        const { data } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', filters.organizationId)
          .maybeSingle();
        if ((data as any)?.name) setOrgHeaderName((data as any).name as string);
        const newParams = new URLSearchParams(searchParams);
        newParams.set('org_id', filters.organizationId);
        setSearchParams(newParams);
      } catch {
        // ignore URL sync failures
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.organizationId]);

  // Handle filter changes from the PropertyFilters component
  const handleFiltersChange = (newFilters: any) => {
    // Update regular filters
    setFilters({
      priceRange: newFilters.priceRange,
      squareFeet: newFilters.squareFeet,
      searchRadius: newFilters.searchRadius,
      propertyTypes: newFilters.propertyTypes,
      amenities: newFilters.amenities,
      location: newFilters.location,
      organizationId: newFilters.organizationId || '',
      sortBy: parseSortValue(newFilters.sortBy || DEFAULT_SORT),
    });
    
    // Update URL if property types change
    if (newFilters.propertyTypes.length !== filters.propertyTypes.length || 
        !newFilters.propertyTypes.every((type: string, i: number) => type === filters.propertyTypes[i])) {
      const newParams = new URLSearchParams(searchParams);
      
      if (newFilters.propertyTypes.length === 1) {
        newParams.set('type', newFilters.propertyTypes[0]);
      } else if (newFilters.propertyTypes.length === 0 && searchParams.has('type')) {
        newParams.delete('type');
      }
      
      setSearchParams(newParams);
    }
    
    // Handle date filters separately
    if (newFilters.availability) {
      const newStartDate = newFilters.availability.startDate || '';
      const newEndDate = newFilters.availability.endDate || '';
      
      // Only update if dates actually changed
      if (newStartDate !== dateFilters.startDate || newEndDate !== dateFilters.endDate) {
        console.log('Date filters changed:', { 
          old: dateFilters, 
          new: { startDate: newStartDate, endDate: newEndDate }
        });
        
        setDateFilters({
          startDate: newStartDate,
          endDate: newEndDate,
        });
      }
    }
    
    // Handle location changes
    if (newFilters.location !== filters.location) {
      if (newFilters.location) {
        geocodeLocation(newFilters.location);
      } else {
        setCoordinates({ lat: null, lng: null });
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('lat');
        newParams.delete('lng');
        newParams.delete('location');
        setSearchParams(newParams);
      }
    }
  };

  // Geocode the location and update coordinates
  const geocodeLocation = async (location: string) => {
    try {
      const coords = await geocodeAddress(location);
      if (coords) {
        const [newLat, newLng] = coords;
        
        setCoordinates({ lat: newLat, lng: newLng });
        
        const newParams = new URLSearchParams(searchParams);
        newParams.set('lat', newLat.toString());
        newParams.set('lng', newLng.toString());
        newParams.set('location', location);
        setSearchParams(newParams);
      }
    } catch {
      setError('Failed to find location. Please try a different search term.');
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
        <div className="flex flex-col items-center md:flex-row md:justify-between mb-4 md:mb-8">
          <div className="hidden md:block">
            <div className="flex items-center">
              <Cuboid className="h-8 w-8 text-maroon-600 mr-3" />
              <h1 className="text-4xl font-bold text-maroon-800 font-display">
                {orgHeaderName || 'Available Spaces'}
              </h1>
            </div>
          </div>
          
          {/* Property count - positioned between heading and toggle widget */}
          <div className="hidden md:block">
            <p className="text-[#121826] text-center">
              {properties.length > 0 ? (
                <>
                  Showing {paginationStartIndex + 1}
                  –{paginationEndIndex} of {properties.length} {properties.length === 1 ? 'space' : 'spaces'}
                  {filters.location && ` near ${filters.location}`}
                  {dateFilters.startDate && dateFilters.endDate &&
                    ` for ${new Date(dateFilters.startDate).toLocaleDateString()} - ${new Date(dateFilters.endDate).toLocaleDateString()}`
                  }
                </>
              ) : (
                '0 spaces found'
              )}
            </p>
          </div>
          
          {/* Three-state toggle button */}
          <div className="inline-flex items-center bg-gray-200 p-1.5 rounded-full shadow-sm border border-gray-300 min-w-[240px] w-full md:w-auto">
            <button
              className={`relative group flex items-center justify-center py-2 px-4 rounded-full transition-colors ${
                sidebarView === 'filters' 
                  ? 'bg-[#EA6C56] text-white shadow-md' 
                  : 'text-maroon-700 hover:bg-maroon-100'
              } flex-1`}
              onClick={() => setSidebarView('filters')}
              aria-label="Show filters"
            >
              <div className="flex items-center">
                <Sliders className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none w-32 text-center">
                Show filters sidebar
                <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                  <polygon className="fill-current" points="0,0 127.5,127.5 255,0" />
                </svg>
              </div>
            </button>
            
            <button
              className={`relative group flex items-center justify-center py-2 px-4 rounded-full transition-colors ${
                sidebarView === 'map' 
                  ? 'bg-[#EA6C56] text-white shadow-md' 
                  : 'text-maroon-700 hover:bg-maroon-100'
              } flex-1`}
              onClick={() => setSidebarView('map')}
              aria-label="Show map"
            >
              <div className="flex items-center">
                <Map className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Map</span>
              </div>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none w-32 text-center">
                Show map sidebar
                <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                  <polygon className="fill-current" points="0,0 127.5,127.5 255,0" />
                </svg>
              </div>
            </button>
            
            <button
              className={`relative group flex items-center justify-center py-2 px-4 rounded-full transition-colors ${
                sidebarView === 'none' 
                  ? 'bg-[#EA6C56] text-white shadow-md' 
                  : 'text-maroon-700 hover:bg-maroon-100'
              } flex-1`}
              onClick={() => setSidebarView('none')}
              aria-label="Hide sidebar"
            >
              <div className="flex items-center">
                <Grid className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Full</span>
              </div>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none w-32 text-center">
                Full width view (no sidebar)
                <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                  <polygon className="fill-current" points="0,0 127.5,127.5 255,0" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Show first on mobile (order-1), second on desktop (lg:order-2) */}
          {sidebarView !== 'none' && (
            <div 
              className="order-1 lg:order-2 lg:sticky lg:top-20 lg:col-span-1 transition-all duration-300"
              style={{width: "100%"}}
            >
              <div className="h-full">
                {sidebarView === 'filters' ? (
                  <PropertyFilters
                    isOpen={true}
                    onClose={() => setSidebarView('none')}
                    onFiltersChange={handleFiltersChange}
                    initialFilters={{
                      ...filters,
                      availability: dateFilters
                    }}
                  />
                ) : (
                  <PropertyMap
                    properties={properties}
                    center={coordinates.lat && coordinates.lng ? [coordinates.lat, coordinates.lng] : undefined}
                    zoom={coordinates.lat && coordinates.lng ? 12 : undefined}
                    height="600px"
                    autoFitBounds={!coordinates.lat || !coordinates.lng} // Auto-fit when no search location
                  />
                )}
              </div>
            </div>
          )}

          {/* Property List - Show second on mobile (order-2), first on desktop (lg:order-1) */}
          <div 
            className={`order-2 lg:order-1 transition-all duration-300 ${
              sidebarView === 'none' 
                ? 'lg:col-span-3' 
                : 'lg:col-span-2'
            }`}
            style={{width: "100%"}}
          >
            {/* Show property count on mobile above the list */}
            <div className="block md:hidden mb-4">
              <p className="text-[#121826] text-center">
                {properties.length > 0 ? (
                  <>
                    Showing {paginationStartIndex + 1}
                    –{paginationEndIndex} of {properties.length} {properties.length === 1 ? 'space' : 'spaces'}
                    {filters.location && ` near ${filters.location}`}
                    {dateFilters.startDate && dateFilters.endDate &&
                      ` for ${new Date(dateFilters.startDate).toLocaleDateString()} - ${new Date(dateFilters.endDate).toLocaleDateString()}`
                    }
                  </>
                ) : (
                  '0 spaces found'
                )}
              </p>
            </div>

            {hasPagination && properties.length > 0 && (
              <nav className="mb-4 flex items-center justify-between flex-wrap gap-3" aria-label="Property pagination">
                <span className="text-sm text-maroon-700">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${currentPage === 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${currentPage === totalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}

            <div 
              className={`grid grid-cols-1 ${
                sidebarView === 'none' 
                  ? 'md:grid-cols-3' 
                  : 'md:grid-cols-2'
              } gap-6`}
            >
              {paginatedProperties.map((property) => (
                <PropertyCard 
                  key={property.id} 
                  property={property}
                  rating={propertyRatings[property.id]?.rating || 0}
                  totalReviews={propertyRatings[property.id]?.totalReviews || 0}
                  startDate={dateFilters.startDate}
                  endDate={dateFilters.endDate}
                  isFavorited={!!favorites[property.id]}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
              
              {properties.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <h3 className="text-xl font-semibold text-maroon-800 mb-2">No properties found</h3>
                  <p className="text-maroon-600">
                    Try adjusting your search criteria or location
                    {dateFilters.startDate && dateFilters.endDate && 
                      `, or choose different dates`}
                  </p>
                  {dateFilters.startDate && dateFilters.endDate && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl max-w-md mx-auto">
                      <p className="text-sm text-blue-700">
                        <strong>Date filtering:</strong> Only showing properties that are explicitly available during your selected dates. 
                        Properties must have availability confirmed for this time period.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {hasPagination && properties.length > 0 && (
              <nav className="mt-6 flex items-center justify-between flex-wrap gap-3" aria-label="Property pagination">
                <span className="text-sm text-maroon-700">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${currentPage === 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${currentPage === totalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPage;