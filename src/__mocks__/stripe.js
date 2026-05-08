// Simple mock for Stripe
export const loadStripe = () => ({
  elements: () => ({
    create: jest.fn(),
    getElement: jest.fn(),
  }),
  confirmPayment: jest.fn(),
  confirmCardPayment: jest.fn(),
  confirmSetup: jest.fn(),
  retrievePaymentIntent: jest.fn(),
});
