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

-- Note: Properties (artworks) and organizations will be created through the app interface
-- This keeps the seed data minimal and focused on reference data only
