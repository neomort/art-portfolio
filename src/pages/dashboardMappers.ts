// Pure mapper utilities extracted from DashboardPage for unit testing and reuse.
// These mappers normalize shapes and coerce numeric/string fields.

export type UUID = string;

export interface DashboardProperty {
  id: UUID;
  title?: string | null;
  venue_id: UUID;
  organization_id?: UUID | null;
  images?: string[] | null;
  profiles?: { id: UUID; full_name?: string | null; email?: string | null; phone?: string | null } | null;
  organization?: { id: UUID; name?: string | null } | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fee_type?: 'fixed' | 'percentage' | null;
  fee_value?: number | null;
  fee_description?: string | null;
  tax_rate?: number | null;
  price_per_day?: number | null;
  published?: boolean | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

export interface DashboardInquiry {
  id: UUID;
  user_id: UUID;
  property_id: UUID;
  created_at: string;
  status?: string | null;
  message?: string | null;
  initiator_deleted: boolean;
  responder_deleted: boolean;
  start_date?: string | null;
  end_date?: string | null;
  property?: { title?: string | null; venue_id: UUID } | null;
}

export interface ProposalSummary {
  id: UUID;
  inquiry_id?: UUID | null;
  price_total?: number | null;
  currency?: string | null;
  message?: string | null;
}

export interface CustomerSummary {
  id: UUID;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PaymentBreakdown {
  base_price: number;
  taxes: number;
  fees: number;
  fee_description: string | null;
}

export interface DashboardBooking {
  id: UUID;
  user_id: UUID;
  property_id: UUID;
  start_date: string;
  end_date: string;
  created_at: string;
  status: 'pending' | 'confirmed' | 'canceled' | string;
  price_total?: number | null;
  payment_status?: string | null;
  property?: DashboardProperty | null;
  proposal?: ProposalSummary | null;
  customer?: CustomerSummary | null;
  inquiry: { id: UUID; message?: string | null; created_at: string } | null;
  payment_breakdown: PaymentBreakdown | null;
}

// Mapper helpers to coerce raw Supabase rows to local dashboard types
export const toDashboardProperty = (row: unknown): DashboardProperty => {
  const r = (row && typeof row === 'object') ? (row as Record<string, any>) : {};
  const addr = (r as any).address || {};
  const address = {
    street: addr.street ?? r.address_street ?? null,
    city: addr.city ?? r.address_city ?? null,
    state: addr.state ?? r.address_state ?? null,
    postalCode: addr.postalCode ?? r.address_postal_code ?? null,
    country: addr.country ?? r.address_country ?? null,
    latitude: addr.latitude != null ? Number(addr.latitude) : (r.latitude != null ? Number(r.latitude) : null),
    longitude: addr.longitude != null ? Number(addr.longitude) : (r.longitude != null ? Number(r.longitude) : null),
  };
  return {
    id: r.id,
    title: r.title ?? null,
    venue_id: r.venue_id,
    organization_id: r.organization_id ?? null,
    images: r.images ?? null,
    profiles: r.profiles ? {
      id: r.profiles.id,
      full_name: r.profiles.full_name ?? null,
      email: r.profiles.email ?? null,
      phone: r.profiles.phone ?? null,
    } : null,
    organization: r.organization
      ? { id: r.organization.id, name: r.organization.name ?? null }
      : (r.profiles && (r.profiles as any).organization
          ? { id: (r.profiles as any).organization.id, name: (r.profiles as any).organization.name ?? null }
          : null),
    address_street: r.address_street ?? null,
    address_city: r.address_city ?? null,
    address_state: r.address_state ?? null,
    address_postal_code: r.address_postal_code ?? null,
    address_country: r.address_country ?? null,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    fee_type: r.fee_type ?? null,
    fee_value: r.fee_value != null ? Number(r.fee_value) : null,
    fee_description: r.fee_description ?? null,
    tax_rate: r.tax_rate != null ? Number(r.tax_rate) : null,
    price_per_day: r.price_per_day != null ? Number(r.price_per_day) : null,
    published: typeof r.published === 'boolean' ? r.published : (r.published == null ? null : !!r.published),
    address,
  };
};

export const toDashboardInquiry = (row: unknown): DashboardInquiry => {
  const r = (row && typeof row === 'object') ? (row as Record<string, any>) : {};
  return {
    id: r.id,
    user_id: r.user_id,
    property_id: r.property_id,
    created_at: r.created_at,
    status: r.status ?? null,
    message: r.message ?? null,
    initiator_deleted: !!r.initiator_deleted,
    responder_deleted: !!r.responder_deleted,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    property: r.property ? { title: r.property.title ?? null, venue_id: r.property.venue_id } : null,
  };
};

export const toDashboardBooking = (row: unknown): DashboardBooking => {
  const r = (row && typeof row === 'object') ? (row as Record<string, any>) : {};
  return {
    id: r.id,
    user_id: r.user_id,
    property_id: r.property_id,
    start_date: r.start_date,
    end_date: r.end_date,
    created_at: r.created_at,
    status: typeof r.status === 'string' ? r.status : 'pending',
    price_total: r.price_total != null ? Number(r.price_total) : null,
    payment_status: r.payment_status ?? null,
    property: r.property ? toDashboardProperty(r.property) : null,
    proposal: r.proposal ? {
      id: r.proposal.id,
      inquiry_id: r.proposal.inquiry_id ?? null,
      price_total: r.proposal.price_total != null ? Number(r.proposal.price_total) : null,
      currency: r.proposal.currency ?? null,
      message: r.proposal.message ?? null,
    } : null,
    customer: r.customer ? {
      id: r.customer.id,
      full_name: r.customer.full_name ?? null,
      email: r.customer.email ?? null,
      phone: r.customer.phone ?? null,
    } : null,
    inquiry: null,
    payment_breakdown: null,
  };
};
