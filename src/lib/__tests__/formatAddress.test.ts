import { getAddressFields, formatCityState, formatFullAddress, type AddressLike } from '../formatAddress';

describe('formatAddress utilities', () => {
  describe('getAddressFields', () => {
    it('prefers nested address over flat fields and coerces presence', () => {
      const p: AddressLike = {
        address_city: 'Flat City',
        address_state: 'FS',
        address_street: '123 Flat',
        address_postal_code: '99999',
        address_country: 'US',
        address: {
          city: 'Nested City',
          state: 'NS',
          street: '456 Nested',
          postalCode: '00000',
          country: 'CA',
        },
      };

      const f = getAddressFields(p);
      expect(f).toEqual({
        street: '456 Nested',
        city: 'Nested City',
        state: 'NS',
        postalCode: '00000',
        country: 'CA',
      });
    });

    it('falls back to flat fields when nested is missing', () => {
      const p: AddressLike = {
        address_city: 'Austin',
        address_state: 'TX',
        address_street: '123 Main',
        address_postal_code: '78701',
        address_country: 'US',
      };
      const f = getAddressFields(p);
      expect(f).toEqual({
        street: '123 Main',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
      });
    });

    it('returns nulls when nothing available', () => {
      const f = getAddressFields({} as any);
      expect(f).toEqual({ street: null, city: null, state: null, postalCode: null, country: null });
    });
  });

  describe('formatCityState', () => {
    it('renders "City, ST" when both present', () => {
      const p: AddressLike = { address: { city: 'Austin', state: 'TX' } };
      expect(formatCityState(p)).toBe('Austin, TX');
    });

    it('renders city only when state missing', () => {
      const p: AddressLike = { address: { city: 'Austin' } };
      expect(formatCityState(p)).toBe('Austin');
    });

    it('uses unknownCity when city missing', () => {
      const p: AddressLike = { address: { state: 'TX' } };
      expect(formatCityState(p)).toBe('Unknown City, TX');
      expect(formatCityState(p, { unknownCity: 'N/A' })).toBe('N/A, TX');
    });

    it('honors custom separator', () => {
      const p: AddressLike = { address: { city: 'Austin', state: 'TX' } };
      expect(formatCityState(p, { separator: ' • ' })).toBe('Austin • TX');
    });
  });

  describe('formatFullAddress', () => {
    it('joins street, city state postal, and country with commas', () => {
      const p: AddressLike = {
        address: {
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US',
        },
      };
      expect(formatFullAddress(p)).toBe('123 Main St, Austin TX 78701, US');
    });

    it('omits missing parts gracefully', () => {
      const p: AddressLike = { address: { city: 'Austin' } };
      expect(formatFullAddress(p)).toBe('Austin');
    });

    it('falls back to Unknown location when nothing available', () => {
      expect(formatFullAddress({} as any)).toBe('Unknown location');
    });

    it('uses flat fields when nested missing', () => {
      const p: AddressLike = {
        address_street: '789 Flat Rd',
        address_city: 'Dallas',
        address_state: 'TX',
        address_postal_code: '75001',
        address_country: 'US',
      };
      expect(formatFullAddress(p)).toBe('789 Flat Rd, Dallas TX 75001, US');
    });
  });
});
