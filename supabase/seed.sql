-- Art Portfolio Seed Data
-- This script creates minimal sample data for an art portfolio
-- Adapted from the SplitSpace real estate marketplace structure

-- Sample artist profile
-- Note: This will be created when a user signs up via Supabase Auth
-- The profile is automatically created by a trigger in the migrations

-- Sample artwork categories (using property_types table)
-- These will be adapted for art portfolio use
INSERT INTO property_types (name, slug, description, icon, sort_order) VALUES
  ('Painting', 'painting', 'Oil, acrylic, watercolor paintings', '🎨', 1),
  ('Sculpture', 'sculpture', '3D artworks in various materials', '🗿', 2),
  ('Photography', 'photography', 'Digital and film photography', '📸', 3),
  ('Digital Art', 'digital-art', 'Digital illustrations and digital media', '💻', 4),
  ('Mixed Media', 'mixed-media', 'Artworks combining multiple mediums', '🎭', 5)
ON CONFLICT (slug) DO NOTHING;

-- Sample amenities (will be adapted for art portfolio features)
INSERT INTO amenities (name, slug, description, icon) VALUES
  ('Framed', 'framed', 'Artwork comes with professional framing', '🖼️'),
  ('Certificate of Authenticity', 'coa', 'Includes certificate of authenticity', '📜'),
  ('Signed', 'signed', 'Artwork is signed by the artist', '✍️'),
  ('Limited Edition', 'limited-edition', 'Part of a limited edition run', '🔢')
ON CONFLICT (slug) DO NOTHING;

-- Sample organization
INSERT INTO organizations (name, slug, description) VALUES
  ('Demo Art Gallery', 'demo-art-gallery', 'A sample art gallery for demonstration')
ON CONFLICT DO NOTHING;

-- Get organization ID for sample data
DO $$
DECLARE
  org_id UUID;
  painting_type_id UUID;
  sculpture_type_id UUID;
  photography_type_id UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE slug = 'demo-art-gallery' LIMIT 1;
  SELECT id INTO painting_type_id FROM property_types WHERE slug = 'painting' LIMIT 1;
  SELECT id INTO sculpture_type_id FROM property_types WHERE slug = 'sculpture' LIMIT 1;
  SELECT id INTO photography_type_id FROM property_types WHERE slug = 'photography' LIMIT 1;

  -- Sample artworks (properties)
  INSERT INTO properties (
    title,
    description,
    property_type,
    organization_id,
    price_per_day,
    published,
    featured,
    address_city,
    address_state,
    latitude,
    longitude
  ) VALUES
    ('Sunset Over Mountains', 'A beautiful oil painting depicting a sunset over mountain ranges. This piece captures the warm colors of dusk with intricate brushwork.', painting_type_id, org_id, 2500, true, true, 'San Francisco', 'CA', 37.7749, -122.4194),
    ('Abstract Dreams', 'An abstract acrylic painting exploring themes of dreams and subconscious imagery. Bold colors and dynamic composition.', painting_type_id, org_id, 1800, true, true, 'Los Angeles', 'CA', 34.0522, -118.2437),
    ('Bronze Warrior', 'A bronze sculpture depicting a warrior in dynamic pose. Hand-casted with meticulous attention to detail.', sculpture_type_id, org_id, 5000, true, false, 'New York', 'NY', 40.7128, -74.0060),
    ('Urban Light', 'A black and white photograph capturing urban light and shadow. Printed on archival paper.', photography_type_id, org_id, 800, true, true, 'Chicago', 'IL', 41.8781, -87.6298),
    ('Digital Horizon', 'A digital art piece exploring the intersection of technology and nature. High-resolution digital print.', painting_type_id, org_id, 1200, true, false, 'Seattle', 'WA', 47.6062, -122.3321)
  ON CONFLICT DO NOTHING;
END $$;
