import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import InquiryForm from '../components/property/InquiryForm';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const PropertyInquiryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [userBrandInfo, setUserBrandInfo] = useState<string>('');

  useEffect(() => {
    if (!id) return;

    async function loadProperty() {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id as string)
          .single();

        if (error) throw error;
        setProperty(data);
      } catch (err) {
        console.error('Error loading property:', err);
        setError(err instanceof Error ? err.message : 'Failed to load property');
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [id]);

  // Load user organization about_brand if user is logged in
  useEffect(() => {
    if (user) {
      const fetchOrgBrand = async () => {
        try {
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('primary_organization_id')
            .eq('id', user.id)
            .single();
          if (profErr) throw profErr;

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
  }, [user]);
  if (!id) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-maroon-800 mb-2">Property Not Found</h2>
          <p className="text-maroon-600">The property you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
          <div className="flex gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <img
                src={property.images[0]}
                alt={property.title}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-maroon-800 mb-2 font-display">
                {property.title}
              </h1>
              <div className="flex items-center text-maroon-600 mb-2">
                <MapPin className="h-4 w-4 mr-1" />
                <span>
                  {property.address_city}, {property.address_state}
                </span>
              </div>
              <div className="text-maroon-600">
                {property.square_feet.toLocaleString()} sq ft
                {!property.inquire_for_pricing && (
                  <span className="ml-2 font-semibold">
                    • {formatCurrency(property.price_per_day || 0)} / day
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <InquiryForm 
          propertyId={id}
          initialBrandInfo={userBrandInfo}
          initialStartDate={searchParams.get('start_date') || ''}
          initialEndDate={searchParams.get('end_date') || ''}
        />
      </div>
    </div>
  );
};

export default PropertyInquiryPage;