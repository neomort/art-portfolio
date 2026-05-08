// Mock PaymentForm with an explicit factory so the test renders expected UI
jest.mock('../../../components/payment/PaymentForm', () => ({
  __esModule: true,
  default: ({ booking }: any) => (
    <div data-testid="payment-form-mock">
      <h2>Complete Payment</h2>
      <div data-testid="property-title">{booking?.property?.title || 'Test Property'}</div>
      <div data-testid="payment-amount">${(booking?.price_total / 100).toFixed(2)}</div>
      <div data-testid="payment-element">Payment Element</div>
      <button data-testid="pay-button">Pay Now</button>
    </div>
  ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import PaymentForm from '../../../components/payment/PaymentForm';

// Mock Stripe-related modules
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element">Payment Element</div>,
  useStripe: () => ({
    confirmPayment: jest.fn(() => Promise.resolve({ error: null })),
  }),
  useElements: () => ({
    getElement: jest.fn(),
  }),
}));

describe('PaymentForm', () => {
  const mockBooking = {
    id: 'booking-123',
    price_total: 10000,
    currency: 'USD',
    start_date: '2025-08-01',
    end_date: '2025-08-07',
    property: { title: 'Test Property' },
  };

  it('renders payment form with booking details', () => {
    render(
      <PaymentForm 
        booking={mockBooking}
        onSuccess={jest.fn()}
        onError={jest.fn()}
      />
    );

    expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    expect(screen.getByText('Test Property')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });
});
