import React from 'react';
import { Star } from 'lucide-react';

interface PropertyRatingProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

const PropertyRating: React.FC<PropertyRatingProps> = ({
  rating,
  totalReviews,
  size = 'md',
  showCount = true,
}) => {
  // If rating is 0, don't display anything
  if (rating === 0) {
    return null;
  }

  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="flex items-center gap-1">
      <Star className={`${sizes[size]} text-amber-500 fill-amber-500`} />
      <span className={`${textSizes[size]} font-medium text-[#121826]`}>
        {rating.toFixed(1)}
      </span>
      {showCount && totalReviews && totalReviews > 0 && (
        <span className={`${textSizes[size]} text-maroon-500`}>
          ({totalReviews})
        </span>
      )}
    </div>
  );
};

export default PropertyRating;