-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure the extension is available in the current session
SET search_path TO public, extensions;

-- Create profiles table if it doesn't exist (skip if exists)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
    full_name text NOT NULL,
    company_name text,
    phone text,
    avatar_url text,
    business_type text,
    email text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create properties table
CREATE TABLE IF NOT EXISTS public.properties (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    address_street text NOT NULL,
    address_city text NOT NULL,
    address_state text NOT NULL,
    address_postal_code text NOT NULL,
    address_country text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    images text[] NOT NULL,
    price_per_day numeric,
    inquire_for_pricing boolean NOT NULL DEFAULT false,
    square_feet integer NOT NULL,
    amenities text[] NOT NULL,
    property_type text NOT NULL,
    venue_id uuid NOT NULL REFERENCES profiles(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create property_availability table
CREATE TABLE IF NOT EXISTS public.property_availability (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create inquiries table
CREATE TABLE IF NOT EXISTS public.inquiries (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id),
    start_date date NOT NULL,
    end_date date NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create proposals table
CREATE TABLE IF NOT EXISTS public.proposals (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    price_total numeric NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    message text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id uuid NOT NULL REFERENCES properties(id),
    user_id uuid NOT NULL REFERENCES profiles(id),
    proposal_id uuid REFERENCES proposals(id),
    start_date date NOT NULL,
    end_date date NOT NULL,
    price_total numeric NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    status text NOT NULL DEFAULT 'confirmed',
    payment_status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Properties are viewable by everyone" ON public.properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;
DROP POLICY IF EXISTS "Property availability is viewable by everyone" ON public.property_availability;
DROP POLICY IF EXISTS "Property owners can manage availability" ON public.property_availability;
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Authenticated users can create inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can view their related proposals" ON public.proposals;
DROP POLICY IF EXISTS "Property owners can create proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can view their related bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;

-- Create RLS Policies

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Properties policies
CREATE POLICY "Properties are viewable by everyone"
    ON public.properties FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own properties"
    ON public.properties FOR INSERT
    WITH CHECK (auth.uid() = venue_id);

CREATE POLICY "Users can update their own properties"
    ON public.properties FOR UPDATE
    USING (auth.uid() = venue_id);

CREATE POLICY "Users can delete their own properties"
    ON public.properties FOR DELETE
    USING (auth.uid() = venue_id);

-- Property availability policies
CREATE POLICY "Property availability is viewable by everyone"
    ON public.property_availability FOR SELECT
    USING (true);

CREATE POLICY "Property owners can manage availability"
    ON public.property_availability
    USING (auth.uid() IN (
        SELECT venue_id FROM properties WHERE id = property_id
    ));

-- Inquiries policies
CREATE POLICY "Users can view their own inquiries"
    ON public.inquiries FOR SELECT
    USING (
        auth.uid() = user_id OR 
        auth.uid() IN (
            SELECT venue_id FROM properties WHERE id = property_id
        )
    );

CREATE POLICY "Authenticated users can create inquiries"
    ON public.inquiries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Proposals policies
CREATE POLICY "Users can view their related proposals"
    ON public.proposals FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM inquiries WHERE id = inquiry_id
        ) OR
        auth.uid() IN (
            SELECT venue_id FROM properties 
            WHERE id IN (
                SELECT property_id FROM inquiries WHERE id = inquiry_id
            )
        )
    );

CREATE POLICY "Property owners can create proposals"
    ON public.proposals FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT venue_id FROM properties 
            WHERE id IN (
                SELECT property_id FROM inquiries WHERE id = inquiry_id
            )
        )
    );

-- Bookings policies
CREATE POLICY "Users can view their related bookings"
    ON public.bookings FOR SELECT
    USING (
        auth.uid() = user_id OR
        auth.uid() IN (
            SELECT venue_id FROM properties WHERE id = property_id
        )
    );

CREATE POLICY "Users can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
DROP TRIGGER IF EXISTS update_inquiries_updated_at ON inquiries;
DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();