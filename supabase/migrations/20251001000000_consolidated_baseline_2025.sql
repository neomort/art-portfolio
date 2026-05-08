-- Consolidated baseline migration for development period (June - September 2025)
-- This migration consolidates 216 migration files that were archived
-- It represents the database state as of October 1, 2025
-- Generated from production database schema

-- Note: This migration should only be run on fresh databases
-- Existing databases should already have these changes applied

BEGIN;

-- Create custom types (safe to run multiple times)
DO $$ BEGIN
  CREATE TYPE org_adjustment_type AS ENUM (
    'capacity_surcharge',
    'user_selected_discount',
    'off_day_surcharge',
    'off_hours_surcharge',
    'service_fee',
    'tax',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create all core tables that existed by Oct 2025
-- Using IF NOT EXISTS to make this migration safe for existing databases

-- Core user and organization tables
CREATE TABLE IF NOT EXISTS profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  full_name text NOT NULL,
  company_name text,
  phone text,
  avatar_url text,
  business_type text,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_admin boolean,
  brevo_opt_in boolean,
  brevo_opt_in_ts timestamp with time zone,
  primary_organization_id uuid,
  survey_answers jsonb,
  password_set boolean NOT NULL DEFAULT false,
  stripe_account_id text,
  charges_enabled boolean,
  payouts_enabled boolean,
  service_credit numeric DEFAULT 0
);

-- Add missing columns to existing profiles table (safe to run multiple times)
DO $$ BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'brevo_opt_in') THEN
    ALTER TABLE profiles ADD COLUMN brevo_opt_in boolean;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'brevo_opt_in_ts') THEN
    ALTER TABLE profiles ADD COLUMN brevo_opt_in_ts timestamp with time zone;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'primary_organization_id') THEN
    ALTER TABLE profiles ADD COLUMN primary_organization_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'survey_answers') THEN
    ALTER TABLE profiles ADD COLUMN survey_answers jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'password_set') THEN
    ALTER TABLE profiles ADD COLUMN password_set boolean NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'stripe_account_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_account_id text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'charges_enabled') THEN
    ALTER TABLE profiles ADD COLUMN charges_enabled boolean;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'payouts_enabled') THEN
    ALTER TABLE profiles ADD COLUMN payouts_enabled boolean;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'service_credit') THEN
    ALTER TABLE profiles ADD COLUMN service_credit numeric DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text,
  brevo_company_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  stripe_account_id text,
  charges_enabled boolean,
  payouts_enabled boolean,
  service_credit numeric NOT NULL DEFAULT 0,
  about_brand text,
  default_timezone text,
  business_type text
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_member_invites (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  invited_by uuid REFERENCES profiles(id),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add missing columns to existing properties table (safe to run multiple times)
DO $$ BEGIN
  -- Add organization_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'properties' AND column_name = 'organization_id') THEN
    ALTER TABLE properties ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Property and venue tables
CREATE TABLE IF NOT EXISTS properties (
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
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  tax_rate numeric,
  fee_type text,
  fee_value numeric,
  fee_description text,
  featured boolean,
  weekly_rate_type text,
  weekly_rate_value numeric,
  monthly_rate_type text,
  monthly_rate_value numeric,
  yearly_rate_type text,
  yearly_rate_value numeric,
  published boolean,
  capacity integer,
  organization_id uuid,
  price_per_hour numeric,
  iana_timezone text,
  applied_adjustment_ids text[],
  neighborhood text,
  metro_area text,
  location_type text[],
  currency text,
  fast_responder boolean,
  virtual_tour_url text,
  floor_plan text,
  weekly_rate numeric(10,2),
  weekly_percent integer,
  monthly_rate numeric(10,2),
  monthly_percent integer,
  yearly_rate numeric(10,2),
  yearly_percent integer,
  space_attributes text[] NOT NULL,
  downloadable_files jsonb
);

CREATE TABLE IF NOT EXISTS property_schedule (
  id uuid NOT NULL,
  property_id uuid NOT NULL,
  available_from date,
  available_until date,
  daily_schedule jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  limit_availability boolean,
  ical_url text
);

CREATE TABLE IF NOT EXISTS property_availability (
  id uuid NOT NULL,
  property_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone NOT NULL
);

-- Booking and inquiry tables
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid NOT NULL,
  property_id uuid NOT NULL,
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  initiator_closed boolean NOT NULL,
  responder_closed boolean NOT NULL,
  initiator_deleted boolean NOT NULL,
  responder_deleted boolean NOT NULL,
  initiator_last_read_message_id uuid,
  responder_last_read_message_id uuid,
  selected_adjustment_ids text[],
  headcount integer,
  start_at timestamp with time zone,
  end_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS proposals (
  id uuid NOT NULL,
  inquiry_id uuid NOT NULL,
  price_total numeric NOT NULL,
  currency text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  request_id text
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid NOT NULL,
  property_id uuid NOT NULL,
  user_id uuid NOT NULL,
  proposal_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_total numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  payment_status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  stripe_payment_intent_id text,
  stripe_client_secret text,
  service_credit_applied_cents integer NOT NULL,
  service_credit_applied_pi_id text,
  service_credit_applied_at timestamp with time zone,
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  kind text
);

