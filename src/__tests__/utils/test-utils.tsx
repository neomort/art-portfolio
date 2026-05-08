import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock Vite environment variables
const originalEnv = { ...process.env };
beforeEach(() => {
  // Reset process.env before each test
  process.env = { ...originalEnv };
  
  // Mock Vite's import.meta.env
  // @ts-ignore
  global.importMeta = {
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  };
});

afterEach(() => {
  // Restore original process.env after each test
  process.env = originalEnv;
});

// Mock the AuthContext
const mockAuth = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' },
  },
  session: {},
  loading: false,
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  updateUser: jest.fn(),
  refreshSession: jest.fn(),
};

// Mock the AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Mock the supabase client
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Mock the calendar utility
jest.mock('../../lib/calendar', () => ({
  generateCalendarEvent: jest.fn(),
}));

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MemoryRouter>
      {children}
    </MemoryRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

export const mockBooking = {
  id: 'booking-123',
  status: 'confirmed',
  start_date: '2025-08-01T10:00:00.000Z',
  end_date: '2025-08-03T18:00:00.000Z',
  total_price: 1200,
  currency: 'USD',
  created_at: '2025-07-30T10:00:00.000Z',
  payment_breakdown: {
    base_price: 1000,
    service_fee: 100,
    cleaning_fee: 50,
    taxes: 50,
    total: 1200
  },
  inquiry: {
    message: 'Space Requirements: 1000 sq ft\nAbout the Brand: Test Brand\nComments: Test comments',
  },
  property: {
    id: 'property-123',
    title: 'Test Property',
    description: 'Test property description',
    price_per_day: 400,
    address_street: '123 Test St',
    address_city: 'Test City',
    address_state: 'TS',
    address_postal_code: '12345',
    address_country: 'Test Country',
    profiles: {
      full_name: 'Property Owner',
      email: 'owner@example.com',
      phone: '123-456-7890',
    },
  },
  user: {
    id: 'user-123',
    email: 'guest@example.com',
    user_metadata: {
      name: 'Test Guest',
    },
  },
};
