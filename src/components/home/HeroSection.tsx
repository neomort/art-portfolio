import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { geocodeAddress, reverseGeocode } from '../../lib/geocoding';

const DEFAULT_RADIUS = 25;

const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationLabel, setUserLocationLabel] = useState<string>('');

  // Try to get user's location when component mounts
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(coords);
          // Reverse geocode to get city, state
          const label = await reverseGeocode(coords.lat, coords.lng);
          console.log('Detected location label:', label); // Debug log
          if (label) setUserLocationLabel(label);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        { timeout: 30000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    }
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      let searchLatLng: { lat: number; lng: number } | null = null;
      let searchLocationLabel = location;
      if (!location && userLocation) {
        // Use detected location if input is empty
        searchLatLng = userLocation;
        searchLocationLabel = userLocationLabel;
      } else if (location) {
        // Geocode input
        const coordinates = await geocodeAddress(location);
        if (coordinates) {
          searchLatLng = { lat: coordinates[0], lng: coordinates[1] };
        }
      }
      if (searchLatLng) {
        const searchParams = new URLSearchParams({
          location: searchLocationLabel || '',
          lat: searchLatLng.lat.toString(),
          lng: searchLatLng.lng.toString(),
          radius: DEFAULT_RADIUS.toString()
        });
        navigate(`/artworks?${searchParams.toString()}`);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to build category/filter URLs with location if available
  const getCategoryUrl = (base: string) => {
    if (!location && userLocation && userLocationLabel) {
      const params = new URLSearchParams({
        location: userLocationLabel,
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: DEFAULT_RADIUS.toString(),
      });
      return `${base}?${params.toString()}`;
    }
    return base;
  };

  return (
    <div className="relative overflow-hidden bg-[#FEFAF8]">
      <div className="container mx-auto px-4 py-24 md:py-32 lg:py-40 relative z-10 flex flex-col items-center">
        <div className="max-w-3xl text-center">
          <h1 className="text-[40px] font-medium text-[#121826] mb-6 leading-[48px] tracking-[0px] text-center font-unbounded mx-auto">
            Discover Amazing Artwork<br></br>from Talented Artists
          </h1>
          <p className="text-xl text-[#121826] text-center mb-8 max-w-3xl font-sans mx-auto">
            Explore paintings, sculptures, photography, and digital art from emerging and 
            established artists. Find the perfect piece for your collection.
          </p>
          
          {/* Search Form */}
          <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-xl mb-8 w-full">
            <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto">
              <div className="relative w-full">
                <Input 
                  type="text" 
                  placeholder={userLocationLabel || 'Location'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  icon={<MapPin className="h-5 w-5" />}
                />
              </div>
              
              <Button 
                className="w-full sm:w-auto sm:flex-shrink-0 h-11 px-5 text-base"
                variant="secondary"
                onClick={handleSearch}
                isLoading={loading}
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>
          </div>
          
          {/* Categories */}
          <div className="flex flex-wrap gap-3 mb-12 justify-center w-full max-w-4xl mx-auto">
            <div className="flex flex-row flex-wrap gap-3 justify-center">
              {/* Paintings */}
              <Link to={getCategoryUrl('/artworks?type=painting')}>
                <Button
                  variant="outline"
                  className="bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white border border-white/30 hover:border-white/50 group whitespace-nowrap"
                >
                  Paintings
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>

              {/* Sculptures */}
              <Link to={getCategoryUrl('/artworks?type=sculpture')}>
                <Button
                  variant="outline"
                  className="bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white border border-white/30 hover:border-white/50 group whitespace-nowrap"
                >
                  Sculptures
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>

              {/* Photography */}
              <Link to={getCategoryUrl('/artworks?type=photography')}>
                <Button
                  variant="outline"
                  className="bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white border border-white/30 hover:border-white/50 group whitespace-nowrap"
                >
                  Photography
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>

              {/* Browse All - visually distinct */}
              <Link to={getCategoryUrl('/artworks')} className="inline-flex">
                <Button
                  variant="outline"
                  className="bg-gray-800 hover:bg-gray-700 text-white border-none px-6 py-3 flex items-center group whitespace-nowrap"
                >
                  Browse All
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* This section is now empty as the Browse All button has been moved to the Categories section above */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;