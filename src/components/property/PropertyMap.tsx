import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../../types';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface PropertyMapProps {
  properties: Property[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  autoFitBounds?: boolean;
}

// Component to handle map bounds fitting
const MapBoundsHandler: React.FC<{ 
  properties: Property[]; 
  center?: [number, number];
  zoom?: number;
  autoFitBounds?: boolean;
}> = ({ properties, center, zoom, autoFitBounds = true }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // If explicit center and zoom are provided, use them (property details page)
    if (center && zoom !== undefined) {
      map.setView(center, zoom);
      return;
    }

    // Auto-fitting logic for cases where center/zoom aren't explicitly set
    if (properties.length === 0) {
      map.setView([39.8283, -98.5795], 4); // Center of US
      return;
    }

    if (properties.length === 1) {
      // Single property without explicit center/zoom
      const property = properties[0];
      map.setView([property.address.latitude, property.address.longitude], 14);
      return;
    }

    if (autoFitBounds && properties.length > 1) {
      // Multiple properties - fit bounds to show all markers
      const validCoordinates = properties
        .filter(property => 
          property.address.latitude && 
          property.address.longitude &&
          !isNaN(property.address.latitude) &&
          !isNaN(property.address.longitude)
        )
        .map(property => [property.address.latitude, property.address.longitude] as [number, number]);

      if (validCoordinates.length > 0) {
        const bounds = L.latLngBounds(validCoordinates);
        
        // Add padding around the bounds
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 12 // Don't zoom in too close
        });
      }
    }
  }, [map, properties, center, zoom, autoFitBounds]);

  return null;
};

const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  center,
  zoom,
  height = '100%',
  autoFitBounds = true,
}) => {
  const navigate = useNavigate();
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMapReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Calculate initial center and zoom if not provided
  const getInitialView = (): { center: [number, number]; zoom: number } => {
    // If explicit center and zoom provided, use them
    if (center && zoom !== undefined) {
      return { center, zoom };
    }

    if (properties.length === 0) {
      return { center: [39.8283, -98.5795], zoom: 4 }; // Center of US
    }

    if (properties.length === 1) {
      return {
        center: [properties[0].address.latitude, properties[0].address.longitude],
        zoom: 14
      };
    }

    // Multiple properties - calculate center
    const validProperties = properties.filter(p => 
      p.address.latitude && 
      p.address.longitude &&
      !isNaN(p.address.latitude) &&
      !isNaN(p.address.longitude)
    );

    if (validProperties.length === 0) {
      return { center: [39.8283, -98.5795], zoom: 4 };
    }

    const avgLat = validProperties.reduce((sum, p) => sum + p.address.latitude, 0) / validProperties.length;
    const avgLng = validProperties.reduce((sum, p) => sum + p.address.longitude, 0) / validProperties.length;
    
    return { center: [avgLat, avgLng], zoom: 8 };
  };

  const createCustomIcon = (property: Property) => {
    const priceText = property.inquire_for_pricing 
      ? 'Call' 
      : (property.price_per_day !== null && property.price_per_day !== undefined) 
        ? `$${property.price_per_day}` 
        : '';

    // If price is null/undefined and not inquire_for_pricing, just show the pin without price bubble
    if ((property.price_per_day === null || property.price_per_day === undefined) && !property.inquire_for_pricing) {
      return L.divIcon({
        className: 'custom-marker-wrapper',
        html: `
          <div class="custom-marker">
            <div class="marker-pin"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      });
    }

    // Show pin with price bubble
    return L.divIcon({
      className: 'custom-marker-wrapper',
      html: `
        <div class="custom-marker">
          <div class="marker-pin"></div>
          <div class="marker-price">${priceText}</div>
        </div>
      `,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50],
    });
  };

  const handleMarkerClick = (id: string) => {
    navigate(`/property/${id}`);
  };

  if (!mapReady) {
    return (
      <div 
        style={{ height }} 
        className="bg-gray-100 animate-pulse rounded-md flex items-center justify-center"
      >
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  const initialView = getInitialView();

  return (
    <div className="map-container" style={{ height, width: '100%' }}>
      <MapContainer
        center={initialView.center}
        zoom={initialView.zoom}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        className="z-0"
        scrollWheelZoom={true}
        attributionControl={false}
      >
        <TileLayer
          attribution=""
          url="https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=33c8c991-a3b5-41d7-969e-7dbc49564f9f"
          maxZoom={19}
          tileSize={256}
        />
        
        <MapBoundsHandler 
          properties={properties}
          center={center}
          zoom={zoom}
          autoFitBounds={autoFitBounds}
        />
        
        {properties.filter(property => 
          property.address.latitude && 
          property.address.longitude &&
          !isNaN(property.address.latitude) &&
          !isNaN(property.address.longitude)
        ).map((property) => (
          <Marker
            key={property.id}
            position={[property.address.latitude, property.address.longitude]}
            icon={createCustomIcon(property)}
            eventHandlers={{
              click: () => handleMarkerClick(property.id),
            }}
          >
            <Popup>
              <div className="w-48">
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className="w-full h-24 object-cover rounded-md mb-2"
                />
                <h3 className="font-medium text-sm">{property.title}</h3>
                <p className="text-xs text-gray-500 mb-1">
                  {property.address.city}, {property.address.state}
                </p>
                <p className="font-semibold text-sm">
                  {property.inquire_for_pricing
                    ? 'Inquire for pricing'
                    : `$${property.price_per_day}/day`}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      <style>{`
        .custom-marker-wrapper {
          background: transparent !important;
          border: none !important;
        }
        .custom-marker {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .marker-pin {
          width: 30px;
          height: 30px;
          background: #c13434;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          position: relative;
        }
        .marker-pin::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid #c13434;
        }
        .marker-label {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #c13434;
          text-align: center;
        }
        .marker-price {
          background: white;
          border: 2px solid #c13434;
          border-radius: 12px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: bold;
          color: #c13434;
          margin-top: 2px;
          white-space: nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default PropertyMap;