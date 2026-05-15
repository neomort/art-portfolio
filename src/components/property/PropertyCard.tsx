import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, Heart, PercentDiamond as DiamondPercent, FileEdit } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import PropertyRating from './PropertyRating';
import { getPropertyTypeLabel } from '../../types';
import { formatCurrency, truncateText } from '../../lib/utils';
import { formatCityState } from '../../lib/formatAddress';
import { calculateEffectivePrice } from '../../lib/utils';

type RateType = 'fixed' | 'percentage';

type PropertyCardProperty = {
  id: string;
  title?: string | null;
  description?: string | null;
  address?: { city?: string | null; state?: string | null } | null;
  images?: string[] | null;
  price_per_day?: number | null;
  inquire_for_pricing?: boolean | null;
  square_feet?: number | null;
  property_type?: string | null;
  // Legacy/derived fields
  weekly_rate?: number | null;
  weekly_rate_type?: string | null;
  weekly_rate_value?: number | null;
  monthly_rate?: number | null;
  monthly_rate_type?: string | null;
  monthly_rate_value?: number | null;
  yearly_rate_type?: string | null;
  yearly_rate_value?: number | null;
  featured?: boolean | null;
  published?: boolean | null;
};

interface PropertyCardProps {
  property: PropertyCardProperty;
  rating?: number;
  totalReviews?: number;
  isFavorited?: boolean;
  startDate?: string;
  endDate?: string;
  onToggleFavorite?: (propertyId: string) => void;
  showDraftLabel?: boolean;
  mode?: 'public' | 'dashboard';
  onManageProperty?: (propertyId: string) => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ 
  property,
  rating = 0,
  totalReviews = 0,
  isFavorited = false,
  startDate,
  endDate,
  onToggleFavorite,
  showDraftLabel = false,
  mode = 'public',
  onManageProperty
}) => {
  const {
    id,
    title,
    description,
    images,
    price_per_day,
    inquire_for_pricing,
    square_feet,
    property_type,
  } = property;

  const imagesArr = Array.isArray(images) ? images : [];
  // City/State rendering centralized via formatter
  const desc = description ?? '';
  // Safe normalizers for unions
  const toRateType = (v: unknown): RateType | null => (v === 'fixed' || v === 'percentage') ? v : null;
  const safeWeeklyType = toRateType(property.weekly_rate_type);
  const safeMonthlyType = toRateType(property.monthly_rate_type);
  const safeYearlyType = toRateType(property.yearly_rate_type);
  const propTypeLabel = getPropertyTypeLabel((typeof property_type === 'string' ? property_type : 'unique_space') as any);

  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imagesArr.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % imagesArr.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imagesArr.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + imagesArr.length) % imagesArr.length);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(property.id);
    }
  };

  // Use PROPERTY_TYPES label utility for consistency
  // Import getPropertyTypeLabel from types if not already
  // import { getPropertyTypeLabel } from '../../types';
  const propertyTypeLabel = propTypeLabel;

  // Calculate effective price if dates are provided
  const priceDisplay = React.useMemo(() => {
    if (inquire_for_pricing) {
      return { text: 'Inquire for pricing', term: null, isDiscounted: false };
    }
    // Prefer hourly if available
    const pph = (property as any)?.price_per_hour as number | null | undefined;
    if (pph && pph > 0) {
      return { text: formatCurrency(pph), term: 'hour' as const, isDiscounted: false };
    }
    // Fallback to daily
    if (!price_per_day) {
      // New behavior: if daily is null but weekly exists, show weekly; else if monthly exists, show monthly
      const weeklyNumeric = (property as any)?.weekly_rate ?? (safeWeeklyType === 'fixed' ? property.weekly_rate_value : null);
      if (typeof weeklyNumeric === 'number' && !Number.isNaN(weeklyNumeric) && weeklyNumeric > 0) {
        return { text: formatCurrency(weeklyNumeric), term: 'week' as const, isDiscounted: false };
      }
      const monthlyNumeric = (property as any)?.monthly_rate ?? (safeMonthlyType === 'fixed' ? property.monthly_rate_value : null);
      if (typeof monthlyNumeric === 'number' && !Number.isNaN(monthlyNumeric) && monthlyNumeric > 0) {
        return { text: formatCurrency(monthlyNumeric), term: 'mo' as const, isDiscounted: false };
      }
      return { text: 'Price unavailable', term: null, isDiscounted: false };
    }
    
    if (startDate && endDate) {
      const { pricePerDay, term } = calculateEffectivePrice(
        price_per_day,
        startDate,
        endDate,
        safeWeeklyType,
        property.weekly_rate_value,
        safeMonthlyType,
        property.monthly_rate_value,
        safeYearlyType,
        property.yearly_rate_value
      );
      
      if (term === 'day') {
        return { 
          text: formatCurrency(pricePerDay), 
          term: 'day',
          isDiscounted: false
        };
      } else {
        return { 
          text: formatCurrency(pricePerDay),
          term: 'day',
          isDiscounted: true,
          discountTerm: term
        };
      }
    }
    
    // Default to daily rate if no dates provided
    return { 
      text: formatCurrency(price_per_day), 
      term: 'day' as const,
      isDiscounted: false
    };
  }, [price_per_day, inquire_for_pricing, startDate, endDate, property]);

  if (mode === 'dashboard') {
    return (
      <Card className="overflow-hidden transition-shadow hover:shadow-lg h-full">
        <div className="relative aspect-video overflow-hidden">
          {/* Draft tag - only show if showDraftLabel is true */}
          {showDraftLabel && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-white text-sm font-extrabold px-4 py-1 z-20 flex items-center gap-2 rounded-bl-2xl shadow-lg border-2 border-yellow-500 animate-pulse">
              <FileEdit className="h-4 w-4" />
              DRAFT
            </div>
          )}
          {imagesArr[0] ? (
            <img
              src={imagesArr[0]}
              alt={title ?? 'Artwork image'}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAACAkQBADs="
              alt={title ?? 'No image'}
              className="w-full h-full object-cover bg-gray-100 text-gray-400"
            />
          )}
        </div>
        <div className="p-6 flex flex-col gap-2">
  <h3 className="text-xl font-bold text-maroon-800 font-display truncate whitespace-nowrap overflow-hidden text-ellipsis">
    {title}
  </h3>
  <div className="flex items-center text-maroon-500 text-sm">
    <MapPin className="h-3.5 w-3.5 mr-1 text-[#EA6C56]" />
    <span>{formatCityState(property)}</span>
  </div>
  <Button
    variant="outline"
    className="w-full mt-4"
    onClick={() => onManageProperty && onManageProperty(id)}
  >
    Manage Artwork
  </Button>
</div>
      </Card>
    );
  }

  // Default: public/full card
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg h-full">
      <Link to={`/property/${id}`} className="block h-full">
        {/* Image container with navigation */}
        <div className="relative aspect-video overflow-hidden">
          {/* Featured tag */}
          {property.featured && (
            <div className="absolute top-0 left-0 bg-maroon-600 text-white text-xs font-bold px-3 py-1 z-10">
              Featured
            </div>
          )}
          
          {/* Draft tag - only show if published is false */}
          {showDraftLabel && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-white text-sm font-extrabold px-4 py-1 z-20 flex items-center gap-2 rounded-bl-2xl shadow-lg border-2 border-yellow-500 animate-pulse">
              <FileEdit className="h-4 w-4" />
              DRAFT
            </div>
          )}
          {/* Image gallery with navigation */}
          {imagesArr[currentImageIndex] ? (
            <img
              src={imagesArr[currentImageIndex]}
              alt={title ?? 'Artwork image'}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <img
              src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAACAkQBADs="
              alt={title ?? 'No image'}
              className="w-full h-full object-cover bg-gray-100 text-gray-400"
            />
          )}
          
          {/* Image navigation */}
          {imagesArr.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={prevImage}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 w-10 h-10 p-0 bg-white/90 hover:bg-white shadow-lg rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                aria-label="Previous image"
              >
                <ArrowRight className="h-5 w-5 transform rotate-180 text-maroon-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextImage}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 p-0 bg-white/90 hover:bg-white shadow-lg rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                aria-label="Next image"
              >
                <ArrowRight className="h-4 w-4 text-maroon-600" />
              </Button>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1">
                {imagesArr.map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${
                      currentImageIndex === index
                        ? 'w-4 bg-white'
                        : 'w-1.5 bg-white/60'
                    }`}
                  ></span>
                ))}
              </div>
            </>
          )}
          
          {/* Artwork type badge and draft indicator */}
          <div className="absolute top-2 left-2 flex space-x-2">
            <div className="bg-white text-[#EA6C56] text-xs font-medium px-3 py-1 rounded-full capitalize">
              {propertyTypeLabel.charAt(0).toUpperCase() + propertyTypeLabel.slice(1)}
            </div>
            {property.published === false && (
              <div className="bg-gray-700 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center">
                <FileEdit className="h-3 w-3 mr-1" />
                Draft
              </div>
            )}
          </div>
          
          {/* Favorite button */}
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFavoriteClick}
              className="absolute top-2 right-2 w-10 h-10 p-0 bg-white/90 hover:bg-white z-10 shadow-md rounded-full flex items-center justify-center"
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
            </Button>
          )}
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center text-[#121826] text-sm">
              <MapPin className="h-3.5 w-3.5 mr-1 text-[#EA6C56]" />
              <span>{formatCityState(property)}</span>
            </div>
            {rating > 0 && <PropertyRating rating={rating} totalReviews={totalReviews} size="sm" />}
          </div>
          
          <h3 className="text-xl font-bold text-[#121826] font-display mb-2 truncate whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </h3>
          
          <div className="text-[#121826] text-sm mb-4 h-10 line-clamp-2">
            {desc.length > 0 ? truncateText(desc, 100) : <>&nbsp;<br />&nbsp;</>}
          </div>
          
          <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
            <div>
              {typeof square_feet === 'number' ? (
                <span className="text-sm font-semibold text-[#121826]">
                  {square_feet.toLocaleString()} sq ft
                </span>
              ) : null}
            </div>
            <div className="text-right">
              {inquire_for_pricing ? (
                <span className="font-bold text-[#121826]">
                  Inquire for pricing
                </span>
              ) : (
                <div className="flex items-center">
                  <div className="flex items-center">
                    <span className="font-bold text-xl text-[#121826]">
                      {priceDisplay.text}
                    </span>
                    {priceDisplay.term && (
                      <span className="text-[#EA6C56] text-sm"> / {priceDisplay.term}</span>
                    )}
                    
                    {priceDisplay.isDiscounted && (
                      <div className="relative ml-1 group">
                        <DiamondPercent data-testid="discount-icon" className="h-4 w-4 text-green-600" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 pointer-events-none">
                          This rate is calculated based on an available {priceDisplay.discountTerm}ly discount
                          <div className="absolute top-full right-2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
};

export default PropertyCard;