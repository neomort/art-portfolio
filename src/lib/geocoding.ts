async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Check if the address is a Canadian postal code (format A1A 1A1 or A1A1A1)
      const canadianPostalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
      const isCanadianPostalCode = canadianPostalCodeRegex.test(address.trim());
      
      // For Canadian postal codes, add CA country code, otherwise search globally
      const countryParam = isCanadianPostalCode ? '&countrycodes=ca' : '';
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1${countryParam}`,
        {
          headers: {
            'User-Agent': 'SplitSpace Property Search/1.0' // Required by Nominatim ToS
          }
        }
      );
      
      // Check if the response is ok (status in the range 200-299)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Sort results to prioritize exact postal code matches
      const sorted = data.sort((a: any, b: any) => {
        const aIsPostal = a.address?.postcode === address ? 1 : 0;
        const bIsPostal = b.address?.postcode === address ? 1 : 0;
        return bIsPostal - aIsPostal;
      });
      
      if (sorted?.[0]) {
        // Return coordinates of best match
        return [parseFloat(sorted[0].lat), parseFloat(sorted[0].lon)];
      }

      // Fallback to first result if no exact match
      if (data?.[0]) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
      
      return null;
    } catch (error) {
      // On last attempt, throw the error
      if (attempt === MAX_RETRIES - 1) {
        return null;
      }
      
      // Otherwise wait and retry
      await delay(RETRY_DELAY);
    }
  }
  
  return null;
}

/**
 * Reverse geocode coordinates to a user-friendly city, state string.
 * Returns e.g. "Denver, CO" or "San Francisco, CA" or null if not found.
 */
// State/Province abbreviation lookup
const STATE_ABBREVIATIONS: Record<string, string> = {
  // US States
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO',
  'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
  
  // Canadian Provinces/Territories
  'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB', 
  'Newfoundland and Labrador': 'NL', 'Northwest Territories': 'NT', 'Nova Scotia': 'NS', 
  'Nunavut': 'NU', 'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC', 
  'Saskatchewan': 'SK', 'Yukon': 'YT',
  
  // French names for Canadian provinces (for Quebec primarily)
  'Québec': 'QC', 'Colombie-Britannique': 'BC', 'Terre-Neuve-et-Labrador': 'NL',
  'Île-du-Prince-Édouard': 'PE', 'Nouveau-Brunswick': 'NB', 'Nouvelle-Écosse': 'NS',
  'Territoires du Nord-Ouest': 'NT'
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SplitSpace Property Search/1.0'
        }
      }
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const address = data.address;
    if (!address) return null;
    // Prefer city, fall back to town/village, then state
    const city = address.city || address.town || address.village || address.hamlet || address.county;
    let region: string | undefined;
    
    // Check for Canadian address format first
    if (address.country_code === 'ca' || address.country === 'Canada') {
      // For Canadian addresses, use province information
      region = address.state || address.province || address.region || '';
      // Convert full province name to abbreviation if needed
      if (region && STATE_ABBREVIATIONS[region]) {
        region = STATE_ABBREVIATIONS[region];
      }
    } else {
      // For US and other countries, use the existing logic
      if (address.state_code && address.state_code.length === 2) {
        region = address.state_code;
      } else if (address.state && STATE_ABBREVIATIONS[address.state]) {
        region = STATE_ABBREVIATIONS[address.state];
      } else if (address.state && address.state.length >= 2) {
        // Fallback: Try to get a 2-letter abbreviation from the state name
        region = address.state
          .split(' ')
          .map((s: string) => s[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      } else {
        region = address.state_code || address.state || '';
      }
    }
    if (city && region) {
      return `${city}, ${region}`;
    }
    if (region) return region;
    if (address.state) return address.state;
    return null;
  } catch (error) {
    return null;
  }
};