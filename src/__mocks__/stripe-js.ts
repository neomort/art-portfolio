// Mock for @stripe/stripe-js
export const loadStripe = jest.fn(() => Promise.resolve({
  elements: jest.fn(() => ({
    create: jest.fn(),
    getElement: jest.fn(),
  })),
  confirmPayment: jest.fn(() => Promise.resolve({ error: null })),
}));

export const Stripe = jest.fn(() => ({
  elements: jest.fn(() => ({
    create: jest.fn(),
    getElement: jest.fn(),
  })),
  confirmPayment: jest.fn(() => Promise.resolve({ error: null })),
}));
