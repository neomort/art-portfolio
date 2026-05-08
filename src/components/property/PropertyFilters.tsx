import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PropertyTypeMeta } from '../../types';
import { MapPin, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { AMENITIES } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { PROPERTY_TYPES } from '../../types';
import { env } from '../../lib/env';



import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { DateRangePicker } from '../DateRangePicker';

interface PropertyFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  onFiltersChange: (filters: any) => void;
  initialFilters?: any;
}

const SORT_OPTIONS = [
  { value: 'recently_listed', label: 'Recently listed' },
  { value: 'price_low_high', label: 'Price low to high' },
  { value: 'price_high_low', label: 'Price high to low' },
  { value: 'size_small_large', label: 'Size small to large' },
  { value: 'size_large_small', label: 'Size large to small' },
  { value: 'property_type', label: 'Property type' },
  { value: 'distance', label: 'Distance' },
];

const SUPABASE_URL = env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? '';
const PROPERTY_TYPES_API_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/property-types-in-use`
  : null;
const PROPERTY_TYPES_AMENITIES_CACHE_KEY = "propertyTypesAndAmenitiesInUse";
const PROPERTY_TYPES_AMENITIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const DISALLOWED_AMENITIES = new Set([
  'street_level',
  'ground_floor',
  'daylight_',
  'industrial',
  'raw',
  'whitebox_/_minimal',
  'haussmann_style',
]);

type AmenityLike = { id?: string; label?: string } | { value: string; label: string };

const getAmenityKey = (item: AmenityLike): string | undefined => {
  if ('id' in item && item.id) return item.id;
  if ('value' in item && item.value) return item.value;
  return undefined;
};

const filterAmenitiesList = <T extends AmenityLike>(items: readonly T[] | undefined | null): T[] => {
  if (!items) return [];
  const filtered: T[] = [];
  items.forEach((item) => {
    const key = getAmenityKey(item);
    if (!key || !DISALLOWED_AMENITIES.has(key)) {
      filtered.push(item);
    }
  });
  return filtered;
};

const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  isOpen,
  onClose: _onClose,
  onFiltersChange,
  initialFilters,
}) => {
  const [minPrice, maxPrice] = [0, 5000];
  const [minSqFt, maxSqFt] = [0, 10000];

  const defaultFilters = {
    priceRange: [minPrice, maxPrice],
    squareFeet: [minSqFt, maxSqFt],
    searchRadius: 25,
    propertyTypes: [],
    amenities: [],
    location: '',
    availability: {
      startDate: '',
      endDate: '',
    },
    organizationId: '',
    sortBy: 'recently_listed',
  };

  // Use initialFilters directly instead of maintaining separate local state
  const currentFilters = {
    ...defaultFilters,
    ...(initialFilters || {}),
    sortBy: (initialFilters && initialFilters.sortBy) || defaultFilters.sortBy,
  };

  // Local state for immediate visual feedback on sliders
  const [localPriceRange, setLocalPriceRange] = useState(currentFilters.priceRange);
  const [localSquareFeet, setLocalSquareFeet] = useState(currentFilters.squareFeet);
  const [localSearchRadius, setLocalSearchRadius] = useState(currentFilters.searchRadius);

  const [locationInput, setLocationInput] = useState(currentFilters.location || '');

  // --- Property Types from Edge Function ---
  const [propertyTypesInUse, setPropertyTypesInUse] = useState<PropertyTypeMeta[]>([]);
const [amenitiesInUse, setAmenitiesInUse] = useState<{ id: string, label: string }[]>([]);
const [loadingPropertyTypes, setLoadingPropertyTypes] = useState(true);
const [errorPropertyTypes, setErrorPropertyTypes] = useState(false);

useEffect(() => {
  let isMounted = true;
  setLoadingPropertyTypes(true);
  setErrorPropertyTypes(false);

  if (!PROPERTY_TYPES_API_URL || !SUPABASE_ANON_KEY) {
    setErrorPropertyTypes(true);
    setLoadingPropertyTypes(false);
    return () => { isMounted = false; };
  }

  // Try to load from localStorage first
  const cache = localStorage.getItem(PROPERTY_TYPES_AMENITIES_CACHE_KEY);
  if (cache) {
    try {
      const { propertyTypes, amenities, timestamp } = JSON.parse(cache);
      if (
        Array.isArray(propertyTypes) &&
        Array.isArray(amenities) &&
        typeof timestamp === 'number' &&
        Date.now() - timestamp < PROPERTY_TYPES_AMENITIES_CACHE_TTL
      ) {
        setPropertyTypesInUse(propertyTypes);
        setAmenitiesInUse(filterAmenitiesList(amenities));
        setLoadingPropertyTypes(false);
        return;
      }
    } catch (e) {
      // Ignore parse errors and continue to fetch
    }
  }

  fetch(PROPERTY_TYPES_API_URL, {
    method: 'GET',
    headers: {
      // Pass anon key as both apikey and Authorization for Supabase Functions
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    })
    .then((data) => {
      if (!isMounted) return;
      // Map property type values to meta info from PROPERTY_TYPES
      let inUseTypes: PropertyTypeMeta[] = [];
      if (Array.isArray(data.propertyTypes)) {
        inUseTypes = PROPERTY_TYPES.filter(pt => data.propertyTypes.includes(pt.value));
        setPropertyTypesInUse(inUseTypes);
      } else {
        setPropertyTypesInUse([]);
      }
      // Handle amenities
      let inUseAmenities: { id: string, label: string }[] = [];
      if (Array.isArray(data.amenities)) {
        inUseAmenities = filterAmenitiesList(data.amenities);
        setAmenitiesInUse(inUseAmenities);
      } else {
        setAmenitiesInUse([]);
      }
      // Save to cache
      localStorage.setItem(
        PROPERTY_TYPES_AMENITIES_CACHE_KEY,
        JSON.stringify({ propertyTypes: inUseTypes, amenities: inUseAmenities, timestamp: Date.now() })
      );
      setLoadingPropertyTypes(false);
    })
    .catch(() => {
      if (isMounted) {
        setErrorPropertyTypes(true);
        setPropertyTypesInUse([]);
        setAmenitiesInUse([]);
        setLoadingPropertyTypes(false);
      }
    });
  return () => { isMounted = false; };
}, []);

  // Debounce timer refs
  const priceDebounceRef = useRef<NodeJS.Timeout>();
  const sqftDebounceRef = useRef<NodeJS.Timeout>();
  const radiusDebounceRef = useRef<NodeJS.Timeout>();

  // Date range state (as Date objects)
  // Helper to parse 'YYYY-MM-DD' as local date (not UTC)
  function parseLocalDate(str: string | undefined): Date | null {
    if (!str) return null;
    const [year, month, day] = str.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  // Helper to format Date as 'YYYY-MM-DD' in local time
  function formatLocalDate(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const [dateRange, setDateRange] = useState<[
    Date | null,
    Date | null
  ]>([
    parseLocalDate(currentFilters.availability?.startDate),
    parseLocalDate(currentFilters.availability?.endDate),
  ]);

  // Sync date state if filters change externally
  useEffect(() => {
    setDateRange([
      parseLocalDate(currentFilters.availability?.startDate),
      parseLocalDate(currentFilters.availability?.endDate),
    ]);
  }, [currentFilters.availability?.startDate, currentFilters.availability?.endDate]);

  // Sync local state with filters when they change externally
  useEffect(() => {
    setLocalPriceRange(currentFilters.priceRange);
    setLocalSquareFeet(currentFilters.squareFeet);
    setLocalSearchRadius(currentFilters.searchRadius);
    setLocationInput(currentFilters.location || '');
  }, [currentFilters.priceRange, currentFilters.squareFeet, currentFilters.searchRadius, currentFilters.location]);

  // Sync property types from URL when component mounts
  useEffect(() => {
    // This ensures property types from URL are properly reflected in the UI
    if (initialFilters && initialFilters.propertyTypes) {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((el) => {
        const checkbox = el as HTMLInputElement;
        const typeValue = checkbox.nextElementSibling?.textContent?.toLowerCase().replace(/\s+/g, '_');
        if (typeValue && initialFilters.propertyTypes.includes(typeValue)) {
          checkbox.checked = true;
        }
      });
    }
  }, [initialFilters]);

  // Debounced update function
  const debouncedUpdateFilters = useCallback((key: string, value: any, debounceRef: React.MutableRefObject<NodeJS.Timeout | undefined>) => {
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout
    debounceRef.current = setTimeout(() => {
      const newFilters = { ...currentFilters, [key]: value };
      onFiltersChange(newFilters);
    }, 300); // 300ms debounce
  }, [currentFilters, onFiltersChange]);

  const updateFilters = useCallback((updates: any) => {
    const newFilters = { ...currentFilters, ...updates };
    onFiltersChange(newFilters);
  }, [currentFilters, onFiltersChange]);

  // Handle location input changes with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationInput !== currentFilters.location) {
        updateFilters({ location: locationInput });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [locationInput, currentFilters.location, updateFilters]);

  const handleReset = () => {
    const resetFilters = {
      priceRange: [minPrice, maxPrice],
      squareFeet: [minSqFt, maxSqFt],
      searchRadius: 25,
      propertyTypes: [],
      amenities: [],
      location: '',
      availability: {
        startDate: '',
        endDate: '',
      },
      organizationId: '',
      sortBy: defaultFilters.sortBy,
    };
    
    // Update local slider states immediately
    setLocalPriceRange([minPrice, maxPrice]);
    setLocalSquareFeet([minSqFt, maxSqFt]);
    setLocalSearchRadius(25);
    setLocationInput('');
    
    // Clear any pending debounced updates
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    if (sqftDebounceRef.current) clearTimeout(sqftDebounceRef.current);
    if (radiusDebounceRef.current) clearTimeout(radiusDebounceRef.current);
    
    onFiltersChange(resetFilters);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
      if (sqftDebounceRef.current) clearTimeout(sqftDebounceRef.current);
      if (radiusDebounceRef.current) clearTimeout(radiusDebounceRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <Card className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-maroon-800">Filters</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="property-sort-by" className="text-sm font-medium text-maroon-600 whitespace-nowrap">
            Sort by
          </label>
          <select
            id="property-sort-by"
            value={currentFilters.sortBy}
            onChange={(event) => {
              updateFilters({ sortBy: event.target.value });
            }}
            className="rounded-lg border border-maroon-200 text-sm text-maroon-700 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-maroon-400 min-w-[175px]"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="space-y-4">
        <h4 className="font-medium text-maroon-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          Available Dates
        </h4>
        <div className="space-y-2">
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              setDateRange(range);
              const [start, end] = range;
              // Use local date formatting to avoid timezone issues
              const startDate = formatLocalDate(start);
              const endDate = formatLocalDate(end);
              updateFilters({
                availability: {
                  ...currentFilters.availability,
                  startDate,
                  endDate,
                },
              });
            }}
            minDate={new Date()}
          />
          
          {/* Validation messages */}
          {currentFilters.availability?.startDate && currentFilters.availability?.endDate && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
              Filtering by dates: {new Date(currentFilters.availability.startDate).toLocaleDateString('en-US')} to {new Date(currentFilters.availability.endDate).toLocaleDateString('en-US')}
            </div>
          )}
          
          {currentFilters.availability?.startDate && !currentFilters.availability?.endDate && (
            <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg flex items-center">
              <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
              Please select an end date to filter by availability
            </div>
          )}
          
          {!currentFilters.availability?.startDate && currentFilters.availability?.endDate && (
            <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg flex items-center">
              <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
              Please select a start date to filter by availability
            </div>
          )}
          
          {!currentFilters.availability?.startDate && !currentFilters.availability?.endDate && (
            <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">
              Select dates to filter properties by availability
            </div>
          )}
        </div>
      </div>

      {/* Price Range with Immediate Visual Feedback */}
      <div className="space-y-4">
        <h4 className="font-medium text-maroon-700">Price Range (per day)</h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm text-maroon-600">
            <span>{formatCurrency(localPriceRange[0])}</span>
            <span>{formatCurrency(localPriceRange[1])}</span>
          </div>
          <div className="px-3">
            <Slider
              range
              min={minPrice}
              max={maxPrice}
              value={localPriceRange}
              onChange={(value) => {
                // Update local state immediately for visual feedback
                setLocalPriceRange(value as [number, number]);
                // Debounce the actual filter update
                debouncedUpdateFilters('priceRange', value, priceDebounceRef);
              }}
              trackStyle={[{ backgroundColor: '#c13434', height: 6 }]}
              handleStyle={[
                { borderColor: '#c13434', backgroundColor: '#c13434', boxShadow: '0 2px 6px rgba(193, 52, 52, 0.3)' },
                { borderColor: '#c13434', backgroundColor: '#c13434', boxShadow: '0 2px 6px rgba(193, 52, 52, 0.3)' }
              ]}
              railStyle={{ backgroundColor: '#f8cfcf', height: 6 }}
              dotStyle={{ borderColor: '#c13434' }}
              activeDotStyle={{ borderColor: '#c13434' }}
            />
          </div>
        </div>
      </div>

      {/* Square Footage with Immediate Visual Feedback */}
      <div className="space-y-4">
        <h4 className="font-medium text-maroon-700">Property Size</h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm text-maroon-600">
            <span>{localSquareFeet[0].toLocaleString()} sq ft</span>
            <span>{localSquareFeet[1].toLocaleString()} sq ft</span>
          </div>
          <div className="px-3">
            <Slider
              range
              min={minSqFt}
              max={maxSqFt}
              value={localSquareFeet}
              onChange={(value) => {
                // Update local state immediately for visual feedback
                setLocalSquareFeet(value as [number, number]);
                // Debounce the actual filter update
                debouncedUpdateFilters('squareFeet', value, sqftDebounceRef);
              }}
              trackStyle={[{ backgroundColor: '#c13434', height: 6 }]}
              handleStyle={[
                { borderColor: '#c13434', backgroundColor: '#c13434', boxShadow: '0 2px 6px rgba(193, 52, 52, 0.3)' },
                { borderColor: '#c13434', backgroundColor: '#c13434', boxShadow: '0 2px 6px rgba(193, 52, 52, 0.3)' }
              ]}
              railStyle={{ backgroundColor: '#f8cfcf', height: 6 }}
              dotStyle={{ borderColor: '#c13434' }}
              activeDotStyle={{ borderColor: '#c13434' }}
            />
          </div>
        </div>
      </div>

      {/* Location Search */}
      <div className="space-y-4">
        <h4 className="font-medium text-maroon-700">Location</h4>
        <Input
          type="text"
          placeholder="Enter location"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          icon={<MapPin className="h-5 w-5" />}
        />
      </div>

      {/* Organization Filter hidden by request; URL parameters still supported */}

      {/* Search Radius - Compact Layout with Immediate Visual Feedback */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-maroon-700">Search Radius</h4>
          <span className="text-sm font-medium text-maroon-600">
            {localSearchRadius} miles
          </span>
        </div>
        <div className="px-1">
          <Slider
            min={1}
            max={100}
            value={localSearchRadius}
            onChange={(value) => {
              // Update local state immediately for visual feedback
              setLocalSearchRadius(value as number);
              // Debounce the actual filter update
              debouncedUpdateFilters('searchRadius', value, radiusDebounceRef);
            }}
            trackStyle={{ backgroundColor: '#c13434', height: 6 }}
            handleStyle={{ borderColor: '#c13434', backgroundColor: '#c13434', boxShadow: '0 2px 6px rgba(193, 52, 52, 0.3)' }}
            railStyle={{ backgroundColor: '#f8cfcf', height: 6 }}
            dotStyle={{ borderColor: '#c13434' }}
            activeDotStyle={{ borderColor: '#c13434' }}
          />
        </div>

      {/* Property Types */}
      <div className="space-y-4">
        <h4 className="font-medium text-maroon-700">Property Type</h4>
        <div className="space-y-2">
          {/* Property Types fetched from Edge Function */}
{loadingPropertyTypes ? (
  <div className="text-sm text-gray-500">Loading property types...</div>
) : errorPropertyTypes ? (
  <div className="text-sm text-red-500">Failed to load property types. Showing all types.</div>
) : (
  (propertyTypesInUse.length > 0 ? propertyTypesInUse : PROPERTY_TYPES).map((type) => (
    <label key={type.value} className="flex items-center">
      <input
        type="checkbox"
        checked={currentFilters.propertyTypes.includes(type.value)}
        onChange={(e) => {
          const newTypes = e.target.checked
            ? [...currentFilters.propertyTypes, type.value]
            : currentFilters.propertyTypes.filter((t: string) => t !== type.value);
          updateFilters({ propertyTypes: newTypes });
        }}
        className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
      />
      <span className="ml-2 text-maroon-600">{type.label}</span>
    </label>
  ))
)}
        </div>
      </div>

      {/* Amenities */}
<div className="space-y-4">
  <h4 className="font-medium text-maroon-700">Amenities</h4>
  <div className="space-y-2">
    {(
      amenitiesInUse.length > 0
        ? amenitiesInUse
        : filterAmenitiesList(AMENITIES)
    ).map((amenity) => {
  const key = getAmenityKey(amenity);
  if (!key) return null;
  const amenityMeta = AMENITIES.find(a => a.value === key);
  const label = amenityMeta ? amenityMeta.label : (amenity.label || key);
  return (
    <label key={key} className="flex items-center">
      <input
        type="checkbox"
        checked={currentFilters.amenities.includes(key)}
        onChange={(e) => {
          const newAmenities = e.target.checked
            ? [...currentFilters.amenities, key]
            : currentFilters.amenities.filter((a: string) => a !== key);
          updateFilters({ amenities: newAmenities });
        }}
        className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
      />
      <span className="ml-2 text-maroon-600">{label}</span>
    </label>
  );
})}
  </div>
</div>

      {/* Reset Button */}
      <div className="pt-4 border-t border-gray-200">
        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full"
        >
          Reset Filters
        </Button>
      </div>
    </div>
    </Card>
  );
};

export default PropertyFilters;