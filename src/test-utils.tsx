import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

type CustomRenderOptions = {
  route?: string;
  initialEntries?: string[];
} & Omit<RenderOptions, 'wrapper'>;

const customRender = (
  ui: ReactElement,
  { 
    route = '/',
    initialEntries = ['/'],
    ...renderOptions 
  }: CustomRenderOptions = {}
) => {
  window.history.pushState({}, 'Test page', route);
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export * from '@testing-library/react';
export { customRender as render };

// Test data
export const mockReview = {
  id: 'review-1',
  property_id: 'test-property',
  rating: 5,
  content: 'Great place to stay!',
  created_at: '2023-10-01T12:00:00Z',
  reviewer: {
    id: 'user-1',
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg',
  },
  response: [],
  verified_booking: true,
};

export const mockReviewWithResponse = {
  ...mockReview,
  response: [{
    id: 'response-1',
    content: 'Thank you for your feedback!',
    created_at: '2023-10-02T10:00:00Z',
    responder: {
      id: 'owner-user',
      full_name: 'Property Owner',
    }
  }]
};

export const mockReviews = [
  mockReview,
  {
    ...mockReview,
    id: 'review-2',
    rating: 4,
    content: 'Good experience overall',
    created_at: '2023-09-15T10:00:00Z',
    verified_booking: false
  },
  mockReviewWithResponse
];

export const mockStats = {
  averageRating: 4.5,
  totalReviews: 3,
  responseRate: 33.3,
  ratingDistribution: { 5: 2, 4: 1 }
};
