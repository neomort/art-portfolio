import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PropertyCard from '../property/PropertyCard';
import { Button } from '../ui/button';
import { Property } from '../../types';

interface FeaturedPropertiesProps {
  properties: (Property & { rating: number; totalReviews: number })[];
  isFavorited?: Record<string, boolean>;
  onToggleFavorite?: (propertyId: string) => void;
}

const FeaturedProperties: React.FC<FeaturedPropertiesProps> = ({ 
  properties, 
  isFavorited = {}, 
  onToggleFavorite 
}) => {
  return (
    <section className="py-24 bg-[#FEFAF8]">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-3 text-[#121826] font-display">
              Featured Spaces
            </h2>
            <p className="text-lg text-[#121826]">
              Discover our handpicked selection of exceptional commercial spaces
            </p>
          </div>
          <Link to="/properties">
            <Button variant="outline" className="hidden md:!flex items-center group">
              View All
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {properties.map(({ rating, totalReviews, ...property }) => (
            <PropertyCard 
              key={property.id} 
              property={property}
              rating={rating}
              totalReviews={totalReviews}
              isFavorited={!!isFavorited[property.id]}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>

        <div className="mt-12 text-center md:hidden">
          <Link to="/properties">
            <Button variant="outline">
              View All Spaces
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProperties;