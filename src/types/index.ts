// Type definitions for the SplitSpace application
import { Database } from './database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface User extends Omit<Profile, 'id' | 'created_at' | 'updated_at'> {
  id: string;
  created_at: string;
  updated_at: string;
  business_type: string;
  is_admin: boolean;
  needsProfileCompletion?: boolean;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  address: Address & {
    city?: string;
    state?: string;
  };
  address_city?: string; // For backward compatibility
  address_state?: string; // For backward compatibility
  neighborhood?: string; // Optional neighborhood field
  metro_area?: string;   // Optional metro area field
  images: string[];
  price_per_day?: number; // Optional if "Inquire for pricing"
  price_per_hour?: number; // Optional hourly pricing
  inquire_for_pricing: boolean;
  square_feet: number;
  amenities: string[];
  weekly_rate_type?: 'fixed' | 'percentage' | null;
  weekly_rate_value?: number | null;
  monthly_rate_type?: 'fixed' | 'percentage' | null;
  monthly_rate_value?: number | null;
  // New calculated pricing fields
  weekly_rate?: number | null;
  weekly_percent?: number | null; // integer percent
  monthly_rate?: number | null;
  monthly_percent?: number | null; // integer percent
  yearly_rate?: number | null;
  yearly_percent?: number | null; // integer percent
  yearly_rate_type?: 'fixed' | 'percentage' | null;
  yearly_rate_value?: number | null;
  property_type: PropertyType;
  availability: DateRange[];
  venue_id: string; // Reference to the owner
  created_at: string;
  updated_at: string;
  featured: boolean; // Indicates if this property should be displayed in featured section
  published: boolean; // Indicates if this property is visible in public listings
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  virtual_tour_url?: string;
  downloadable_files?: Array<{
    url: string;
    label: string;
    type: string;
  }>;
  // New: space attributes (e.g., gray_shell, white_box, built_out, etc.)
  space_attributes?: string[];
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
}

import type { LucideIcon } from 'lucide-react';

export type PropertyTypeCategory = 'conventional' | 'unconventional';

export interface PropertyTypeMeta {
  value: string;
  label: string;
  icon: LucideIcon;
  category: PropertyTypeCategory;
}

// Import icons from lucide-react (add or adjust as needed)
import {
  Plug,
  ArrowDownUp,
  DoorOpen,
  Sofa,
  Flower,
  Shirt,
  Accessibility,
  Flame,
  Wifi,
  Printer,
  Shield,
  Volume2,
  Droplet,
  Layers,
  PawPrint,
  Store,
  Factory,
  Landmark,
  Warehouse,
  ShoppingBag,
  Square,
  Calendar,
  Building2,
  GraduationCap,
  Church,
  Sprout,
  Scissors,
  Utensils,
  Beer,
  Coffee,
  Dumbbell,
  AppWindow,
  Image,
  Palette,
  Handshake,
  Trophy,
  PersonStanding,
  Martini,
  Drama,
  Sun,
  Home,
  Stethoscope,
  HelpCircle,
  Move,
  ParkingSquare,
  TrafficCone,
  Truck,
  Grape,
  Tractor,
  Megaphone,
  Sailboat,
  Waves,
  TreePine,
  Package,
  Building,
  HandCoins,
  Sparkles,
  Bus,
  Scan,
  MousePointer,
  TrendingUp,
  TrendingDown,
  CloudSun,
  ShoppingCart,
  Car,
  ConciergeBell,
  LampDesk,
  BedDouble,
  Grid2x2,
  Cigarette,
  VolumeX,
} from 'lucide-react';

export const PROPERTY_TYPES = [
  { value: 'storefront', label: 'Storefront', icon: Store, category: 'conventional' },
  { value: 'industrial', label: 'Industrial', icon: Factory, category: 'conventional' },
  { value: 'lobby', label: 'Lobby', icon: Landmark, category: 'conventional' },
  { value: 'warehouse', label: 'Warehouse', icon: Warehouse, category: 'conventional' },
  { value: 'mall_store', label: 'Mall Store', icon: ShoppingBag, category: 'conventional' },
  { value: 'mall_kiosk', label: 'Mall Kiosk', icon: Square, category: 'conventional' },
  { value: 'event_space', label: 'Event Space', icon: Calendar, category: 'conventional' },
  { value: 'office', label: 'Office', icon: Building2, category: 'conventional' },
  { value: 'school', label: 'School', icon: GraduationCap, category: 'conventional' },
  { value: 'church', label: 'Church', icon: Church, category: 'conventional' },
  { value: 'spa_wellness', label: 'Spa/Wellness', icon: Sprout, category: 'conventional' },
  { value: 'salon_beauty', label: 'Salon/Beauty', icon: Scissors, category: 'conventional' },
  { value: 'restaurant', label: 'Restaurant', icon: Utensils, category: 'conventional' },
  { value: 'bar_pub', label: 'Bar/Pub', icon: Beer, category: 'conventional' },
  { value: 'cafe', label: 'Café', icon: Coffee, category: 'conventional' },
  { value: 'fitness', label: 'Fitness', icon: Dumbbell, category: 'conventional' },
  { value: 'market_stall', label: 'Market Stall', icon: AppWindow, category: 'conventional' },
  { value: 'art_gallery', label: 'Art Gallery', icon: Image, category: 'conventional' },
  { value: 'creative_studio', label: 'Creative Studio', icon: Palette, category: 'conventional' },
  { value: 'conference', label: 'Conference', icon: Handshake, category: 'conventional' },
  { value: 'sports_venue', label: 'Sports Venue', icon: Trophy, category: 'conventional' },
  { value: 'dance_space', label: 'Dance Space', icon: PersonStanding, category: 'conventional' },
  { value: 'nightclub', label: 'Nightclub', icon: Martini, category: 'conventional' },
  { value: 'theater', label: 'Theater', icon: Drama, category: 'conventional' },
  { value: 'festival', label: 'Festival', icon: Sun, category: 'conventional' },
  { value: 'residence', label: 'Residence', icon: Home, category: 'conventional' },
  { value: 'healthcare', label: 'Healthcare', icon: Stethoscope, category: 'conventional' },
  { value: 'other', label: 'Other', icon: HelpCircle, category: 'conventional' },
  // --- UNCONVENTIONAL PROPERTY TYPES ---
  { value: 'empty_lot', label: 'Empty Lot', icon: Move, category: 'unconventional' },
  { value: 'parking_lot', label: 'Parking Lot', icon: ParkingSquare, category: 'unconventional' },
  { value: 'roadside', label: 'Roadside', icon: TrafficCone, category: 'unconventional' },
  { value: 'truck_space', label: 'Truck space', icon: Truck, category: 'unconventional' },
  { value: 'winery', label: 'Winery', icon: Grape, category: 'unconventional' },
  { value: 'farm', label: 'Farm', icon: Tractor, category: 'unconventional' },
  { value: 'greenhouse', label: 'Greenhouse', icon: Sprout, category: 'unconventional' },
  { value: 'advertisement', label: 'Advertisement', icon: Megaphone, category: 'unconventional' },
  { value: 'boat', label: 'Boat', icon: Sailboat, category: 'unconventional' },
  { value: 'pier', label: 'Pier', icon: Waves, category: 'unconventional' },
  { value: 'park', label: 'Park', icon: TreePine, category: 'unconventional' },
  { value: 'container', label: 'Container', icon: Package, category: 'unconventional' },
  { value: 'rooftop', label: 'Rooftop', icon: Building, category: 'unconventional' },
  { value: 'sponsorship', label: 'Sponsorship', icon: HandCoins, category: 'unconventional' },
  { value: 'unique_space', label: 'Unique Space', icon: Sparkles, category: 'unconventional' },
  { value: 'mobile_space', label: 'Mobile Space', icon: Bus, category: 'unconventional' },
] as const;

export type PropertyType = typeof PROPERTY_TYPES[number]['value'];

export function getPropertyTypeLabel(type: PropertyType): string {
  const entry = PROPERTY_TYPES.find((t) => t.value === type);
  return entry ? entry.label : type;
}

export const AMENITIES = [
  { value: 'ac', label: 'A/C', icon: Sun },
  { value: 'bar', label: 'Bar', icon: Beer },
  { value: 'toilets', label: 'Toilets', icon: HelpCircle },
  { value: 'counters', label: 'Counters', icon: Square },
  { value: 'electric_outlet', label: 'Electric Outlet', icon: Plug },
  { value: 'elevator', label: 'Elevator', icon: ArrowDownUp },
  { value: 'fitting_rooms', label: 'Fitting Rooms', icon: DoorOpen },
  { value: 'furniture', label: 'Furniture', icon: Sofa },
  { value: 'garden_terrace', label: 'Garden/Terrace', icon: Flower },
  { value: 'garment_rack', label: 'Garment Rack', icon: Shirt },
  { value: 'ada_access', label: 'ADA Access', icon: Accessibility },
  { value: 'heating', label: 'Heating', icon: Flame },
  { value: 'internet', label: 'Internet', icon: Wifi },
  { value: 'kitchen', label: 'Kitchen', icon: Utensils },
  { value: 'loading_dock', label: 'Loading dock', icon: Truck },
  { value: 'liquor_license', label: 'Liquor license', icon: Martini },
  { value: 'printer', label: 'Printer', icon: Printer },
  { value: 'parking', label: 'Parking', icon: ParkingSquare },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'soundsystem', label: 'Soundsystem', icon: Volume2 },
  { value: 'storage_stock', label: 'Storage/Stock', icon: Package },
  { value: 'water', label: 'Water', icon: Droplet },
  { value: 'window_display', label: 'Window display', icon: AppWindow },
  { value: 'shelves', label: 'Shelves', icon: Layers },
  { value: 'pets_allowed', label: 'Pets allowed', icon: PawPrint },
  // --- New amenities ---
  { value: 'drive_in_display', label: 'Drive-in Display', icon: Car },
  { value: 'concierge', label: 'Concierge', icon: ConciergeBell },
  { value: 'lighting', label: 'Lighting', icon: LampDesk },
  { value: 'living_space', label: 'Living Space', icon: BedDouble },
  { value: 'multiple_rooms', label: 'Multiple Rooms', icon: Grid2x2 },
  { value: 'smoking_area', label: 'Smoking Area', icon: Cigarette },
  { value: 'soundproof', label: 'Soundproof', icon: VolumeX },
  { value: 'view', label: 'View', icon: Image },
] as const;

export type Amenity = typeof AMENITIES[number]['value'];

// New: Space Attributes options
export const SPACE_ATTRIBUTES = [
  { value: 'gray_shell', label: 'Gray Shell', icon: Scan },
  { value: 'white_box', label: 'White Box', icon: Square },
  { value: 'built_out', label: 'Built Out & Ready', icon: MousePointer },
  { value: 'street_front', label: 'Street Front', icon: DoorOpen },
  { value: 'ground_floor', label: 'Ground Floor', icon: Store },
  { value: 'upper_floor', label: 'Upper Floor', icon: TrendingUp },
  { value: 'basement', label: 'Basement', icon: TrendingDown },
  { value: 'daylight', label: 'Daylight', icon: Sun },
  { value: 'outdoor', label: 'Outdoor Space', icon: CloudSun },
  { value: 'shopping_district', label: 'Shopping District', icon: ShoppingBag },
  { value: 'shopping_center', label: 'Shopping Center', icon: ShoppingCart },
  { value: 'shopping_mall', label: 'Shopping Mall', icon: ShoppingBag },
  { value: 'office_building', label: 'Office Building', icon: Building },
  { value: 'industrial', label: 'Industrial', icon: Factory },
  { value: 'downtown', label: 'Downtown', icon: Building2 },
  { value: 'suburban', label: 'Suburban', icon: Home },
  { value: 'countryside', label: 'Countryside', icon: TreePine },
  { value: 'mobile_space', label: 'Mobile Space', icon: Bus, category: 'unconventional' },
] as const;

export type SpaceAttribute = typeof SPACE_ATTRIBUTES[number]['value'];

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface Inquiry {
  id: string;
  property_id: string;
  user_id: string; // User who made the inquiry
  start_date: string;
  end_date: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
  initiator_closed: boolean;
  responder_closed: boolean;
  initiator_deleted: boolean;
  responder_deleted: boolean;
  initiator_last_read_message_id: string | null;
  responder_last_read_message_id: string | null;
  property?: Property;
  checkSessionStatus: () => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
}

export type InquiryStatus = 
  | 'pending'
  | 'viewed'
  | 'responded'
  | 'converted_to_proposal'
  | 'declined'
  | 'closed';

export interface Proposal {
  id: string;
  inquiry_id: string;
  price_total: number;
  currency: string;
  message: string;
  status: ProposalStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export type ProposalStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface Booking {
  id: string;
  property_id: string;
  user_id: string;
  proposal_id?: string; // If created from a proposal
  proposal?: Proposal & { inquiry_id?: string };
  inquiry?: Partial<Inquiry>;

  property?: Property;
  start_date: string;
  end_date: string;
  price_total: number;
  currency: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'canceled'
  | 'completed';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'refunded'
  | 'failed';

export interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
  property?: Property;
}

export interface SearchFilters {
  location?: string;
  start_date?: string;
  end_date?: string;
  min_price?: number;
  max_price?: number;
  min_square_feet?: number;
  max_square_feet?: number;
  property_type?: PropertyType[];
  amenities?: string[];
}

export interface Review {
  id: string;
  property_id: string;
  reviewer_id: string;
  rating: number;
  content: string;
  verified_booking: boolean;
  review_eligibility: any;
  status: string;
  created_at: string;
  updated_at: string;
}