import { toDashboardProperty, toDashboardInquiry, toDashboardBooking } from '../dashboardMappers';

// Helper to strip undefined to ease equality checks
const stripUndef = (obj: any) => JSON.parse(JSON.stringify(obj));

describe('Dashboard mappers', () => {
  describe('toDashboardProperty', () => {
    it('maps flat address fields into nested address and coerces numbers', () => {
      const row = {
        id: 'prop_1',
        title: 'Venue A',
        venue_id: 'user_1',
        images: ['a.jpg'],
        address_street: '123 Main',
        address_city: 'Austin',
        address_state: 'TX',
        address_postal_code: '78701',
        address_country: 'US',
        latitude: '30.27',
        longitude:  '-97.74',
        fee_type: 'fixed',
        fee_value: '25',
        fee_description: 'Cleaning',
        tax_rate: '8.25',
        price_per_day: '100'
      } as any;

      const out = toDashboardProperty(row);

      expect(out.id).toBe('prop_1');
      expect(out.title).toBe('Venue A');
      expect(out.venue_id).toBe('user_1');
      expect(out.images).toEqual(['a.jpg']);

      expect(out.address).toEqual({
        street: '123 Main',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
        latitude: 30.27,
        longitude: -97.74,
      });

      expect(out.latitude).toBe(30.27);
      expect(out.longitude).toBe(-97.74);
      expect(out.fee_type).toBe('fixed');
      expect(out.fee_value).toBe(25);
      expect(out.fee_description).toBe('Cleaning');
      expect(out.tax_rate).toBe(8.25);
      expect(out.price_per_day).toBe(100);
    });

    it('prefers nested address over flat fields', () => {
      const row = {
        id: 'prop_2',
        venue_id: 'user_1',
        address_city: 'Fallback City',
        address_state: 'FS',
        address: {
          city: 'Primary City',
          state: 'PS',
          street: 'Nested St',
          postalCode: '00000',
          country: 'US',
          latitude: '1.23',
          longitude: '4.56',
        },
      } as any;

      const out = toDashboardProperty(row);
      expect(out.address?.city).toBe('Primary City');
      expect(out.address?.state).toBe('PS');
      expect(out.address?.street).toBe('Nested St');
      expect(out.address?.latitude).toBe(1.23);
      expect(out.address?.longitude).toBe(4.56);
    });
  });

  describe('toDashboardInquiry', () => {
    it('maps inquiry fields and booleans', () => {
      const row = {
        id: 'inq_1',
        user_id: 'user_1',
        property_id: 'prop_1',
        created_at: '2024-01-01',
        status: null,
        message: 'Hello',
        initiator_deleted: 0,
        responder_deleted: 1,
        property: { title: 'T', venue_id: 'owner_1' },
      } as any;

      const out = toDashboardInquiry(row);
      expect(out).toEqual(
        expect.objectContaining({
          id: 'inq_1',
          user_id: 'user_1',
          property_id: 'prop_1',
          created_at: '2024-01-01',
          status: null,
          message: 'Hello',
          initiator_deleted: false,
          responder_deleted: true,
          property: { title: 'T', venue_id: 'owner_1' },
        })
      );
    });
  });

  describe('toDashboardBooking', () => {
    it('maps booking fields, defaults status, coerces numbers, and nests property', () => {
      const row = {
        id: 'bk_1',
        user_id: 'user_a',
        property_id: 'prop_1',
        start_date: '2024-02-01',
        end_date: '2024-02-02',
        created_at: '2024-02-01T00:00:00Z',
        status: undefined,
        price_total: '250.50',
        payment_status: 'paid',
        property: {
          id: 'prop_1',
          venue_id: 'owner_1',
          address_city: 'Austin',
          address_state: 'TX',
          fee_type: 'percentage',
          fee_value: '10',
          tax_rate: '8.25',
          price_per_day: '100',
        },
        proposal: { id: 'pp_1', inquiry_id: 'inq_1', price_total: '250.50', currency: 'usd', message: null },
        customer: { id: 'c_1', full_name: 'X', email: 'e', phone: null },
      } as any;

      const out = toDashboardBooking(row);

      expect(out.status).toBe('pending');
      expect(out.price_total).toBe(250.50);
      expect(out.payment_status).toBe('paid');

      // property nested via toDashboardProperty
      expect(out.property).toBeTruthy();
      expect(out.property?.address?.city).toBe('Austin');
      expect(out.property?.fee_type).toBe('percentage');
      expect(out.property?.fee_value).toBe(10);
      expect(out.property?.tax_rate).toBe(8.25);
      expect(out.property?.price_per_day).toBe(100);

      // proposal/customer coercion
      expect(out.proposal).toEqual({
        id: 'pp_1',
        inquiry_id: 'inq_1',
        price_total: 250.50,
        currency: 'usd',
        message: null,
      });
      expect(out.customer).toEqual({ id: 'c_1', full_name: 'X', email: 'e', phone: null });

      // computed fields default
      expect(out.inquiry).toBeNull();
      expect(out.payment_breakdown).toBeNull();

      // id and dates pass through
      expect(stripUndef({ id: out.id, start_date: out.start_date, end_date: out.end_date, created_at: out.created_at })).toEqual({
        id: 'bk_1', start_date: '2024-02-01', end_date: '2024-02-02', created_at: '2024-02-01T00:00:00Z'
      });
    });
  });
});
