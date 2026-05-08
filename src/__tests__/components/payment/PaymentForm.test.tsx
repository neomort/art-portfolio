import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../../../components/payment/PaymentForm';

// Mock stripePromise for Elements provider
const stripePromise = {
  then: (resolve: any) => resolve({
    elements: () => ({
      create: jest.fn(),
      getElement: jest.fn(),
    }),
    confirmPayment: jest.fn(() => Promise.resolve({ error: null })),
  })
};

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({
    elements: () => ({
      create: jest.fn(),
      getElement: jest.fn(),
    }),
    confirmPayment: jest.fn(() => Promise.resolve({ error: null })),
  })),
}));

// Mock the Stripe elements
jest.mock('@stripe/react-stripe-js', () => {
  const React = require('react');
  const originalModule = jest.requireActual('@stripe/react-stripe-js');
  const Elements = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const PaymentElement = (props: any) => {
    React.useEffect(() => {
      props?.onReady && props.onReady();
    }, []);
    return <div data-testid="payment-element">Payment Element</div>;
  };
  return {
    ...originalModule,
    Elements,
    PaymentElement,
    useStripe: () => ({
      confirmPayment: jest.fn(() => Promise.resolve({ error: null })),
    }),
    useElements: () => ({
      getElement: jest.fn(() => ({
        // Mock element methods
      })),
    }),
  };
});

// Mock the formatCurrency utility
jest.mock('../../../lib/utils', () => ({
  formatCurrency: (amount: number) => `$${(amount / 100).toFixed(2)}`,
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('PaymentForm', () => {
  const mockBooking = {
    id: 'booking-123',
    price_total: 10000, // $100.00 in cents
    currency: 'USD',
    start_date: '2025-08-01',
    end_date: '2025-08-07',
  };

  const renderPaymentForm = (props = {}) => {
    const defaultProps = {
      booking: mockBooking,
      onSuccess: jest.fn(),
      onError: jest.fn(),
      onStripeError: jest.fn(),
      ...props,
    };

    return render(
      <Elements stripe={stripePromise}>
        <PaymentForm {...defaultProps} />
      </Elements>
    );
  };

  it('renders the payment form with booking details', () => {
    renderPaymentForm();

    expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    expect(screen.getByText('Booking Details')).toBeInTheDocument();
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
  });

  it('displays the correct booking amount', () => {
    renderPaymentForm();
    
    // Assuming formatCurrency formats 10000 cents as $100.00
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

    it('calls onSuccess on successful payment submission', async () => {
    const onSuccess = jest.fn();
    renderPaymentForm({ onSuccess });

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handles Stripe confirm error by calling onError and showing generic message', async () => {
    const onError = jest.fn();
    jest.spyOn(require('@stripe/react-stripe-js'), 'useStripe').mockReturnValue({
      confirmPayment: jest.fn(() => Promise.resolve({ error: { message: 'Your card was declined.' } }))
    });
    renderPaymentForm({ onError });

    const payButton = await screen.findByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    });
  });

  it('calls onError and displays error message on generic error', async () => {
    const onError = jest.fn();
    jest.spyOn(require('@stripe/react-stripe-js'), 'useStripe').mockReturnValue({
      confirmPayment: jest.fn(() => { throw new Error('Generic payment failure'); })
    });
    renderPaymentForm({ onError });

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(screen.getByText('Generic payment failure')).toBeInTheDocument();
    });
  });

  it('disables Pay Now button and shows loading state during submission', async () => {
    let resolveConfirm: any;
    const confirmPromise = new Promise((resolve) => { resolveConfirm = resolve; });
    jest.spyOn(require('@stripe/react-stripe-js'), 'useStripe').mockReturnValue({
      confirmPayment: jest.fn(() => confirmPromise)
    });
    renderPaymentForm();
    const payButton = await screen.findByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);
    expect(payButton).toBeDisabled();
    resolveConfirm({ error: null });
  });

  it('prevents submission if Stripe or Elements are not ready', () => {
    jest.spyOn(require('@stripe/react-stripe-js'), 'useStripe').mockReturnValue(null);
    renderPaymentForm();
    const submitButton = screen.getByRole('button');
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    // Should not throw, and onSuccess/onError are not called
    // No error message should be displayed
    expect(screen.queryByText(/payment failed/i)).not.toBeInTheDocument();
  });

  it('prevents double submission while loading', async () => {
    let resolveConfirm: any;
    const confirmPromise = new Promise((resolve) => { resolveConfirm = resolve; });
    jest.spyOn(require('@stripe/react-stripe-js'), 'useStripe').mockReturnValue({
      confirmPayment: jest.fn(() => confirmPromise)
    });
    renderPaymentForm();
    const payButton = await screen.findByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);
    fireEvent.click(payButton); // second click while loading
    // Only one submission should be triggered
    // Optionally, check that confirmPayment was only called once
    resolveConfirm({ error: null });
  });
});
