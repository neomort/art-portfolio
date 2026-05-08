import React from 'react';

// Mock implementation of PaymentForm that doesn't use import.meta
const PaymentForm = ({ booking, onSuccess, onError, onStripeError }: any) => {
  return (
    <div data-testid="payment-form-mock">
      <h2>Complete Payment</h2>
      <div data-testid="property-title">{booking?.property?.title || 'Test Property'}</div>
      <div data-testid="payment-amount">${(booking?.price_total / 100).toFixed(2)}</div>
      <div data-testid="payment-element">Payment Element</div>
      <button data-testid="pay-button">Pay Now</button>
    </div>
  );
};

export default PaymentForm;