-- Communication tables
CREATE TABLE IF NOT EXISTS messages (
  id uuid NOT NULL,
  inquiry_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL
);

-- Review tables
CREATE TABLE IF NOT EXISTS reviews (
  id uuid NOT NULL,
  property_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating integer NOT NULL,
  content text NOT NULL,
  verified_booking boolean NOT NULL,
  review_eligibility jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS review_responses (
  id uuid NOT NULL,
  review_id uuid NOT NULL,
  responder_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS review_reminders (
  id uuid NOT NULL,
  booking_id uuid NOT NULL,
  property_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  reminder_type text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  processing_started_at timestamp with time zone,
  sent_at timestamp with time zone,
  email_request_id text,
  error_message text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  review_submitted_at timestamp with time zone,
  review_id uuid
);

-- Organization adjustments and financial tables
CREATE TABLE IF NOT EXISTS organization_adjustments (
  id uuid NOT NULL,
  organization_id uuid NOT NULL,
  type org_adjustment_type NOT NULL,
  data jsonb NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_credit_ledger (
  id uuid NOT NULL,
  organization_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  payment_intent_id text NOT NULL,
  amount_cents integer NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_inquiry_forms (
  id uuid NOT NULL,
  organization_id uuid NOT NULL,
  survey_json jsonb NOT NULL,
  version integer NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  updated_by uuid
);

-- Content and system tables
CREATE TABLE IF NOT EXISTS pages (
  id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  type text NOT NULL,
  page_type text NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

-- FAQ tables
CREATE TABLE IF NOT EXISTS faq_categories (
  id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS faq_entries (
  id uuid NOT NULL,
  category_id uuid,
  question text NOT NULL,
  answer_md text NOT NULL,
  tags text[] NOT NULL,
  position integer NOT NULL,
  published boolean NOT NULL,
  search_tsv tsvector,
  created_at timestamp with time zone NOT NULL
);

-- Utility tables
CREATE TABLE IF NOT EXISTS favorites (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  property_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS edge_rate_limits (
  id uuid NOT NULL,
  user_id uuid,
  ip text,
  function text NOT NULL,
  created_at timestamp with time zone NOT NULL
);

-- Webhook and notification tables
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid NOT NULL,
  event_type text,
  event_id text,
  payment_intent_id text,
  booking_id text,
  status text,
  error text,
  request_body text,
  created_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS webhook_notification_log (
  id uuid NOT NULL,
  payment_intent_id text,
  booking_id text,
  notification_type text,
  recipient_email text,
  recipient_name text,
  status text,
  error text,
  response_data jsonb,
  created_at timestamp with time zone,
  has_attachments boolean
);

CREATE TABLE IF NOT EXISTS sent_notifications (
  id uuid NOT NULL,
  request_id text NOT NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  has_attachments boolean
);

-- Data import and analysis tables
CREATE TABLE IF NOT EXISTS import_datamining (
  id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  address_street text NOT NULL,
  address_city text NOT NULL,
  address_state text NOT NULL,
  address_postal_code text NOT NULL,
  address_country text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  photos text[] NOT NULL,
  price_per_day numeric,
  organization_id uuid,
  listing_urls text[],
  property_url text,
  address text,
  owner_name text,
  owner_phone text,
  owner_email text,
  broker_name text,
  broker_phone text,
  broker_email text,
  broker_url text,
  processing_status text,
  processed_at timestamp with time zone,
  processing_errors text[],
  emailed_ts timestamp with time zone
);

CREATE TABLE IF NOT EXISTS leases (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  upload_status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS lease_clauses (
  id uuid NOT NULL,
  lease_id uuid NOT NULL,
  clause_type text NOT NULL,
  summary text NOT NULL,
  risk_flag text NOT NULL,
  original_text text NOT NULL,
  page_number integer,
  confidence_score numeric,
  created_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id uuid NOT NULL,
  lease_id uuid NOT NULL,
  permissibility_status text,
  summary_text text,
  restrictions_summary text,
  responsibilities_summary text,
  monthly_lease_payment numeric,
  total_leased_area numeric,
  lease_area_unit text,
  raw_ai_response jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  term_length_months integer,
  renewal_options text,
  exclusivity_rights text,
  cam_charges text,
  termination_rights text,
  base_rent_psf numeric
);

-- Create essential indexes (simplified version)
-- Only create indexes if the column exists
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_properties_venue_id ON properties(venue_id);

-- Check if organization_id column exists before creating index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'properties' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_properties_organization_id ON properties(organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_messages_inquiry_id ON messages(inquiry_id);

-- Enable RLS on key tables (simplified)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

COMMIT;
