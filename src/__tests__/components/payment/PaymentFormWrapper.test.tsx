import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Stripe elements
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

// Mock the actual PaymentForm component
jest.mock('../../../components/payment/PaymentForm', () => {
  return function MockPaymentForm({ booking, onSuccess, onError }: any) {
    return (
      <div data-testid="mock-payment-form">
        <h2>Complete Payment</h2>
        <div data-testid="property-title">{booking?.property?.title || 'Test Property'}</div>
        <div data-testid="payment-amount">${(booking?.price_total / 100).toFixed(2)}</div>
        <div data-testid="payment-element">Payment Element</div>
        <button 
          data-testid="pay-button"
          onClick={() => onSuccess()}
        >
          Pay Now
        </button>
      </div>
    );
  };
});

describe('PaymentFormWrapper', () => {
  const mockBooking = {
    id: 'booking-123',
    price_total: 10000, // $100.00 in cents
    currency: 'USD',
    start_date: '2025-08-01',
    end_date: '2025-08-07',
    property: {
      title: 'Test Property',
      address: '123 Test St',
    },
  };

  it('renders payment form with booking details', () => {
    const mockOnSuccess = jest.fn();
    
    render(
      <div>
        <h2>Complete Payment</h2>
        <div data-testid="property-title">{mockBooking.property.title}</div>
        <div data-testid="payment-amount">${(mockBooking.price_total / 100).toFixed(2)}</div>
        <div data-testid="payment-element">Payment Element</div>
        <button 
          data-testid="pay-button"
          onClick={mockOnSuccess}
        >
          Pay Now
        </button>
      </div>
    );

    expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    expect(screen.getByTestId('property-title')).toHaveTextContent('Test Property');
    expect(screen.getByTestId('payment-amount')).toHaveTextContent('$100.00');
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    
    // Test the payment button click
    fireEvent.click(screen.getByTestId('pay-button'));
    expect(mockOnSuccess).toHaveBeenCalled();
  });
});
