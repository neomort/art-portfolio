import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock supabase with a chainable query builder and capture calls
const builders: any[] = [];

jest.mock('../../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    const state: any = { table, filters: [] };
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn((col: string, val: any) => {
        state.filters.push({ col, val });
        return builder;
      }),
      or: jest.fn(() => builder),
      gte: jest.fn(() => builder),
      lte: jest.fn(() => builder),
      contains: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      maybeSingle: jest.fn(async () => {
        if (table === 'organizations') {
          return { data: { id: 'org-id', name: 'Mock Org' }, error: null };
        }
        return { data: null, error: null };
      }),
      then: (resolve: any) => {
        if (table === 'properties') {
          return resolve({ data: [], error: null });
        }
        if (table === 'property_schedule' || table === 'property_availability') {
          return resolve({ data: [], error: null });
        }
        if (table === 'organizations') {
          return resolve({ data: [{ id: 'org-id', name: 'Mock Org' }], error: null });
        }
        return resolve({ data: [], error: null });
      },
      _state: state,
    };
    builders.push(builder);
    return builder;
  };

  return {
    supabase: {
      from: jest.fn((table: string) => makeBuilder(table)),
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    },
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
  };
});

// Mock geocoding (unused in this test but imported by the page)
jest.mock('../../lib/geocoding', () => ({ geocodeAddress: jest.fn() }));

import PropertiesPage from '../../pages/PropertiesPage';

describe('PropertiesPage org_id deep link', () => {
  test('applies organization_id filter on first fetch when org_id is present', async () => {
    const orgId = '98ee1c3e-27d2-46dc-9d9d-8853a74dbd46';

    render(
      <MemoryRouter initialEntries={[`/properties?org_id=${orgId}`]}>
        <Routes>
          <Route path="/properties" element={<PropertiesPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the properties query to be constructed
    await waitFor(() => {
      // Find the latest builder for properties
      const propsBuilders = builders.filter(b => b._state.table === 'properties');
      expect(propsBuilders.length).toBeGreaterThan(0);
      const last = propsBuilders[propsBuilders.length - 1];
      // Ensure the eq was called with organization_id and our orgId
      const eqCalls = (last.eq as jest.Mock).mock.calls;
      const hasOrgFilter = eqCalls.some((args: any[]) => args[0] === 'organization_id' && args[1] === orgId);
      expect(hasOrgFilter).toBe(true);
    });
  });
});
